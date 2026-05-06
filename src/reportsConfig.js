// =====================================
// KONFIGURACIJA POROČIL PO ODDELKIH
// =====================================

// Definicija polj za vsak oddelek
export const REPORT_TEMPLATES = {
  proizvodnja: {
    name: 'Proizvodnja',
    icon: '🏭',
    color: '#0E7490', // teal-700
    bgColor: '#CFFAFE', // cyan-100
    fields: [
      { key: 'completed_orders', label: 'Število izvedenih nalogov', type: 'number', placeholder: 'npr. 25' },
      { key: 'open_orders', label: 'Število odprtih nalogov', type: 'number', placeholder: 'npr. 8' },
      { key: 'delays', label: 'Zamude (zakaj?)', type: 'textarea', placeholder: 'Opišite vzroke zamud, če so se pojavile...' },
      { key: 'breakdowns', label: 'Okvare (kaj, koliko, zakaj)', type: 'textarea', placeholder: 'Opišite okvare strojev, vzroke...' },
      { key: 'spare_parts', label: 'Poraba rezervnih delov', type: 'textarea', placeholder: 'Kateri rezervni deli so bili porabljeni...' },
      { key: 'complaints', label: 'Reklamacije / napake', type: 'textarea', placeholder: 'Število in opis reklamacij, napak v proizvodnji...' },
    ]
  },
  
  montaza: {
    name: 'Montaža',
    icon: '🔧',
    color: '#7C2D12', // orange-900
    bgColor: '#FED7AA', // orange-200
    fields: [
      { key: 'completed_orders', label: 'Število izvedenih nalogov', type: 'number', placeholder: 'npr. 18' },
      { key: 'open_orders', label: 'Število odprtih nalogov', type: 'number', placeholder: 'npr. 5' },
      { key: 'delays', label: 'Zamude (zakaj?)', type: 'textarea', placeholder: 'Opišite vzroke zamud...' },
      { key: 'breakdowns', label: 'Okvare (kaj, koliko, zakaj)', type: 'textarea', placeholder: 'Opišite okvare strojev za montažo...' },
      { key: 'spare_parts', label: 'Poraba rezervnih delov', type: 'textarea', placeholder: 'Kateri rezervni deli so bili porabljeni...' },
      { key: 'complaints', label: 'Reklamacije / napake', type: 'textarea', placeholder: 'Število in opis reklamacij...' },
    ]
  },
  
  nabava: {
    name: 'Nabava',
    icon: '📦',
    color: '#5B21B6', // violet-800
    bgColor: '#DDD6FE', // violet-200
    fields: [
      { key: 'order_count', label: 'Koliko naročilnic', type: 'number', placeholder: 'npr. 12' },
      { key: 'suppliers', label: 'Komu (dobaviteljem)', type: 'textarea', placeholder: 'Naštej dobavitelje, ki so prejeli naročila...' },
      { key: 'order_value', label: 'Vrednosti naročil + kontakti z dobavitelji', type: 'textarea', placeholder: 'Skupna vrednost naročil, koliko kontaktov...' },
      { key: 'negotiated', label: 'Kaj je bilo izpogajano', type: 'textarea', placeholder: 'Popusti, plačilni roki, dobavni roki, drugi pogoji...' },
      { key: 'new_suppliers', label: 'Novi dobavitelji (koliko, kdo, rezultat)', type: 'textarea', placeholder: 'Imena novih dobaviteljev, status sodelovanja...' },
    ]
  },
  
  prodaja: {
    name: 'Prodaja',
    icon: '💼',
    color: '#C8102E', // AS red
    bgColor: '#FEE2E2', // red-100
    fields: [
      { key: 'calls', label: 'Klici (stari / novi kupci)', type: 'textarea', placeholder: 'Število klicev, razdelitev na obstoječe in nove kupce...' },
      { key: 'visits', label: 'Obiski (kupci, sejmi, predstavitve)', type: 'textarea', placeholder: 'Koga ste obiskali, kje, namen...' },
      { key: 'offers', label: 'Ponudbe', type: 'textarea', placeholder: 'Število pripravljenih ponudb, komu...' },
      { key: 'pipeline', label: 'Realizacija pipeline (kaj pričakujemo)', type: 'textarea', placeholder: 'Kateri posli so v zaključni fazi, pričakovana vrednost...' },
      { key: 'problems', label: 'Problemi (kje izgubljamo posle)', type: 'textarea', placeholder: 'Razlogi za izgubljene posle, ovire pri prodaji...' },
    ]
  },
  
  kakovost: {
    name: 'Kakovost',
    icon: '🔬',
    color: '#065F46', // emerald-800
    bgColor: '#A7F3D0', // emerald-200
    fields: [
      { key: 'inspections', label: 'Število pregledov / kontrol kakovosti', type: 'number', placeholder: 'npr. 45' },
      { key: 'defects_found', label: 'Število odkritih napak', type: 'number', placeholder: 'npr. 3' },
      { key: 'customer_complaints', label: 'Reklamacije od strank', type: 'textarea', placeholder: 'Opišite reklamacije, ki so prišle ta teden...' },
      { key: 'rejection_reasons', label: 'Razlogi za zavrnitev', type: 'textarea', placeholder: 'Kaj je bilo narobe pri zavrnjenih izdelkih...' },
      { key: 'process_improvements', label: 'Predlogi izboljšav procesov', type: 'textarea', placeholder: 'Vaši predlogi za boljšo kakovost...' },
      { key: 'supplier_quality', label: 'Sodelovanje z dobavitelji glede kakovosti', type: 'textarea', placeholder: 'Komunikacija, težave, izboljšave...' },
    ]
  },
  
  tehnolog: {
    name: 'Tehnolog',
    icon: '⚙️',
    color: '#1E40AF', // blue-800
    bgColor: '#BFDBFE', // blue-200
    fields: [
      { key: 'new_developments', label: 'Število novih razvojev / projektov', type: 'textarea', placeholder: 'Kateri projekti potekajo, status...' },
      { key: 'optimizations', label: 'Optimizacije obstoječih procesov', type: 'textarea', placeholder: 'Kaj ste izboljšali, prihranki časa/materiala...' },
      { key: 'technical_issues', label: 'Tehnične težave / izzivi tega tedna', type: 'textarea', placeholder: 'Opišite tehnične izzive in rešitve...' },
      { key: 'collaboration', label: 'Sodelovanje z drugimi oddelki', type: 'textarea', placeholder: 'S kom ste sodelovali, kakšen je bil rezultat...' },
      { key: 'machine_proposals', label: 'Predlogi za nove stroje / orodja', type: 'textarea', placeholder: 'Kaj potrebujemo, koliko stane, zakaj...' },
      { key: 'tooling_status', label: 'Status orodjarne (skladnost, vzdrževanje)', type: 'textarea', placeholder: 'Stanje orodij, potrebno vzdrževanje...' },
    ]
  },
  
  kadrovska: {
    name: 'Kadrovska',
    icon: '👥',
    color: '#831843', // pink-900
    bgColor: '#FBCFE8', // pink-200
    fields: [
      { key: 'employee_changes', label: 'Spremembe zaposlenih (nove zaposlitve / odhodi)', type: 'textarea', placeholder: 'Kdo se je zaposlil, kdo odhaja...' },
      { key: 'absences', label: 'Bolniške / odsotnosti tega tedna', type: 'textarea', placeholder: 'Število, razlogi, dolžina...' },
      { key: 'interviews', label: 'Izvedeni zaposlitveni razgovori', type: 'textarea', placeholder: 'Število razgovorov, status kandidatov...' },
      { key: 'trainings', label: 'Načrtovani treningi / izobraževanja', type: 'textarea', placeholder: 'Kateri tečaji, kdaj, za koga...' },
      { key: 'open_positions', label: 'Odprta delovna mesta', type: 'textarea', placeholder: 'Katera mesta iščemo, kako napreduje iskanje...' },
      { key: 'other', label: 'Drugo (dopusti, prazniki, konflikti, opombe)', type: 'textarea', placeholder: 'Vse ostalo, kar je vredno omeniti...' },
    ]
  },
};

// Mapiranje uporabnikov na oddelke (kdo lahko piše katero poročilo)
export const USER_DEPARTMENT_MAP = {
  'ales.seidl@as-system.si': 'admin', // Vidi VSA poročila
  'claudia.seidl@as-system.si': 'admin', // Vidi VSA poročila
  'alen.drofenik@as-system.si': ['nabava'],
  'tjasa.mihevc@as-system.si': ['prodaja'],
  'matija.marguc@as-system.si': ['prodaja'],
  'sara.jagodic@as-system.si': ['prodaja'],
  'cvetka.seidl@as-system.si': ['kadrovska'],
  'milena.jancic@as-system.si': ['montaza'],
  'gregor.koritnik@as-system.si': ['tehnolog'],
  'boris.cernelc@as-system.si': ['proizvodnja'],
  'kakovost@as-system.si': ['kakovost'],
  'zan.seidl@as-system.si': ['prodaja'],
  'feliks.zekar@as-system.si': [], // Skladišče - nima poročila zaenkrat
};

// Kateri oddelek lahko piše uporabnik
export function getUserDepartments(email) {
  const dept = USER_DEPARTMENT_MAP[email];
  if (!dept) return [];
  if (dept === 'admin') return Object.keys(REPORT_TEMPLATES); // Vsi oddelki
  return dept;
}

// Ali je uporabnik admin (vidi vsa poročila)
export function isReportsAdmin(email) {
  return USER_DEPARTMENT_MAP[email] === 'admin';
}

// Helper funkcije za delo s tedni
export function getCurrentWeekInfo() {
  const now = new Date();
  return getWeekInfo(now);
}

export function getWeekInfo(date) {
  const d = new Date(date);
  
  // ISO week: ponedeljek = 1, nedelja = 7
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  // Ponedeljek tega tedna
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  
  // Nedelja tega tedna
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    weekNumber,
    weekYear: d.getFullYear(),
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
    monday,
    sunday
  };
}

// Formatiranje tedna za prikaz
export function formatWeekRange(weekStart, weekEnd) {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  
  if (sameMonth && sameYear) {
    return `${start.getDate()}.-${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  } else if (sameYear) {
    return `${start.getDate()}.${start.getMonth() + 1}.-${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  } else {
    return `${start.getDate()}.${start.getMonth() + 1}.${start.getFullYear()}-${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
  }
}
