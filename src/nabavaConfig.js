// Nabava modul — config + access control
// Dostop: Alen Drofenik + admini (Aleš, Claudia, Sara)

export const NABAVA_ALLOWED_EMAILS = [
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
  'alen.drofenik@as-system.si'
];

export const NABAVA_ADMIN_EMAILS = [
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si'
];

export function canAccessNabava(userEmail) {
  if (!userEmail) return false;
  return NABAVA_ALLOWED_EMAILS.includes(userEmail.toLowerCase());
}

export function canManageNabava(userEmail) {
  // Samo admini lahko brišejo uvoze
  if (!userEmail) return false;
  return NABAVA_ADMIN_EMAILS.includes(userEmail.toLowerCase());
}

// Format EUR za prikaz
export function formatEUR(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) return '0 €';
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// Format število (količina)
export function formatNum(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('sl-SI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// Format datum SI
export function formatDateSI(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Mesečno ime
export const MONTH_NAMES_SI = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
  'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'
];

// VASCO Excel column mapping → DB field
export const VASCO_COLUMN_MAP = {
  'Datum': 'datum',
  'Dobavitelj': 'dobavitelj_id',
  'Dobavitelj naziv': 'dobavitelj',
  'Šifra': 'sifra',
  'Naziv': 'naziv',
  'Naziv2': 'naziv2',
  'Enota': 'enota',
  'Sk. artikla': 'sk_artikla',
  'Naz. skupine': 'naz_skupine',
  'Nabava': 'nabava',
  'Nabava vred.': 'nabava_vred',
  'Nab. vred. odv.': 'nab_vred_odv',
  'DDV': 'ddv',
  'Zadnja NC': 'zadnja_nc',
  'Zadnja vnešena NC': 'zadnja_vnesena_nc',
  'Info NC': 'info_nc',
  'Nadsk.': 'nadsk',
  'Naziv nadskupine': 'naziv_nadskupine'
};
