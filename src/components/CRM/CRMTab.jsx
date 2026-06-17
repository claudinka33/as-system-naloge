// CRMTab.jsx — CRM modul za komercialiste (obiski strank + kilometrina + ponudbe)
// Mobilno/tablično prijazno: privzeti pogled je Vnos, živ izračun časa, jasna potrditev shranjevanja,
// analiza z zgodovino po posamezni stranki.
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BarChart3, Loader2, Download, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, Home, MapPin, Clock, Car, FileText, User, Briefcase, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { syncTaskWebhook } from '../../webhooks.js';

// Pošlje email + Outlook obvestilo odgovorni osebi (znova uporabi obstoječi task-sync n8n flow).
// Vrne outlook_event_id (ali null). Napaka ne prekine shranjevanja.
async function crmNotifyResponsible({ kind, customerName, dateTimeISO, descLines, responsibleEmail, responsibleName, createdByName, employees }) {
  if (!responsibleEmail) return null;
  const titlePrefix = kind === 'call' ? 'CRM klic / email' : 'CRM obisk';
  const pseudoTask = {
    id: `crm-${kind}-${Date.now()}`,
    title: `${titlePrefix}: ${customerName || 'stranka'}`,
    description: (descLines || []).filter(Boolean).join(' · ').replace(/[\r\n\t]+/g, ' ').replace(/"/g, "'"),
    due_date: dateTimeISO,
    priority: 'medium',
    assigned_to_emails: [responsibleEmail],
    add_to_calendar: true,
    outlook_event_id: null,
  };
  try {
    const res = await syncTaskWebhook('create', pseudoTask, employees || [], createdByName);
    return res?.outlook_event_id || null;
  } catch (e) {
    console.error('[crm] obvestilo napaka:', e);
    return null;
  }
}

const AS_RED = '#C8102E';
const CRM_COLOR = '#7C2D12';
const CRM_BG = '#FED7AA';

// Dovoljeni uporabniki (komercialistka pride pozneje)
export const CRM_ALLOWED_EMAILS = [
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
  'hermina.leskovec@as-system.si',
  'alen.drofenik@as-system.si',
  'tjasa.mihevc@as-system.si',
];

// Komercialista, ki poleg svojih vidita tudi Herminine vnose
const CRM_TEAM_LEADS = ['alen.drofenik@as-system.si', 'tjasa.mihevc@as-system.si'];
const CRM_TEAM_MEMBER = 'hermina.leskovec@as-system.si';

export function canAccessCRM(email) {
  return CRM_ALLOWED_EMAILS.includes(email);
}

const SLOVENIAN_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI');
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('sl-SI');
}

// Izračun časa med dvema HH:MM v minutah
function diffMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatMinutes(min) {
  if (min === null || min === undefined || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

// 7-dnevni zaklep za nove vnose
function isLocked(entryDate, createdBy, currentUserEmail, isAdmin) {
  if (isAdmin) return false;
  if (createdBy !== currentUserEmail) return true;
  const d = new Date(entryDate);
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

export default function CRMTab({ currentUser, isAdmin, employees }) {
  const [view, setView] = useState('entry'); // privzeto: takojšen vnos
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const isTeamLead = !isAdmin && CRM_TEAM_LEADS.includes(currentUser?.email);
  const [personFilter, setPersonFilter] = useState((isAdmin || isTeamLead) ? 'all' : (currentUser?.email || 'all'));

  // Zelena potrditev se sama skrije
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      let qy = supabase
        .from('crm_visits')
        .select('*')
        .order('visit_date', { ascending: false })
        .order('arrival_time', { ascending: true })
        .limit(2000);
      if (!isAdmin) {
        if (isTeamLead) {
          qy = qy.in('created_by', [currentUser?.email, CRM_TEAM_MEMBER]);
        } else {
          qy = qy.eq('created_by', currentUser?.email);
        }
      }
      const { data, error } = await qy;
      if (error) throw error;
      setVisits(data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // Skupna funkcija po shranjevanju: osveži + pokaži zeleno potrditev
  function handleSaved(msg) {
    loadAll();
    setFlash(msg || '✓ Shranjeno');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const scopedVisits = (personFilter === 'all') ? visits : visits.filter((v) => v.created_by === personFilter);

  return (
    <div>
      {/* Navigacija + filtri */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <div className="grid grid-cols-2 sm:flex gap-1.5 bg-as-gray-100 rounded-xl p-1.5 border border-as-gray-200">
          <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
          <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
          <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
          <SubTab active={view === 'analysis'} onClick={() => setView('analysis')} icon={<User className="w-4 h-4" />} label="Stranke" />
        </div>
        {(isAdmin || isTeamLead) && (
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}
            className="px-3 py-2.5 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
            <option value="all">Vsi komercialisti</option>
            {(employees || [])
              .filter((e) => isAdmin ? canAccessCRM(e.email) : [currentUser?.email, CRM_TEAM_MEMBER].includes(e.email))
              .map((e) => (
              <option key={e.email} value={e.email}>{e.name}</option>
            ))}
          </select>
        )}
        <div id="crm-controls-slot" className="flex flex-wrap items-center gap-2 sm:ml-auto"></div>
      </div>

      {/* Zelena potrditev */}
      {flash && (
        <div className="flex items-center gap-2 p-3.5 mb-4 rounded-xl border shadow-sm animate-pulse"
          style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">{flash}</span>
          <button onClick={() => setFlash('')} className="text-green-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {view === 'entry' && <EntryView currentUser={currentUser} employees={employees} onSaved={handleSaved} setError={setError} />}
      {view === 'daily' && <DailyView visits={scopedVisits} isAdmin={isAdmin} currentUser={currentUser} onReload={loadAll} loading={loading} />}
      {view === 'monthly' && <MonthlyView visits={scopedVisits} loading={loading} />}
      {view === 'analysis' && <AnalysisView visits={scopedVisits} loading={loading} />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 text-sm font-semibold rounded-lg transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: AS_RED } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── ENTRY VIEW ───
function EntryView({ currentUser, employees, onSaved, setError }) {
  const [entryType, setEntryType] = useState('visit'); // takoj pripravljen vnos stranke

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <SectionPill active={entryType === 'home_start'} onClick={() => setEntryType('home_start')}
          icon={<Home className="w-4 h-4" />} label="Začetek (doma)" color="#1E40AF" bgColor="#DBEAFE" />
        <SectionPill active={entryType === 'visit'} onClick={() => setEntryType('visit')}
          icon={<MapPin className="w-4 h-4" />} label="Obisk stranke" color={CRM_COLOR} bgColor={CRM_BG} />
        <SectionPill active={entryType === 'call'} onClick={() => setEntryType('call')}
          icon={<Phone className="w-4 h-4" />} label="Klic / Email" color="#6D28D9" bgColor="#EDE9FE" />
        <SectionPill active={entryType === 'home_end'} onClick={() => setEntryType('home_end')}
          icon={<Home className="w-4 h-4" />} label="Konec (doma)" color="#065F46" bgColor="#A7F3D0" />
      </div>

      {entryType === 'home_start' && (
        <HomeStartForm currentUser={currentUser} onSaved={onSaved} setError={setError}
          onAfterSave={() => setEntryType('visit')} />
      )}
      {entryType === 'visit' && <VisitForm currentUser={currentUser} employees={employees} onSaved={onSaved} setError={setError} />}
      {entryType === 'call' && <CallForm currentUser={currentUser} employees={employees} onSaved={onSaved} setError={setError} />}
      {entryType === 'home_end' && <HomeEndForm currentUser={currentUser} onSaved={onSaved} setError={setError} />}
    </div>
  );
}

function SectionPill({ active, onClick, icon, label, color, bgColor }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition"
      style={{
        borderColor: active ? color : '#E5E7EB',
        background: active ? bgColor : '#fff',
        color: active ? color : '#6B7280',
      }}
    >
      {icon} <span className="truncate">{label}</span>
    </button>
  );
}

// ─── HOME START FORM ───
function HomeStartForm({ currentUser, onSaved, setError, onAfterSave }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!km) { setError('Vnesi km stanje.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'home_start',
        departure_time: time,
        odometer_km: parseInt(km),
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setKm('');
      onSaved('✓ Začetek dneva shranjen — zdaj vnesi prvo stranko 👇');
      if (onAfterSave) onAfterSave();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DBEAFE', color: '#1E40AF' }}>🏠</span>
        Začetek dneva (zjutraj doma)
      </h3>
      <p className="text-xs text-as-gray-500 italic">💡 Vnesi km stanje, preden zapustiš dom. Po shranjevanju te program preusmeri na vnos stranke.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas odhoda *">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45230" />
        </FormField>
      </div>

      <SubmitBtn loading={loading} color="#1E40AF" label="Shrani začetek dneva" />
    </form>
  );
}

// ─── VISIT FORM ───
function VisitForm({ currentUser, employees, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customer, setCustomer] = useState(null);
  const [outcome, setOutcome] = useState('nic');
  const [arrivalTime, setArrivalTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [departureTime, setDepartureTime] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [createOffer, setCreateOffer] = useState(false);
  const [offerDescription, setOfferDescription] = useState('');
  const [offerAssignedTo, setOfferAssignedTo] = useState('');
  const [offerDueDate, setOfferDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notify, setNotify] = useState(false);
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // ŽIV IZRAČUN ČASA pri stranki
  const liveDuration = diffMinutes(arrivalTime, departureTime);

  function reset() {
    setNotify(false);
    setResponsibleEmail('');
    setCustomer(null);
    setOutcome('nic');
    setCustomerName('');
    setCustomerAddress('');
    setArrivalTime(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setDepartureTime('');
    setKm('');
    setNotes('');
    setCreateOffer(false);
    setOfferDescription('');
    setOfferAssignedTo('');
    setOfferDueDate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim()) { setError('Vnesi ime stranke.'); return; }
    if (!arrivalTime) { setError('Vnesi čas prihoda.'); return; }
    if (!km) { setError('Vnesi km stanje.'); return; }
    if (createOffer) {
      if (!offerDescription.trim()) { setError('Vnesi opis ponudbe.'); return; }
      if (!offerAssignedTo) { setError('Izberi komu dodeliš pripravo ponudbe.'); return; }
    }
    if (notify && !responsibleEmail) { setError('Izberi odgovorno osebo za obvestilo.'); return; }

    setLoading(true); setError('');
    try {
      let offerTaskId = null;

      // Najprej kreiraj nalogo, če je ponudba
      if (createOffer) {
        const assignedEmp = employees.find((emp) => emp.email === offerAssignedTo);
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            title: `Pripravi ponudbo: ${customerName}`,
            description: `Iz obiska ${formatDate(date)}.\n\nOpis ponudbe:\n${offerDescription}\n\nDogovor s stranko:\n${notes || '—'}`,
            assigned_to_emails: [offerAssignedTo],
            responsible_email: offerAssignedTo,
            responsible_name: assignedEmp?.name || null,
            department: assignedEmp?.department || 'Komerciala',
            company: customerName,
            area: 'Ponudba',
            priority: 'medium',
            due_date: new Date(offerDueDate).toISOString(),
            status: 'pending',
            recurring_type: 'none',
            created_by_email: currentUser?.email,
            created_by_name: currentUser?.name,
          }])
          .select()
          .single();
        if (taskError) throw taskError;
        offerTaskId = taskData.id;
      }

      // Obvesti odgovorno osebo (email + Outlook), če je označeno
      let outlookEventId = null;
      const respEmp = employees.find((e) => e.email === responsibleEmail);
      if (notify && responsibleEmail) {
        outlookEventId = await crmNotifyResponsible({
          kind: 'visit',
          customerName,
          dateTimeISO: new Date(`${date}T${arrivalTime || '09:00'}:00`).toISOString(),
          descLines: [
            customerAddress ? `Lokacija: ${customerAddress}` : '',
            notes ? `Dogovor: ${notes}` : '',
            createOffer ? `Ponudba: ${offerDescription} (rok ${formatDate(offerDueDate)})` : '',
            `Vneseno iz CRM (${currentUser?.name || ''}).`,
          ],
          responsibleEmail,
          responsibleName: respEmp?.name || responsibleEmail,
          createdByName: currentUser?.name,
          employees,
        });
      }

      // Potem shrani obisk (čas pri stranki se izračuna samodejno)
      const computedMin = (liveDuration != null && liveDuration >= 0) ? liveDuration : null;
      const { error: visitError } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'visit',
        customer_name: customerName.trim(),
        customer_address: customerAddress.trim() || null,
        arrival_time: arrivalTime,
        departure_time: departureTime || null,
        odometer_km: parseInt(km),
        customer_id: customer?.id || null,
        outcome,
        visit_duration_min: computedMin,
        notes: notes || null,
        create_offer: createOffer,
        offer_description: createOffer ? offerDescription : null,
        offer_assigned_to_email: createOffer ? offerAssignedTo : null,
        offer_due_date: createOffer ? offerDueDate : null,
        offer_task_id: offerTaskId,
        notify_responsible: notify,
        responsible_email: notify ? responsibleEmail : null,
        responsible_name: notify ? (respEmp?.name || null) : null,
        add_to_calendar: notify,
        outlook_event_id: outlookEventId,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (visitError) throw visitError;

      const savedName = customerName.trim();
      reset();
      onSaved(`✓ Obisk shranjen: ${savedName}${createOffer ? ' + naloga za ponudbo' : ''}. Vnesi naslednjo stranko 👇`);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: CRM_BG, color: CRM_COLOR }}>📍</span>
        Nov obisk stranke
      </h3>

      {/* STRANKA — najprej, ker je najpomembnejše */}
      <FormField label="Stranka *">
        <CustomerPicker
          selected={customer}
          onSelect={(c) => { setCustomer(c); setCustomerName(c.naziv); setCustomerAddress([c.ulica, c.posta].filter(Boolean).join(', ')); }}
          onClear={() => { setCustomer(null); setCustomerName(''); setCustomerAddress(''); }}
        />
      </FormField>

      {/* ČASI + ŽIV IZRAČUN */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Čas prihoda *">
          <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas odhoda">
          <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={inputCls} />
        </FormField>
      </div>

      {/* Živ prikaz trajanja */}
      {departureTime && (
        liveDuration != null && liveDuration >= 0 ? (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#CFFAFE', color: '#0E7490' }}>
            <Clock className="w-5 h-5" /> Čas pri stranki: {formatMinutes(liveDuration)}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            <AlertCircle className="w-5 h-5" /> Čas odhoda je pred prihodom — preveri ure.
          </div>
        )
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec ob prihodu *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45255" />
        </FormField>
      </div>

      <FormField label="Izid obiska *">
        <OutcomePicker value={outcome} onChange={setOutcome} />
      </FormField>

      <FormField label="Dogovori / kaj se je dogovorilo">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls + ' resize-none'}
          placeholder="O čem ste se pogovarjali, kaj je bilo dogovorjeno, naslednji koraki..." />
      </FormField>

      {/* PONUDBA */}
      <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: createOffer ? '#FEF3C7' : '#fafafa' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createOffer}
            onChange={(e) => setCreateOffer(e.target.checked)}
            className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0"
            style={{ accentColor: CRM_COLOR }}
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              Naredi ponudbo za to stranko
            </div>
            <p className="text-xs text-as-gray-500 mt-0.5">
              Avtomatsko ustvari nalogo "Pripravi ponudbo" za izbrano osebo.
            </p>
          </div>
        </label>

        {createOffer && (
          <div className="space-y-3 pt-2 border-t border-as-gray-200">
            <FormField label="Opis ponudbe *">
              <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'}
                placeholder="Kaj naj se ponudi? Količine, izdelki, posebnosti..." />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Komu dodeli pripravo *">
                <select value={offerAssignedTo} onChange={(e) => setOfferAssignedTo(e.target.value)} required className={inputCls}>
                  <option value="">-- izberi osebo --</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rok za ponudbo *">
                <input type="date" value={offerDueDate} onChange={(e) => setOfferDueDate(e.target.value)} required className={inputCls} />
              </FormField>
            </div>
          </div>
        )}
      </div>

      <NotifyBlock notify={notify} setNotify={setNotify} responsibleEmail={responsibleEmail} setResponsibleEmail={setResponsibleEmail} employees={employees} />

      <SubmitBtn loading={loading} color={CRM_COLOR} label={`Shrani obisk${createOffer ? ' + kreiraj nalogo' : ''}`} />
    </form>
  );
}

// ─── HOME END FORM ───
function HomeEndForm({ currentUser, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!km) { setError('Vnesi km stanje.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'home_end',
        arrival_time: time,
        odometer_km: parseInt(km),
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setKm('');
      onSaved('✓ Konec dneva shranjen. Lep dan!');
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#A7F3D0', color: '#065F46' }}>🏠</span>
        Konec dneva (zvečer doma)
      </h3>
      <p className="text-xs text-as-gray-500 italic">💡 Vnesi km stanje, ko prideš domov.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas prihoda *">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45310" />
        </FormField>
      </div>

      <SubmitBtn loading={loading} color="#065F46" label="Shrani konec dneva" />
    </form>
  );
}

// ─── NOTIFY BLOCK (obvestilo odgovorni osebi: email + Outlook) ───
function NotifyBlock({ notify, setNotify, responsibleEmail, setResponsibleEmail, employees }) {
  return (
    <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: notify ? '#EFF6FF' : '#fafafa' }}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
          className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0" style={{ accentColor: '#1E40AF' }} />
        <div className="flex-1">
          <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
            <Mail className="w-4 h-4" /> Obvesti odgovorno osebo (email + Outlook)
          </div>
          <p className="text-xs text-as-gray-500 mt-0.5">
            Izbrani osebi pride email iz naloge@as-system.si in dogodek v Outlook koledar.
          </p>
        </div>
      </label>
      {notify && (
        <div className="pt-2 border-t border-as-gray-200">
          <FormField label="Odgovorna oseba *">
            <select value={responsibleEmail} onChange={(e) => setResponsibleEmail(e.target.value)} required className={inputCls}>
              <option value="">-- izberi osebo --</option>
              {(employees || []).map((emp) => (
                <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
              ))}
            </select>
          </FormField>
        </div>
      )}
    </div>
  );
}

// ─── CALL / EMAIL FORM ───
function CallForm({ currentUser, employees, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [customerName, setCustomerName] = useState('');
  const [channel, setChannel] = useState('phone');
  const [customer, setCustomer] = useState(null);
  const [outcome, setOutcome] = useState('nic');
  const [durationMin, setDurationMin] = useState('');
  const [notes, setNotes] = useState('');
  const [createOffer, setCreateOffer] = useState(false);
  const [offerDescription, setOfferDescription] = useState('');
  const [offerAssignedTo, setOfferAssignedTo] = useState('');
  const [offerDueDate, setOfferDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  });
  const [notify, setNotify] = useState(false);
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setCustomer(null); setOutcome('nic');
    setCustomerName(''); setChannel('phone'); setDurationMin(''); setNotes('');
    setCreateOffer(false); setOfferDescription(''); setOfferAssignedTo('');
    setOfferDueDate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); });
    setNotify(false); setResponsibleEmail('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim()) { setError('Vnesi ime stranke.'); return; }
    if (createOffer) {
      if (!offerDescription.trim()) { setError('Vnesi opis ponudbe.'); return; }
      if (!offerAssignedTo) { setError('Izberi komu dodeliš pripravo ponudbe.'); return; }
    }
    if (notify && !responsibleEmail) { setError('Izberi odgovorno osebo za obvestilo.'); return; }

    setLoading(true); setError('');
    try {
      let offerTaskId = null;
      if (createOffer) {
        const assignedEmp = employees.find((emp) => emp.email === offerAssignedTo);
        const kanalTxt = channel === 'email' ? 'email-a' : 'klica';
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            title: `Pripravi ponudbo: ${customerName}`,
            description: `Iz ${kanalTxt} ${formatDate(date)}.\n\nOpis ponudbe:\n${offerDescription}\n\nDogovor:\n${notes || '—'}`,
            assigned_to_emails: [offerAssignedTo],
            responsible_email: offerAssignedTo,
            responsible_name: assignedEmp?.name || null,
            department: assignedEmp?.department || 'Komerciala',
            company: customerName,
            area: 'Ponudba',
            priority: 'medium',
            due_date: new Date(offerDueDate).toISOString(),
            status: 'pending',
            recurring_type: 'none',
            created_by_email: currentUser?.email,
            created_by_name: currentUser?.name,
          }])
          .select()
          .single();
        if (taskError) throw taskError;
        offerTaskId = taskData.id;
      }

      let outlookEventId = null;
      const respEmp = employees.find((e) => e.email === responsibleEmail);
      if (notify && responsibleEmail) {
        outlookEventId = await crmNotifyResponsible({
          kind: 'call',
          customerName,
          dateTimeISO: new Date(`${date}T${time || '09:00'}:00`).toISOString(),
          descLines: [
            `Kanal: ${channel === 'email' ? 'Email' : 'Telefonski klic'}`,
            (channel === 'phone' && durationMin) ? `Trajanje: ${durationMin} min` : '',
            notes ? `Dogovor: ${notes}` : '',
            createOffer ? `Ponudba: ${offerDescription} (rok ${formatDate(offerDueDate)})` : '',
            `Vneseno iz CRM (${currentUser?.name || ''}).`,
          ],
          responsibleEmail,
          responsibleName: respEmp?.name || responsibleEmail,
          createdByName: currentUser?.name,
          employees,
        });
      }

      const { error: callError } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'call',
        customer_name: customerName.trim(),
        arrival_time: time || null,
        channel,
        call_duration_min: channel === 'phone' && durationMin ? parseInt(durationMin) : null,
        customer_id: customer?.id || null,
        outcome,
        visit_duration_min: channel === 'phone' && durationMin ? parseInt(durationMin) : null,
        notes: notes || null,
        create_offer: createOffer,
        offer_description: createOffer ? offerDescription : null,
        offer_assigned_to_email: createOffer ? offerAssignedTo : null,
        offer_due_date: createOffer ? offerDueDate : null,
        offer_task_id: offerTaskId,
        notify_responsible: notify,
        responsible_email: notify ? responsibleEmail : null,
        responsible_name: notify ? (respEmp?.name || null) : null,
        add_to_calendar: notify,
        outlook_event_id: outlookEventId,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (callError) throw callError;

      const savedName = customerName.trim();
      const kanal = channel === 'email' ? 'Email' : 'Klic';
      reset();
      onSaved(`✓ ${kanal} shranjen: ${savedName}${createOffer ? ' + naloga za ponudbo' : ''}.`);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EDE9FE', color: '#6D28D9' }}>📞</span>
        Klic / Email stranke
      </h3>

      <FormField label="Stranka *">
        <CustomerPicker
          selected={customer}
          onSelect={(c) => { setCustomer(c); setCustomerName(c.naziv); }}
          onClear={() => { setCustomer(null); setCustomerName(''); }}
        />
      </FormField>

      <FormField label="Vrsta stika *">
        <div className="flex gap-2">
          <button type="button" onClick={() => setChannel('phone')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: channel === 'phone' ? '#6D28D9' : '#E5E7EB', background: channel === 'phone' ? '#EDE9FE' : '#fff', color: channel === 'phone' ? '#6D28D9' : '#6B7280' }}>
            <Phone className="w-4 h-4" /> Klic
          </button>
          <button type="button" onClick={() => setChannel('email')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: channel === 'email' ? '#6D28D9' : '#E5E7EB', background: channel === 'email' ? '#EDE9FE' : '#fff', color: channel === 'email' ? '#6D28D9' : '#6B7280' }}>
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </FormField>
      </div>

      {channel === 'phone' && (
        <FormField label="Trajanje klica (min)">
          <input type="number" inputMode="numeric" min="0" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={inputCls} placeholder="npr. 15" />
        </FormField>
      )}

      <FormField label="Izid *">
        <OutcomePicker value={outcome} onChange={setOutcome} />
      </FormField>

      <FormField label="Dogovori / kaj se je dogovorilo">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls + ' resize-none'}
          placeholder="O čem ste se pogovarjali, kaj je bilo dogovorjeno, naslednji koraki..." />
      </FormField>

      {/* PONUDBA */}
      <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: createOffer ? '#FEF3C7' : '#fafafa' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={createOffer} onChange={(e) => setCreateOffer(e.target.checked)}
            className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0" style={{ accentColor: CRM_COLOR }} />
          <div className="flex-1">
            <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> Naredi ponudbo za to stranko
            </div>
            <p className="text-xs text-as-gray-500 mt-0.5">Avtomatsko ustvari nalogo "Pripravi ponudbo" za izbrano osebo.</p>
          </div>
        </label>
        {createOffer && (
          <div className="space-y-3 pt-2 border-t border-as-gray-200">
            <FormField label="Opis ponudbe *">
              <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'}
                placeholder="Kaj naj se ponudi? Količine, izdelki, posebnosti..." />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Komu dodeli pripravo *">
                <select value={offerAssignedTo} onChange={(e) => setOfferAssignedTo(e.target.value)} required className={inputCls}>
                  <option value="">-- izberi osebo --</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rok za ponudbo *">
                <input type="date" value={offerDueDate} onChange={(e) => setOfferDueDate(e.target.value)} required className={inputCls} />
              </FormField>
            </div>
          </div>
        )}
      </div>

      <NotifyBlock notify={notify} setNotify={setNotify} responsibleEmail={responsibleEmail} setResponsibleEmail={setResponsibleEmail} employees={employees} />

      <SubmitBtn loading={loading} color="#6D28D9" label={`Shrani ${channel === 'email' ? 'email' : 'klic'}${createOffer ? ' + kreiraj nalogo' : ''}`} />
    </form>
  );
}

// ─── DAILY VIEW ───
function DailyView({ visits, isAdmin, currentUser, onReload, loading }) {
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterUser, setFilterUser] = useState('all');
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('crm-controls-slot'));
  }, []);

  // Vsi vnosi tega dne, filtrirani po uporabniku
  const dayVisits = visits
    .filter((v) => v.visit_date === filterDate)
    .filter((v) => filterUser === 'all' || v.created_by === filterUser)
    .sort((a, b) => {
      // Razvrsti: home_start prvi, potem obiski po času prihoda, home_end zadnji
      const order = { home_start: 0, visit: 1, home_end: 2 };
      const ao = order[a.entry_type] ?? 1;
      const bo = order[b.entry_type] ?? 1;
      if (ao !== bo) return ao - bo;
      const at = a.arrival_time || a.departure_time || '00:00';
      const bt = b.arrival_time || b.departure_time || '00:00';
      return at.localeCompare(bt);
    });

  // Unikatni uporabniki za filter
  const uniqueUsers = useMemo(() => {
    const map = {};
    visits.forEach((v) => {
      if (v.created_by) map[v.created_by] = v.created_by_name || v.created_by;
    });
    return Object.entries(map).map(([email, name]) => ({ email, name }));
  }, [visits]);

  // Izračun kilometrine — zaporedne razlike
  const kmData = useMemo(() => {
    const withKm = dayVisits.filter((v) => v.odometer_km != null);
    if (withKm.length < 2) return { segments: [], totalKm: 0 };
    const segments = [];
    for (let i = 1; i < withKm.length; i++) {
      const from = withKm[i - 1];
      const to = withKm[i];
      const km = to.odometer_km - from.odometer_km;
      segments.push({ from, to, km });
    }
    const totalKm = segments.reduce((s, x) => s + (x.km > 0 ? x.km : 0), 0);
    return { segments, totalKm };
  }, [dayVisits]);

  // Statistike
  const visitCount = dayVisits.filter((v) => v.entry_type === 'visit').length;
  const callCount = dayVisits.filter((v) => v.entry_type === 'call').length;
  const offerCount = dayVisits.filter((v) => (v.entry_type === 'visit' || v.entry_type === 'call') && v.create_offer).length;
  const totalTimeAtCustomers = dayVisits
    .filter((v) => v.entry_type === 'visit' && v.arrival_time && v.departure_time)
    .reduce((s, v) => s + (diffMinutes(v.arrival_time, v.departure_time) || 0), 0);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm" />
      </div>
      {isAdmin && uniqueUsers.length > 1 && (
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          <option value="all">Vsi komercialisti</option>
          {uniqueUsers.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
        </select>
      )}
      <button
        onClick={() => exportDailyCSV(filterDate, dayVisits, kmData)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> CSV
      </button>
    </>
  );

  async function handleDelete(visit) {
    if (!confirm('Izbrišem ta vnos?')) return;
    // Če je obisk z ustvarjeno nalogo, vprašaj
    if (visit.offer_task_id) {
      if (!confirm('Ta obisk je ustvaril nalogo. Naj se naloga ohrani? (klik OK ohrani, Prekliči izbriše tudi nalogo)')) {
        await supabase.from('tasks').delete().eq('id', visit.offer_task_id);
      }
    }
    await supabase.from('crm_visits').delete().eq('id', visit.id);
    onReload();
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-1">📅 {formatLongDate(filterDate)}</h3>
            <p className="text-xs text-as-gray-500">Vnosov: {dayVisits.length}</p>
          </div>

          {/* Statistike */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <BigStat icon="📍" label="Obiski" value={visitCount} unit="" color={CRM_COLOR} bgColor={CRM_BG} />
            <BigStat icon="📞" label="Klici / emaili" value={callCount} unit="" color="#6D28D9" bgColor="#EDE9FE" />
            <BigStat icon="🚗" label="Skupaj km" value={formatNumber(kmData.totalKm)} unit="km" color="#1E40AF" bgColor="#DBEAFE" />
            <BigStat icon="⏱️" label="Čas pri strankah" value={formatMinutes(totalTimeAtCustomers)} unit="" color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="📝" label="Ponudbe" value={offerCount} unit="" color="#854D0E" bgColor="#FEF3C7" />
          </div>

          {/* Časovnica dneva */}
          {dayVisits.length === 0 ? (
            <div className="bg-white border border-as-gray-200 rounded-2xl p-12 text-center">
              <p className="text-as-gray-500">Ni vnosov za ta dan.</p>
            </div>
          ) : (
            <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-as-gray-700 mb-4">🕐 Časovnica dneva</h3>
              <div className="space-y-3">
                {dayVisits.map((v, idx) => {
                  // Razdalja od prejšnjega vnosa
                  const prevWithKm = dayVisits.slice(0, idx).reverse().find((x) => x.odometer_km != null);
                  const segmentKm = (v.odometer_km != null && prevWithKm) ? v.odometer_km - prevWithKm.odometer_km : null;

                  return (
                    <div key={v.id}>
                      {segmentKm != null && segmentKm > 0 && (
                        <div className="ml-12 my-1 flex items-center gap-2 text-xs text-as-gray-500">
                          <Car className="w-3 h-3" />
                          <span className="italic">{segmentKm} km vožnje</span>
                        </div>
                      )}
                      <VisitTimelineCard
                        visit={v}
                        isAdmin={isAdmin}
                        currentUser={currentUser}
                        onDelete={() => handleDelete(v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VisitTimelineCard({ visit, isAdmin, currentUser, onDelete }) {
  const [open, setOpen] = useState(false);
  const canDelete = isAdmin || (visit.created_by === currentUser?.email && !isLocked(visit.visit_date, visit.created_by, currentUser?.email, isAdmin));

  let icon, color, bg, label, timeStr;
  if (visit.entry_type === 'home_start') {
    icon = '🏠';
    color = '#1E40AF';
    bg = '#DBEAFE';
    label = `Začetek dneva doma`;
    timeStr = formatTime(visit.departure_time);
  } else if (visit.entry_type === 'home_end') {
    icon = '🏠';
    color = '#065F46';
    bg = '#A7F3D0';
    label = `Konec dneva doma`;
    timeStr = formatTime(visit.arrival_time);
  } else if (visit.entry_type === 'call') {
    icon = visit.channel === 'email' ? '✉️' : '📞';
    color = '#6D28D9';
    bg = '#EDE9FE';
    label = visit.customer_name || '(brez imena)';
    timeStr = formatTime(visit.arrival_time);
  } else {
    icon = '📍';
    color = CRM_COLOR;
    bg = CRM_BG;
    label = visit.customer_name || '(brez imena)';
    timeStr = `${formatTime(visit.arrival_time)}${visit.departure_time ? ' – ' + formatTime(visit.departure_time) : ''}`;
  }

  const duration = visit.entry_type === 'visit' && visit.arrival_time && visit.departure_time
    ? diffMinutes(visit.arrival_time, visit.departure_time)
    : null;

  return (
    <div className="border border-as-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3" style={{ background: bg + '40' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg" style={{ background: bg, color }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-as-gray-700">{label}</div>
          <div className="text-xs text-as-gray-500 flex items-center gap-3 flex-wrap mt-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeStr}</span>
            {visit.odometer_km != null && <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {formatNumber(visit.odometer_km)} km</span>}
            {duration != null && duration >= 0 && <span className="font-semibold" style={{ color: '#0E7490' }}>{formatMinutes(duration)} pri stranki</span>}
            {visit.entry_type === 'call' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                {visit.channel === 'email' ? '✉️ Email' : '📞 Klic'}{visit.channel === 'phone' && visit.call_duration_min != null ? ` · ${formatMinutes(visit.call_duration_min)}` : ''}
              </span>
            )}
            {visit.outcome === 'narocilo' && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DCFCE7', color: '#16A34A' }}>✓ Naročilo</span>}
            {visit.outcome === 'ponudba' && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF3C7', color: '#D97706' }}>Ponudba</span>}
            {visit.create_offer && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF3C7', color: '#854D0E' }}>
                📝 Naloga
              </span>
            )}
            {visit.notify_responsible && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                📧 {visit.responsible_name || visit.responsible_email}
              </span>
            )}
          </div>
        </div>
        {(visit.notes || visit.customer_address || visit.offer_description) && (
          <button onClick={() => setOpen((o) => !o)} className="p-2 hover:bg-white rounded transition text-as-gray-400">
            {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} className="p-2 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      {open && (
        <div className="p-4 border-t border-as-gray-100 space-y-3 text-sm">
          {visit.customer_address && (
            <div>
              <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Naslov</div>
              <div className="text-as-gray-700">{visit.customer_address}</div>
            </div>
          )}
          {visit.notes && (
            <div>
              <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Dogovori</div>
              <div className="text-as-gray-700 whitespace-pre-wrap">{visit.notes}</div>
            </div>
          )}
          {visit.create_offer && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">📝 Ponudba</div>
              <div className="text-sm text-as-gray-700 whitespace-pre-wrap">{visit.offer_description}</div>
              <div className="text-xs text-as-gray-500 mt-2">
                Dodeljeno: <strong>{visit.offer_assigned_to_email}</strong> · Rok: <strong>{formatDate(visit.offer_due_date)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MONTHLY VIEW ───
function MonthlyView({ visits, loading }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('crm-controls-slot'));
  }, []);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthVisits = visits.filter((v) => v.visit_date?.startsWith(monthStr));

  // Skupaj statistike
  const totalVisits = monthVisits.filter((v) => v.entry_type === 'visit').length;
  const totalCalls = monthVisits.filter((v) => v.entry_type === 'call').length;
  const totalOffers = monthVisits.filter((v) => (v.entry_type === 'visit' || v.entry_type === 'call') && v.create_offer).length;
  const uniqueDays = new Set(monthVisits.map((v) => v.visit_date)).size;
  const uniqueCustomers = new Set(monthVisits.filter((v) => v.entry_type === 'visit' || v.entry_type === 'call').map((v) => v.customer_name)).size;

  // Skupna kilometrina (po dnevih)
  const totalKm = useMemo(() => {
    const byDay = {};
    monthVisits.forEach((v) => {
      if (!byDay[v.visit_date]) byDay[v.visit_date] = [];
      byDay[v.visit_date].push(v);
    });
    let sum = 0;
    Object.values(byDay).forEach((dayVisits) => {
      const sorted = [...dayVisits].sort((a, b) => {
        const order = { home_start: 0, visit: 1, home_end: 2 };
        const ao = order[a.entry_type] ?? 1;
        const bo = order[b.entry_type] ?? 1;
        if (ao !== bo) return ao - bo;
        return (a.arrival_time || a.departure_time || '00:00').localeCompare(b.arrival_time || b.departure_time || '00:00');
      });
      const withKm = sorted.filter((v) => v.odometer_km != null);
      if (withKm.length >= 2) {
        const dayKm = withKm[withKm.length - 1].odometer_km - withKm[0].odometer_km;
        if (dayKm > 0) sum += dayKm;
      }
    });
    return sum;
  }, [monthVisits]);

  // Top stranke
  const topCustomers = useMemo(() => {
    const map = {};
    monthVisits.filter((v) => v.entry_type === 'visit' && v.customer_name).forEach((v) => {
      const key = v.customer_name.trim();
      if (!map[key]) map[key] = { name: key, count: 0, offers: 0 };
      map[key].count += 1;
      if (v.create_offer) map[key].offers += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [monthVisits]);

  // Po dnevih
  const byDay = useMemo(() => {
    const map = {};
    monthVisits.forEach((v) => {
      if (!map[v.visit_date]) map[v.visit_date] = { date: v.visit_date, visits: 0, offers: 0, kmStart: null, kmEnd: null };
      if (v.entry_type === 'visit') {
        map[v.visit_date].visits += 1;
        if (v.create_offer) map[v.visit_date].offers += 1;
      }
      if (v.odometer_km != null) {
        if (map[v.visit_date].kmStart == null || v.odometer_km < map[v.visit_date].kmStart) {
          map[v.visit_date].kmStart = v.odometer_km;
        }
        if (map[v.visit_date].kmEnd == null || v.odometer_km > map[v.visit_date].kmEnd) {
          map[v.visit_date].kmEnd = v.odometer_km;
        }
      }
    });
    return Object.values(map).map((d) => ({
      ...d,
      km: (d.kmStart != null && d.kmEnd != null) ? d.kmEnd - d.kmStart : null,
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthVisits]);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button
        onClick={() => exportMonthlyCSV(year, month, byDay, topCustomers)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> CSV
      </button>
    </>
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <BigStat icon="📍" label="Obiski" value={totalVisits} unit="" color={CRM_COLOR} bgColor={CRM_BG} />
            <BigStat icon="📞" label="Klici / emaili" value={totalCalls} unit="" color="#6D28D9" bgColor="#EDE9FE" />
            <BigStat icon="🚗" label="Skupaj km" value={formatNumber(totalKm)} unit="km" color="#1E40AF" bgColor="#DBEAFE" />
            <BigStat icon="📝" label="Ponudbe" value={totalOffers} unit="" color="#854D0E" bgColor="#FEF3C7" />
            <BigStat icon="🏢" label="Strank" value={uniqueCustomers} unit="" color="#065F46" bgColor="#A7F3D0" />
            <BigStat icon="📅" label="Aktivnih dni" value={uniqueDays} unit="" color="#0E7490" bgColor="#CFFAFE" />
          </div>

          {/* Top stranke */}
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">🏆 Top stranke — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {topCustomers.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {topCustomers.map((c) => {
                  const max = Math.max(...topCustomers.map((x) => x.count), 1);
                  const pct = (c.count / max) * 100;
                  return (
                    <div key={c.name} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-4 text-as-gray-700 truncate" title={c.name}>{c.name}</div>
                      <div className="col-span-6 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: CRM_COLOR }} />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-as-gray-700">
                        {c.count}× {c.offers > 0 && <span className="text-xs text-amber-600">({c.offers} pon.)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Po dnevih */}
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">📅 Po dnevih</h3>
            {byDay.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-right p-2">Obiskov</th>
                      <th className="text-right p-2">Ponudb</th>
                      <th className="text-right p-2">Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((d) => (
                      <tr key={d.date} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                        <td className="p-2 font-semibold">{formatDate(d.date)}</td>
                        <td className="p-2 text-right">{d.visits}</td>
                        <td className="p-2 text-right">{d.offers > 0 ? <strong>{d.offers}</strong> : '—'}</td>
                        <td className="p-2 text-right">{d.km != null ? formatNumber(d.km) + ' km' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BUILDING BLOCKS ───
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider leading-tight">{label}</div>
      </div>
      <div>
        <span className="text-2xl sm:text-3xl font-bold text-as-gray-700">{value}</span>
        {unit && <span className="text-sm text-as-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SubmitBtn({ loading, color, label }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full sm:w-auto justify-center px-6 py-3.5 text-white text-base font-semibold rounded-xl shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50 active:scale-[0.99]"
      style={{ background: color }}>
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
      {label}
    </button>
  );
}

function Empty() {
  return <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>;
}

function LoadingBox() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
      <span className="ml-2 text-as-gray-500">Nalagam...</span>
    </div>
  );
}

const inputCls = "w-full px-3 py-3 border border-as-gray-200 rounded-xl bg-white text-base focus:outline-none focus:border-as-red-600 focus:ring-2 focus:ring-red-100 disabled:bg-as-gray-50 disabled:text-as-gray-400";

// ─── CSV EXPORT ───
function exportDailyCSV(date, visits, kmData) {
  const lines = [];
  lines.push(`Dnevno poročilo CRM - ${date}`);
  lines.push('');
  lines.push(`Skupaj km: ${kmData.totalKm}`);
  lines.push('');
  lines.push('Tip;Čas prihoda;Čas odhoda;Km števec;Stranka;Naslov;Dogovori;Ponudba?;Opis ponudbe;Dodeljeno;Rok ponudbe');
  visits.forEach((v) => {
    const tip = v.entry_type === 'home_start' ? 'Začetek doma' : v.entry_type === 'home_end' ? 'Konec doma' : v.entry_type === 'call' ? (v.channel === 'email' ? 'Email' : 'Klic') : 'Obisk';
    lines.push([
      tip,
      v.arrival_time || '',
      v.departure_time || '',
      v.odometer_km ?? '',
      (v.customer_name || '').replace(/[\r\n;]/g, ' '),
      (v.customer_address || '').replace(/[\r\n;]/g, ' '),
      (v.notes || '').replace(/[\r\n;]/g, ' '),
      v.create_offer ? 'DA' : '',
      (v.offer_description || '').replace(/[\r\n;]/g, ' '),
      v.offer_assigned_to_email || '',
      v.offer_due_date || '',
    ].join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMonthlyCSV(year, month, byDay, topCustomers) {
  const lines = [];
  lines.push(`Mesečno poročilo CRM - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PO DNEVIH');
  lines.push('Datum;Obiskov;Ponudb;Km');
  byDay.forEach((d) => {
    lines.push(`${d.date};${d.visits};${d.offers};${d.km ?? ''}`);
  });
  lines.push('');

  lines.push('TOP STRANKE');
  lines.push('Stranka;Obiskov;Ponudb');
  topCustomers.forEach((c) => lines.push(`${c.name};${c.count};${c.offers}`));

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── IZBIRA STRANKE (iskalni dropdown nad crm_customers) ───
function CustomerPicker({ selected, onSelect, onClear }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [branches, setBranches] = useState([]);
  // Dodajanje nove stranke
  const [adding, setAdding] = useState(false);
  const [nNaziv, setNNaziv] = useState('');
  const [nUlica, setNUlica] = useState('');
  const [nPosta, setNPosta] = useState('');
  const [nDavcna, setNDavcna] = useState('');
  const [nPanoga, setNPanoga] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addErr, setAddErr] = useState('');

  function startAdd() {
    setNNaziv(q.trim());
    setNUlica(''); setNPosta(''); setNDavcna(''); setNPanoga('');
    setAddErr('');
    setOpen(false);
    setAdding(true);
  }

  async function saveNewCustomer() {
    const naziv = nNaziv.trim();
    if (!naziv) { setAddErr('Vnesi naziv stranke.'); return; }
    setSavingNew(true); setAddErr('');
    try {
      const davcna = nDavcna.trim() || null;
      if (davcna) {
        const { data: ex } = await supabase
          .from('crm_customers')
          .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
          .eq('davcna', davcna)
          .order('poslovalnica', { ascending: true })
          .limit(1);
        if (ex && ex.length > 0) { setAdding(false); onSelect(ex[0]); return; }
      }
      const { data, error } = await supabase
        .from('crm_customers')
        .insert([{
          naziv,
          ulica: nUlica.trim() || null,
          posta: nPosta.trim() || null,
          davcna,
          panoga: nPanoga.trim() || null,
          poslovalnica: 0,
        }])
        .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
        .single();
      if (error) throw error;
      setAdding(false);
      onSelect(data);
    } catch (e) {
      setAddErr(e.message || 'Napaka pri shranjevanju stranke.');
    } finally {
      setSavingNew(false);
    }
  }

  useEffect(() => {
    if (selected || chosen) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const safe = term.replace(/[(),%]/g, ' ').trim();
      const pat = `%${safe}%`;
      const { data } = await supabase
        .from('crm_customers')
        .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
        .or(`naziv.ilike.${pat},ulica.ilike.${pat},posta.ilike.${pat},davcna.ilike.${pat}`)
        .order('poslovalnica', { ascending: true })
        .limit(200);
      const map = {};
      (data || []).forEach((c) => {
        const key = (c.davcna && String(c.davcna).trim()) ? `d:${c.davcna}` : `id:${c.id}`;
        if (!map[key]) map[key] = { key, davcna: c.davcna || null, naziv: c.naziv, panoga: c.panoga, sampleId: c.id, count: 0 };
        map[key].count += 1;
        if (c.poslovalnica === 0) map[key].naziv = c.naziv;
      });
      const arr = Object.values(map).sort((a, b) => a.naziv.localeCompare(b.naziv)).slice(0, 30);
      if (active) { setResults(arr); setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q, selected, chosen]);

  async function chooseCustomer(cust) {
    setOpen(false);
    let qy = supabase.from('crm_customers').select('id,naziv,ulica,posta,davcna,panoga,poslovalnica');
    qy = cust.davcna ? qy.eq('davcna', cust.davcna) : qy.eq('id', cust.sampleId);
    const { data } = await qy.order('poslovalnica', { ascending: true });
    const list = data || [];
    if (list.length <= 1) { onSelect(list[0] || null); return; }
    setChosen(cust);
    setBranches(list);
  }

  function resetAll() { setChosen(null); setBranches([]); setQ(''); setResults([]); onClear(); }

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-3 border border-as-gray-200 rounded-xl p-3 bg-as-gray-50">
        <div className="text-sm">
          <div className="font-bold text-as-gray-800">{selected.naziv}</div>
          <div className="text-as-gray-500">{selected.poslovalnica ? `Posl. ${selected.poslovalnica} · ` : ''}{[selected.ulica, selected.posta].filter(Boolean).join(', ') || '—'}</div>
          <div className="text-xs text-as-gray-400 mt-0.5">Davčna: {selected.davcna || '—'} · Panoga: {selected.panoga || '—'}</div>
        </div>
        <button type="button" onClick={resetAll} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold whitespace-nowrap">Zamenjaj</button>
      </div>
    );
  }

  if (chosen) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-as-gray-800">{chosen.naziv}</div>
          <button type="button" onClick={() => { setChosen(null); setBranches([]); }} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold whitespace-nowrap">Druga stranka</button>
        </div>
        <select className={inputCls} defaultValue="" onChange={(e) => { const b = branches.find((x) => String(x.id) === e.target.value); if (b) onSelect(b); }}>
          <option value="" disabled>— izberi poslovalnico ({branches.length}) —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.poslovalnica != null ? `Posl. ${b.poslovalnica} — ` : ''}{[b.ulica, b.posta].filter(Boolean).join(', ')}</option>
          ))}
        </select>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="border border-as-gray-200 rounded-xl p-4 bg-as-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-as-gray-800">➕ Nova stranka</div>
          <button type="button" onClick={() => setAdding(false)} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold">Prekliči</button>
        </div>
        {addErr && <div className="text-xs text-red-600">{addErr}</div>}
        <div>
          <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Naziv *</label>
          <input type="text" value={nNaziv} onChange={(e) => setNNaziv(e.target.value)} className={inputCls} placeholder="Naziv stranke" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Ulica</label>
            <input type="text" value={nUlica} onChange={(e) => setNUlica(e.target.value)} className={inputCls} placeholder="Ulica in hišna št." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Pošta</label>
            <input type="text" value={nPosta} onChange={(e) => setNPosta(e.target.value)} className={inputCls} placeholder="npr. 3000 Celje" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Davčna</label>
            <input type="text" value={nDavcna} onChange={(e) => setNDavcna(e.target.value)} className={inputCls} placeholder="brez SI" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Panoga</label>
            <input type="text" value={nPanoga} onChange={(e) => setNPanoga(e.target.value)} className={inputCls} placeholder="neobvezno" />
          </div>
        </div>
        <button type="button" onClick={saveNewCustomer} disabled={savingNew}
          className="w-full sm:w-auto justify-center px-4 py-3 text-white text-base font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>
          {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Shrani stranko in izberi
        </button>
        <p className="text-xs text-as-gray-400">Če davčna že obstaja, se izbere obstoječa stranka (brez podvajanja).</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        className={inputCls} placeholder="Išči stranko po nazivu, naslovu ali davčni (min. 2 znaka)..." />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-as-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-as-gray-400">Iščem…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-sm text-as-gray-400">Ni zadetkov.</div>}
          {results.map((c) => (
            <button key={c.key} type="button" onClick={() => chooseCustomer(c)}
              className="w-full text-left px-3 py-3 hover:bg-as-gray-50 border-b border-as-gray-100 last:border-0">
              <div className="text-sm font-semibold text-as-gray-800">{c.naziv}</div>
              <div className="text-xs text-as-gray-500">{c.davcna ? `Davčna ${c.davcna}` : ''}{c.count > 1 ? ` · ${c.count} poslovalnic` : ''} · {c.panoga || '—'}</div>
            </button>
          ))}
          {!loading && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={startAdd}
              className="w-full text-left px-3 py-3 hover:bg-orange-50 border-t border-as-gray-200 text-sm font-semibold flex items-center gap-2" style={{ color: CRM_COLOR }}>
              <Plus className="w-4 h-4" /> Dodaj novo stranko{q.trim() ? `: "${q.trim()}"` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── IZBIRA IZIDA (Naročilo / Ponudba / Nič) ───
function OutcomePicker({ value, onChange }) {
  const opts = [
    { id: 'narocilo', label: 'Naročilo', color: '#16A34A', bg: '#DCFCE7' },
    { id: 'ponudba', label: 'Ponudba', color: '#D97706', bg: '#FEF3C7' },
    { id: 'nic', label: 'Nič', color: '#6B7280', bg: '#F3F4F6' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className="flex-1 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: active ? o.color : '#E5E7EB', background: active ? o.bg : '#fff', color: active ? o.color : '#6B7280' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── ANALIZA PO STRANKAH (z zgodovino vsake stranke) ───
function AnalysisView({ visits, loading }) {
  const [q, setQ] = useState('');
  const [custMap, setCustMap] = useState({});
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    const ids = [...new Set((visits || []).map((v) => v.customer_id).filter(Boolean))];
    if (ids.length === 0) { setCustMap({}); return; }
    let active = true;
    (async () => {
      const map = {};
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase.from('crm_customers').select('id,naziv,panoga,ulica,posta,davcna').in('id', chunk);
        (data || []).forEach((c) => { map[c.id] = c; });
      }
      if (active) setCustMap(map);
    })();
    return () => { active = false; };
  }, [visits]);

  const rows = useMemo(() => {
    const g = {};
    for (const v of (visits || [])) {
      if (v.entry_type !== 'visit' && v.entry_type !== 'call') continue;
      const cust = v.customer_id ? custMap[v.customer_id] : null;
      const key = (cust && cust.davcna) ? `d:${cust.davcna}` : (v.customer_id ? `id:${v.customer_id}` : `n:${(v.customer_name || '—').toLowerCase()}`);
      if (!g[key]) g[key] = { key, naziv: cust?.naziv || v.customer_name || '—', panoga: cust?.panoga || '—', kontakti: 0, minutes: 0, narocila: 0, ponudbe: 0, zadnji: null, entries: [] };
      const r = g[key];
      if (cust?.naziv) r.naziv = cust.naziv;
      if (cust?.panoga) r.panoga = cust.panoga;
      r.kontakti += 1;
      r.minutes += Number(v.visit_duration_min || v.call_duration_min || diffMinutes(v.arrival_time, v.departure_time) || 0);
      if (v.outcome === 'narocilo') r.narocila += 1;
      else if (v.outcome === 'ponudba') r.ponudbe += 1;
      else if (v.create_offer && !v.outcome) r.ponudbe += 1;
      if (!r.zadnji || (v.visit_date && v.visit_date > r.zadnji)) r.zadnji = v.visit_date;
      r.entries.push(v);
    }
    let arr = Object.values(g);
    arr.forEach((r) => r.entries.sort((a, b) => {
      const d = (b.visit_date || '').localeCompare(a.visit_date || '');
      if (d !== 0) return d;
      return (b.arrival_time || '').localeCompare(a.arrival_time || '');
    }));
    const term = q.trim().toLowerCase();
    if (term) arr = arr.filter((r) => r.naziv.toLowerCase().includes(term) || (r.panoga || '').toLowerCase().includes(term));
    arr.sort((a, b) => b.kontakti - a.kontakti || b.minutes - a.minutes);
    return arr;
  }, [visits, custMap, q]);

  const totals = useMemo(() => rows.reduce((a, r) => {
    a.kontakti += r.kontakti; a.minutes += r.minutes; a.narocila += r.narocila; a.ponudbe += r.ponudbe;
    return a;
  }, { kontakti: 0, minutes: 0, narocila: 0, ponudbe: 0 }), [rows]);

  if (loading) return <div className="text-center py-10 text-as-gray-400">Nalagam…</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Strank z aktivnostjo</div><div className="text-2xl font-bold text-as-gray-700 mt-1">{rows.length}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Skupaj kontaktov</div><div className="text-2xl font-bold text-as-gray-700 mt-1">{totals.kontakti}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Naročila</div><div className="text-2xl font-bold mt-1" style={{ color: '#16A34A' }}>{totals.narocila}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Ponudbe</div><div className="text-2xl font-bold mt-1" style={{ color: '#D97706' }}>{totals.ponudbe}</div></div>
      </div>

      <div className="bg-white border border-as-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-bold text-as-gray-700">👤 Stranke — klikni za zgodovino</h3>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Išči stranko ali panogo…" className={inputCls + ' max-w-xs'} />
        </div>
        {rows.length === 0 ? (
          <div className="text-center py-8 text-as-gray-400 text-sm">Ni podatkov. Vnosi z izbrano stranko se bodo prikazali tukaj.</div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const naroca = r.narocila > 0;
              const ponudbeBrez = r.ponudbe > 0 && r.narocila === 0;
              const badge = naroca
                ? { t: 'Naroča', c: '#16A34A', b: '#DCFCE7' }
                : ponudbeBrez
                  ? { t: 'Ponudbe, brez naročila', c: '#DC2626', b: '#FEE2E2' }
                  : { t: 'Brez izida', c: '#6B7280', b: '#F3F4F6' };
              const isOpen = openKey === r.key;
              return (
                <div key={r.key} className="border border-as-gray-200 rounded-xl overflow-hidden">
                  {/* Glava stranke */}
                  <button type="button" onClick={() => setOpenKey(isOpen ? null : r.key)}
                    className="w-full text-left p-4 hover:bg-as-gray-50 transition flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-as-gray-800">{r.naziv}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: badge.c, background: badge.b }}>{badge.t}</span>
                      </div>
                      <div className="text-xs text-as-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>📞 {r.kontakti} kontaktov</span>
                        <span>⏱️ {(r.minutes / 60).toFixed(1)} h</span>
                        <span style={{ color: r.narocila > 0 ? '#16A34A' : undefined }}>✓ {r.narocila} naročil</span>
                        <span style={{ color: r.ponudbe > 0 ? '#D97706' : undefined }}>📝 {r.ponudbe} ponudb</span>
                        <span>🗓️ zadnji: {r.zadnji ? formatDate(r.zadnji) : '—'}</span>
                        {r.panoga && r.panoga !== '—' && <span className="text-as-gray-400">{r.panoga}</span>}
                      </div>
                    </div>
                    <div className="text-as-gray-400 flex-shrink-0 mt-0.5">
                      {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </button>

                  {/* Zgodovina stranke */}
                  {isOpen && (
                    <div className="border-t border-as-gray-100 bg-as-gray-50/50 p-3 sm:p-4 space-y-2">
                      <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Zgodovina ({r.entries.length})</div>
                      {r.entries.map((e) => {
                        const isCall = e.entry_type === 'call';
                        const eIcon = isCall ? (e.channel === 'email' ? '✉️' : '📞') : '📍';
                        const dur = isCall
                          ? (e.call_duration_min != null ? e.call_duration_min : null)
                          : diffMinutes(e.arrival_time, e.departure_time);
                        const oc = e.outcome === 'narocilo'
                          ? { t: 'Naročilo', c: '#16A34A', b: '#DCFCE7' }
                          : e.outcome === 'ponudba'
                            ? { t: 'Ponudba', c: '#D97706', b: '#FEF3C7' }
                            : null;
                        return (
                          <div key={e.id} className="bg-white border border-as-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-lg flex-shrink-0">{eIcon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-sm">
                                  <span className="font-semibold text-as-gray-800">{formatDate(e.visit_date)}</span>
                                  <span className="text-as-gray-500 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatTime(e.arrival_time)}{e.departure_time ? ' – ' + formatTime(e.departure_time) : ''}
                                  </span>
                                  {dur != null && dur >= 0 && <span className="text-xs font-semibold" style={{ color: '#0E7490' }}>{formatMinutes(dur)}</span>}
                                  {oc && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: oc.c, background: oc.b }}>{oc.t}</span>}
                                  {e.create_offer && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: '#854D0E', background: '#FEF3C7' }}>📝 Naloga</span>}
                                </div>
                                {e.notes && <div className="text-sm text-as-gray-600 mt-1.5 whitespace-pre-wrap">{e.notes}</div>}
                                {e.offer_description && (
                                  <div className="text-xs text-as-gray-500 mt-1.5 bg-yellow-50 border border-yellow-200 rounded p-2">
                                    <strong>Ponudba:</strong> {e.offer_description}
                                    {e.offer_due_date && <> · rok {formatDate(e.offer_due_date)}</>}
                                  </div>
                                )}
                                <div className="text-xs text-as-gray-400 mt-1">Vnesel: {e.created_by_name || e.created_by || '—'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
