// Konfiguracija strojev po segmentih z normativi
// Vir: Borisov potrjeni seznam strojev z oznakami in normativi

export const SEGMENTS = [
  {
    id: 'VIJAKI',
    label: 'VIJAKI',
    color: '#C8102E',
    machines: [
      { id: '201', stroj: 'CARLO SALVI TP2C', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: 'IVER Z 4x12, OKNA 4x20' },
      { id: '202', stroj: 'CARLO SALVI TP2C', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: 'M4x8, M4x6.5, M4x10' },
      { id: '203', stroj: 'CARLO SALVI TP2CL', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: '4x15, 4x12, M4x8, M4x6.5, 3x40' },
      { id: '204', stroj: 'CARLO SALVI TP2C', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: '3.5x9, 5x8' },
      { id: '205', stroj: 'CARLO SALVI TP2C', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: '4x15, 4x12, 3.5x20' },
      { id: '206', stroj: 'CARLO SALVI TP2C', operacija: 'KOVANJE', normativ_min: 150, normativ_h: 9000, tipi: 'M4x8, M4x6.5, M4x10' },
      { id: '207', stroj: 'SACMA SP01', operacija: 'KOVANJE', normativ_min: 233, normativ_h: 14000, tipi: '4x15 PAN, 4x15, 4x12' },
      { id: '208', stroj: 'CHUN ZU CH-6L', operacija: 'KOVANJE', normativ_min: 210, normativ_h: 12600, tipi: 'SMREKCE DO 50MM' },
      { id: '209', stroj: 'CHUN ZU CH-6LL', operacija: 'KOVANJE', normativ_min: 210, normativ_h: 12600, tipi: 'SMREKCE DO 70MM' },
      { id: '212', stroj: 'CARLO SALVI INTC', operacija: 'KOVANJE', normativ_min: 133, normativ_h: 8000, tipi: 'M5x12.5, M5x15' },
      { id: '213-K', stroj: 'DAHLIAN DL-1.5T', operacija: 'KOVANJE', normativ_min: 142, normativ_h: 8500, tipi: '4.5x14.5' },
      { id: '214', stroj: 'DAHLIAN DL-1.5T X', operacija: 'KOVANJE', normativ_min: 130, normativ_h: 7800, tipi: '5x13.5' },
      { id: '215-K', stroj: 'DAHLIAN DL-1.5T', operacija: 'KOVANJE', normativ_min: 142, normativ_h: 8500, tipi: '4.5x14.5, 4x30, 3.5x20, OKNA 4x25' },
      { id: '211', stroj: 'CARLO SALVI INTCL', operacija: 'KOVANJE', normativ_min: 0, normativ_h: 0, tipi: '!V OKVARI!', vOkvari: true },
      { id: '213-V-CS', stroj: 'CARLO SALVI INTCL', operacija: 'KOVANJE', normativ_min: 0, normativ_h: 0, tipi: '!V OKVARI!', vOkvari: true },
      { id: '251', stroj: 'EWM GW52', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 30MM' },
      { id: '252', stroj: 'EWM GW52', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 30MM' },
      { id: '253', stroj: 'EWM GW52', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 30MM' },
      { id: '254', stroj: 'EWM GW52', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 30MM' },
      { id: '255', stroj: 'EWM GW62', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 50MM' },
      { id: '256', stroj: 'EWM GW62', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 50MM' },
      { id: '257', stroj: 'EWM GW62', operacija: 'VALJANJE', normativ_min: 133, normativ_h: 8000, tipi: 'VIJAKI DO L NAVOJA 50MM' },
      { id: '258', stroj: 'HANREZ ROLVY.O', operacija: 'VALJANJE', normativ_min: 333, normativ_h: 20000, tipi: 'METRIČNI VIJAKI DO L NAVOJA 30MM' },
      { id: '260', stroj: 'DAHLIAN DL-1.5I', operacija: 'VALJANJE', normativ_min: 150, normativ_h: 9000, tipi: '' },
      { id: '261', stroj: 'DAHLIAN DL-1.5I', operacija: 'VALJANJE', normativ_min: 150, normativ_h: 9000, tipi: '' },
      { id: '262', stroj: 'DAHLIAN DL-1.5I', operacija: 'VALJANJE', normativ_min: 150, normativ_h: 9000, tipi: '' },
      { id: '263', stroj: 'DAHLIAN DL-1.5I', operacija: 'VALJANJE', normativ_min: 150, normativ_h: 9000, tipi: '' },
      { id: '264', stroj: 'DAHLIAN DL-1.5I', operacija: 'VALJANJE', normativ_min: 150, normativ_h: 9000, tipi: '' },
      { id: '225', stroj: 'DAH LIAN-1606BL', operacija: 'ŠPIČENJE', normativ_min: 0, normativ_h: 0, tipi: '!ŠE NE OBRATUJE!', vOkvari: true },
    ],
  },
  {
    id: 'PINI',
    label: 'PINI',
    color: '#0066CC',
    machines: [
      { id: '101', stroj: 'JERN YAO JBF-7B2S', operacija: 'KOVANJE + VALJANJE', normativ_min: 240, normativ_h: 14400, tipi: 'PINI' },
      { id: '102', stroj: 'JERN YAO JBF-7B2S', operacija: 'KOVANJE + VALJANJE', normativ_min: 240, normativ_h: 14400, tipi: 'PINI' },
      { id: '103', stroj: 'JERN YAO JBF-7B2S', operacija: 'KOVANJE + VALJANJE', normativ_min: 240, normativ_h: 14400, tipi: 'PINI' },
      { id: '104', stroj: 'JERN YAO JBF-7B2S', operacija: 'KOVANJE + VALJANJE', normativ_min: 240, normativ_h: 14400, tipi: 'PINI' },
      { id: '105', stroj: 'JERN YAO JBF-7B2S', operacija: 'KOVANJE + VALJANJE', normativ_min: 240, normativ_h: 14400, tipi: 'PINI' },
    ],
  },
  {
    id: 'KOVANA_SIDRA',
    label: 'KOVANA SIDRA',
    color: '#F39C12',
    machines: [
      { id: '701', stroj: 'NEDSCHROEF NB416', operacija: 'KOVANJE + VALJANJE', normativ_min: 80, normativ_h: 4800, tipi: 'SIDRA M8-M16 L50-185MM' },
      { id: '702', stroj: 'NEDSCHROEF NB515', operacija: 'KOVANJE + VALJANJE', normativ_min: 105, normativ_h: 6300, tipi: 'SIDRA M8-M26 L50-150MM' },
    ],
  },
  {
    id: 'STRUZENA_SIDRA_ZMAT',
    label: 'STRUŽENA SIDRA (ZMAT)',
    color: '#27AE60',
    machines: [
      { id: '703', stroj: 'ZMAT', operacija: 'STRUŽENJE', normativ_min: 0.7, normativ_h: 42, tipi: 'SIDRA M10-M20 DO L600MM' },
      { id: '704', stroj: 'ZMAT', operacija: 'STRUŽENJE', normativ_min: 0.7, normativ_h: 42, tipi: 'SIDRA M10-M20 DO L600MM' },
    ],
  },
  {
    id: 'OBJEMKE',
    label: 'OBJEMKE',
    color: '#8E44AD',
    machines: [
      { id: '705', stroj: 'SANGIACOMO', operacija: 'ŠTANCANJE', normativ_min: 90, normativ_h: 5400, tipi: 'OBJEMKE ZA SIDRA' },
    ],
  },
  {
    id: 'STRUZENA_SIDRA_GILDEMEISTER',
    label: 'STRUŽENA SIDRA (GILDEMEISTER)',
    color: '#16A085',
    machines: [
      { id: '709', stroj: 'STRUŽNICA GILDEMEISTER', operacija: 'STRUŽENJE', normativ_min: 5, normativ_h: 300, tipi: 'SIDRA M6-M16 DO L200MM' },
      { id: '710', stroj: 'STRUŽNICA GILDEMEISTER', operacija: 'STRUŽENJE', normativ_min: 5, normativ_h: 300, tipi: 'SIDRA M6-M16 DO L200MM' },
    ],
  },
];

// Helper: najdi stroj po ID-ju (čez vse segmente)
export function findMachine(machineId) {
  for (const seg of SEGMENTS) {
    const m = seg.machines.find((x) => x.id === machineId);
    if (m) return { ...m, segment: seg.id, segmentLabel: seg.label, segmentColor: seg.color };
  }
  return null;
}

// Helper: vrne segment po ID-ju
export function findSegment(segmentId) {
  return SEGMENTS.find((s) => s.id === segmentId);
}

// Helper: izračuna učinkovitost (%) glede na normativ
export function calculateEfficiency(actualPieces, hours, normativPerHour) {
  if (!normativPerHour || !hours || hours <= 0) return null;
  const expected = normativPerHour * hours;
  if (expected === 0) return null;
  return Math.round((actualPieces / expected) * 100);
}
