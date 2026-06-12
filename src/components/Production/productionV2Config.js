// productionV2Config.js — STROJI SE BEREJO IZ BAZE (tabela production_v2_machines)
// Segmenti (struktura + barve) ostanejo tu; stroje ureja Boris/admin v aplikaciji.
import { supabase } from '../../supabase';

// Metapodatki segmentov
export const SEGMENTS_META = [
  { id: 'VIJAKI', label: 'VIJAKI', color: '#C8102E' },
  { id: 'PINI', label: 'PINI', color: '#0066CC' },
  { id: 'KOVANA_SIDRA', label: 'KOVANA SIDRA', color: '#F39C12' },
  { id: 'STRUZENA_SIDRA_ZMAT', label: 'STRUŽENA SIDRA (ZMAT)', color: '#27AE60' },
  { id: 'OBJEMKE', label: 'OBJEMKE', color: '#8E44AD' },
  { id: 'STRUZENA_SIDRA_GILDEMEISTER', label: 'STRUŽENA SIDRA (GILDEMEISTER)', color: '#16A085' },
];

// Naloži vse stroje iz baze (ploski seznam DB-vrstic)
export async function loadMachines() {
  const { data, error } = await supabase
    .from('production_v2_machines')
    .select('*')
    .order('segment', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('machine_id', { ascending: true });
  if (error) { console.error('loadMachines napaka:', error); return []; }
  return data || [];
}

// DB-vrstica -> oblika stroja kot v stari konfiguraciji
function rowToMachine(r) {
  return {
    id: r.machine_id,
    segment: r.segment,
    stroj: r.stroj,
    operacija: r.operacija || '',
    normativ_min: Number(r.normativ_min) || 0,
    normativ_h: Number(r.normativ_h) || 0,
    tipi: r.tipi || '',
    vOkvari: !!r.v_okvari,
    sort_order: r.sort_order ?? 0,
    _uuid: r.id,
  };
}

// Zgradi SEGMENTS strukturo iz DB-vrstic.
// includeOkvara=false izloči stroje "v okvari" (za izbiro delavcem).
export function buildSegments(rows, includeOkvara = true) {
  const machines = (rows || []).map(rowToMachine);
  return SEGMENTS_META.map((meta) => ({
    ...meta,
    machines: machines
      .filter((m) => m.segment === meta.id && (includeOkvara || !m.vOkvari))
      .sort((a, b) => (a.sort_order - b.sort_order) || String(a.id).localeCompare(String(b.id))),
  }));
}

// Vrne funkcijo findMachine(id) -> { ...stroj, segment, segmentLabel, segmentColor } | null
export function makeFindMachine(rows) {
  const map = {};
  for (const r of (rows || [])) {
    const meta = SEGMENTS_META.find((s) => s.id === r.segment) || { label: r.segment, color: '#666' };
    map[r.machine_id] = {
      id: r.machine_id,
      stroj: r.stroj,
      operacija: r.operacija || '',
      normativ_min: Number(r.normativ_min) || 0,
      normativ_h: Number(r.normativ_h) || 0,
      tipi: r.tipi || '',
      vOkvari: !!r.v_okvari,
      segment: r.segment,
      segmentLabel: meta.label,
      segmentColor: meta.color,
    };
  }
  return (machineId) => map[machineId] || null;
}

// Izračuna učinkovitost (%) glede na normativ
export function calculateEfficiency(actualPieces, hours, normativPerHour) {
  if (!normativPerHour || !hours || hours <= 0) return null;
  const expected = normativPerHour * hours;
  if (expected === 0) return null;
  return Math.round((actualPieces / expected) * 100);
}
