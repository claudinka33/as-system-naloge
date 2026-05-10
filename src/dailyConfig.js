// =====================================
// KONFIGURACIJA DNEVNIH VNOSOV
// =====================================
// Dnevna polja so PODSKUPINA tedenskih polj.
// Ko klikne PETKOV gumb, sistem:
//   - SEŠTEJE vsa številska polja po ključu
//   - ZLEPI vsa tekstovna polja po dnevih ("Pon: ... | Tor: ...")
// =====================================

import { REPORT_TEMPLATES } from './reportsConfig.js';

// Vrne dnevna polja za določen oddelek
// (Ista polja kot tedenska, samo brez group_header)
export function getDailyFields(department) {
  const template = REPORT_TEMPLATES[department];
  if (!template) return [];
  
  return template.fields.filter(f => f.type !== 'group_header');
}

// Združi dnevne vnose v en tedenski objekt
// numbers → seštevek
// text → po dnevih zlepljen
export function aggregateDailyToWeekly(department, dailyEntries) {
  const fields = getDailyFields(department);
  const result = {};
  
  // Sortiraj dnevne vnose po datumu
  const sorted = [...dailyEntries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
  
  fields.forEach(field => {
    if (field.type === 'number') {
      // Seštej vse vrednosti
      let sum = 0;
      sorted.forEach(entry => {
        const val = parseFloat(entry.content?.[field.key]);
        if (!isNaN(val)) sum += val;
      });
      result[field.key] = sum > 0 ? String(sum) : '';
    } else if (field.type === 'textarea' || field.type === 'text') {
      // Zlepit po dnevih: "Pon (5.5.): besedilo | Tor (6.5.): besedilo"
      const parts = [];
      sorted.forEach(entry => {
        const val = entry.content?.[field.key];
        if (val && val.trim() !== '') {
          const date = new Date(entry.entry_date);
          const dayName = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'][date.getDay()];
          const dateStr = `${date.getDate()}.${date.getMonth() + 1}.`;
          parts.push(`${dayName} (${dateStr}): ${val.trim()}`);
        }
      });
      result[field.key] = parts.join('\n\n');
    }
  });
  
  return result;
}

// Pomožne funkcije za delo z datumi
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  const days = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
  return `${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

// Ali je danes petek po 15h? (za prikaz gumba "Generiraj tedensko")
export function isFridayAfter3PM() {
  const now = new Date();
  const day = now.getDay(); // 0=Ned, 5=Pet, 6=Sob
  const hour = now.getHours();
  
  // Petek od 15h naprej, ali sobota, ali nedelja
  if (day === 5 && hour >= 15) return true;
  if (day === 6) return true;
  if (day === 0) return true;
  return false;
}

// Pridobi trenutni delovni teden (Pon-Pet)
export function getCurrentWeekDates() {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  
  const dates = [];
  for (let i = 0; i < 7; i++) { // Pon - Ned
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}
