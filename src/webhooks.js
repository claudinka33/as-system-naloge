// webhooks.js — n8n integracija za sinhronizacijo nalog z Outlook koledarji in emailom

const N8N_WEBHOOK_URL = 'https://claudinka33.app.n8n.cloud/webhook/task-sync';

/**
 * Pošlje webhook v n8n.
 * Workflow v n8n potem: 
 *  - ustvari/posodobi/izbriše Outlook event v koledarju vsakega dodeljenega zaposlenega
 *  - pošlje email obvestilo iz naloge@as-system.si
 * 
 * @param {string} action - 'create' | 'update' | 'delete'
 * @param {object} task - podatki naloge iz Supabase
 * @param {object} employees - mapping email→name iz seznama EMPLOYEES
 * @param {string} createdByName - ime osebe, ki je nalogo ustvarila/spremenila
 * @returns {Promise<object|null>} - odgovor iz n8n (vsebuje outlook_event_id), ali null če napaka
 */
export async function syncTaskWebhook(action, task, employees, createdByName) {
  try {
    // Naloga ima lahko več dodeljenih oseb. Za vsako pošljemo svoj webhook.
    // (Vsaka oseba dobi svoj Outlook event v svojem koledarju.)
    const assignedEmails = task.assigned_to_emails || [];
    
    if (assignedEmails.length === 0) {
      console.log('[webhook] Naloga nima dodeljenih, preskočim sinhronizacijo.');
      return null;
    }

    // Za update/delete potrebujemo outlook_event_id
    if ((action === 'update' || action === 'delete') && !task.outlook_event_id) {
      console.log('[webhook] Naloga nima outlook_event_id, preskočim ' + action);
      return null;
    }

    const results = [];
    
    for (const email of assignedEmails) {
      const employee = employees.find(e => e.email === email);
      const assignedName = employee ? employee.name : email;

      const payload = {
        action,
        task: {
          id: task.id,
          title: task.title,
          description: task.description || '',
          due_date: task.due_date,
          priority: task.priority,
          assigned_by_name: createdByName || task.created_by_name || 'AS system',
        },
        assigned_to_email: email,
        assigned_to_name: assignedName,
        outlook_event_id: task.outlook_event_id || null,
      };

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('[webhook] napaka pri', action, 'za', email, ':', response.status);
        continue;
      }

      const data = await response.json();
      results.push({ email, ...data });
    }

    // Vrni prvi outlook_event_id (za primere ko je 1 zaposleni)
    return results[0] || null;
  } catch (error) {
    // Webhook napaka NE sme prekiniti delovanja aplikacije.
    // Naloga se shrani v Supabase, samo Outlook integracija ne deluje.
    console.error('[webhook] napaka:', error);
    return null;
  }
}
