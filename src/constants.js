// Centralizirane konstante za AS system Naloge

// E-maili z dostopom do VSEH nalog (direktor + marketing + računovodstvo)
export const ADMIN_EMAILS = ['ales.seidl@as-system.si', 'claudia.seidl@as-system.si', 'sara.jagodic@as-system.si'];

// Pravi zaposleni AS system d.o.o. - vsak ima svoje unikatno geslo
export const EMPLOYEES = [
  { email: 'ales.seidl@as-system.si', username: 'ales.seidl', name: 'Aleš Seidl', department: 'Direktor', password: 'AS-direktor-93' },
  { email: 'alen.drofenik@as-system.si', username: 'alen.drofenik', name: 'Alen Drofenik', department: 'Nabava', password: 'Drofenik-AS-7' },
  { email: 'tjasa.mihevc@as-system.si', username: 'tjasa.mihevc', name: 'Tjaša Mihevc', department: 'Komerciala-Prodaja', password: 'Mihevc-prodaja12' },
  { email: 'prodaja.as@as-system.si', username: 'mitja.marguc', name: 'Mitja Marguč', department: 'Komerciala', password: 'Marguc-komerc44' },
  { email: 'sara.jagodic@as-system.si', username: 'sara.jagodic', name: 'Sara Jagodič', department: 'Računovodstvo', password: 'Jagoda0202' },
  { email: 'cvetka.seidl@as-system.si', username: 'cvetka.seidl', name: 'Cvetka Seidl', department: 'Kadrovska', password: 'Cvetka-kadri88' },
  { email: 'claudia.seidl@as-system.si', username: 'claudia.seidl', name: 'Claudia Seidl', department: 'Marketing', password: 'Klavdija-AS33' },
  { email: 'milena.jancic@as-system.si', username: 'milena.jancic', name: 'Milena Jančič', department: 'Montaža', password: 'Jancic-montaza5' },
  { email: 'gregor.koritnik@as-system.si', username: 'gregor.koritnik', name: 'Gregor Koritnik', department: 'Tehnolog', password: 'Koritnik-teh19' },
  { email: 'boris.cernelc@as-system.si', username: 'boris.cernelc', name: 'Boris Černelč', department: 'Proizvodnja', password: 'Cernelc-proi66' },
  { email: 'kakovost@as-system.si', username: 'kakovost', name: 'Mitja Babič', department: 'Kakovost', password: 'Babic-kakovo8' },
  { email: 'zan.seidl@as-system.si', username: 'zan.seidl', name: 'Žan Seidl', department: 'Komercialist', password: 'ZanS-komerc15' },
  { email: 'feliks.zekar@as-system.si', username: 'feliks.zekar', name: 'Feliks Žekar', department: 'Skladišče', password: 'Zekar-skladi77' },
];

export const DEPARTMENTS = [...new Set(EMPLOYEES.map(e => e.department))];

export const AREA_SUGGESTIONS = ['Prodaja', 'Nabava', 'Montaža', 'Proizvodnja', 'Skladišče', 'Marketing', 'Kakovost', 'Tehnolog', 'Kadrovska', 'Računovodstvo', 'Komerciala'];
