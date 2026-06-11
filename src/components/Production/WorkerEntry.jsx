// WorkerEntry.jsx — Tablični obrazec za delavce v proizvodnji
// Piše v ISTE tabele kot Proizvodnja v2 (production_v2_entries + production_v2_stops)
// → analiza v ProductionV2Tab dela naprej brez sprememb.
// Veliki gumbi / polja, optimizirano za tablični računalnik (touch).
import React, { useState, useMemo } from 'react';
import { Package, AlertTriangle, Check, Loader2, X, ChevronLeft } from 'lucide-react';
import { supabase } from '../../supabase';
import { SEGMENTS, findMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

const OPERATERJI = [
  'Janko Augustinčič',
  'Mitja Babić',
  'Dejan Čutić',
  'Danijel Korenini',
  'Gregor Koritnik',
  'Matija Postružin',
  'Danči Šolinc',
  'Boris Černelc',
];

const STOP_REASONS = [
  'Menjava', 'Menjava orodja', 'Menjava žice', 'Nastavitev proge',
  'Nastavitev senzorja', 'Nastavitev valjanja', 'Zatikanje na progi',
  'Zlomljene vzmeti', 'Čiščenje stroja', 'Servis stroja', 'Drugo',
];

function hmToHours(h, m) {
  const hh = parseInt(h, 10) || 0;
  const mm = parseInt(m, 10) || 0;
  return hh + mm / 60;
}

function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('sl-SI');
}

export default function WorkerEntry({ currentUser }) {
  // Glava
  const [operater, setOperater] = useState(currentUser?.name || '');
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState(1);

  // Stroj
  const [segment, setSegment] = useState('');
  const [machineId, setMachineId] = useState('');

  // Vnos
  const [sifra, setSifra] = useState('');       // šifra izdelka
  const [nalog, setNalog] = useState('');        // delovni nalog
  const [kosi, setKosi] = useState('');          // količina
  const [strojH, setStrojH] = useState('');      // čas stroja - ure
  const [strojM, setStrojM] = useState('');      // čas stroja - minute
  const [delH, setDelH] = useState('');          // čas delavca - ure
  const [delM, setDelM] = useState('');          // čas delavca - minute

  // Zastoj
  const [hasStop, setHasStop] = useState(false);
  const [stopH, setStopH] = useState('');
  const [stopM, setStopM] = useState('');
  const [stopReason, setStopReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const machineInfo = useMemo(() => (machineId ? findMachine(machineId) : null), [machineId]);
  const filteredMachines = useMemo(() => {
    if (!segment) return [];
    const seg = SEGMENTS.find((s) => s.id === segment);
    return seg ? seg.machines : [];
  }, [segment]);

  const casStroja = hmToHours(strojH, strojM);
  const casDelavca = hmToHours(delH, delM);

  const eff = useMemo(() => {
    if (!machineInfo || !kosi || casStroja <= 0) return null;
    return calculateEfficiency(parseInt(kosi, 10) || 0, casStroja, machineInfo.normativ_h);
  }, [machineInfo, kosi, casStroja]);

  function resetForm() {
    setSegment('');
    setMachineId('');
    setSifra('');
    setNalog('');
    setKosi('');
    setStrojH(''); setStrojM('');
    setDelH(''); setDelM('');
    setHasStop(false);
    setStopH(''); setStopM(''); setStopReason('');
  }

  async function handleSave() {
    setError('');
    if (!operater) { setError('Izberi svoje ime.'); return; }
    if (!machineId) { setError('Izberi stroj.'); return; }
    if (machineInfo?.vOkvari) { setError('Ta stroj je V OKVARI.'); return; }
    if (!kosi) { setError('Vpiši količino.'); return; }
    if (casStroja <= 0) { setError('Vpiši čas stroja.'); return; }
    const pieces = parseInt(kosi, 10);
    if (isNaN(pieces) || pieces < 0) { setError('Količina mora biti pozitivna.'); return; }

    const stopHours = hasStop ? hmToHours(stopH, stopM) : 0;
    if (hasStop && stopHours <= 0) { setError('Vpiši trajanje zastoja ali izklopi zastoj.'); return; }

    setLoading(true);
    try {
      const efficiency = calculateEfficiency(pieces, casStroja, machineInfo.normativ_h);

      // 1) Proizvodnja → production_v2_entries (iste kolone kot v2 + delovni_nalog)
      const { error: e1 } = await supabase.from('production_v2_entries').insert([{
        date: datum,
        segment,
        machine_id: machineId,
        machine_name: machineInfo.stroj,
        operacija: machineInfo.operacija,
        normativ_kos_h: machineInfo.normativ_h,
        kosi: pieces,
        cas_ur: casStroja,
        delavec_ur: casDelavca > 0 ? casDelavca : null,
        shift: Number(shift) || 1,
        tip_vijaka: sifra || null,          // šifra izdelka
        delovni_nalog: nalog || null,        // NOVO
        operater,
        opombe: null,
        ucinkovitost_pct: efficiency,
        created_by: currentUser?.email || null,
      }]);
      if (e1) throw e1;

      // 2) Zastoj → production_v2_stops (samo če označen)
      if (hasStop && stopHours > 0) {
        const { error: e2 } = await supabase.from('production_v2_stops').insert([{
          date: datum,
          duration_hours: stopHours,
          shift: Number(shift) || 1,
          segment: machineInfo.segment || null,
          machine_id: machineId,
          machine_name: machineInfo.stroj,
          reason_category: stopReason || 'Drugo',
          description: null,
          repair_done: null,
          frequency: 1,
          fixed_by: null,
          operater,
          created_by: currentUser?.email || null,
        }]);
        if (e2) throw e2;
      }

      // uspeh: počisti vnos (ohrani ime/datum/smeno za naslednji vnos)
      resetForm();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2200);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-as-gray-50 pb-32">
      {/* Glava */}
      <div className="text-white px-5 py-4 shadow-md" style={{ background: AS_RED }}>
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8" />
          <div>
            <div className="text-2xl font-bold leading-tight">Vnos proizvodnje</div>
            <div className="text-sm opacity-90">AS system · {new Date(datum).toLocaleDateString('sl-SI')}</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Kdo / kdaj / smena */}
        <Card>
          <BigLabel>Delavec</BigLabel>
          <select value={operater} onChange={(e) => setOperater(e.target.value)} className={selCls}>
            <option value="">— izberi svoje ime —</option>
            {OPERATERJI.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <BigLabel>Datum</BigLabel>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={inpCls} />
            </div>
            <div>
              <BigLabel>Smena</BigLabel>
              <div className="grid grid-cols-2 gap-2">
                <ToggleBtn active={shift === 1} onClick={() => setShift(1)} label="🌅 Dop." />
                <ToggleBtn active={shift === 2} onClick={() => setShift(2)} label="🌙 Pop." />
              </div>
            </div>
          </div>
        </Card>

        {/* Stroj */}
        <Card>
          <BigLabel>Segment</BigLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SEGMENTS.map((seg) => (
              <button key={seg.id} type="button"
                onClick={() => { setSegment(seg.id); setMachineId(''); }}
                className="py-4 px-3 rounded-xl text-base font-bold border-2 transition active:scale-95"
                style={{
                  borderColor: seg.color,
                  background: segment === seg.id ? seg.color : '#fff',
                  color: segment === seg.id ? '#fff' : seg.color,
                }}>
                {seg.label}
              </button>
            ))}
          </div>

          {segment && (
            <>
              <BigLabel className="mt-5">Stroj</BigLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredMachines.map((m) => (
                  <button key={m.id} type="button" disabled={m.vOkvari}
                    onClick={() => setMachineId(m.id)}
                    className="py-4 px-3 rounded-xl text-left border-2 transition active:scale-95 disabled:opacity-40"
                    style={{
                      borderColor: machineId === m.id ? AS_RED : '#E5E7EB',
                      background: machineId === m.id ? '#FEE2E2' : '#fff',
                    }}>
                    <div className="font-bold text-as-gray-700">{m.id}</div>
                    <div className="text-xs text-as-gray-500 leading-tight">{m.stroj}</div>
                    {m.vOkvari && <div className="text-xs font-bold text-red-600 mt-1">V OKVARI</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {machineInfo && !machineInfo.vOkvari && (
            <div className="mt-4 bg-as-gray-50 border border-as-gray-200 rounded-xl p-3 text-sm">
              <div><span className="text-as-gray-500">Normativ:</span> <strong>{formatNumber(machineInfo.normativ_h)} kos/h</strong></div>
              <div><span className="text-as-gray-500">Operacija:</span> <strong>{machineInfo.operacija}</strong></div>
            </div>
          )}
        </Card>

        {/* Izdelek + nalog + količina */}
        {machineInfo && !machineInfo.vOkvari && (
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <BigLabel>Šifra izdelka</BigLabel>
                <input type="text" value={sifra} onChange={(e) => setSifra(e.target.value)} className={inpCls} placeholder="npr. M4x8" />
              </div>
              <div>
                <BigLabel>Št. delovnega naloga</BigLabel>
                <input type="text" inputMode="numeric" value={nalog} onChange={(e) => setNalog(e.target.value)} className={inpCls} placeholder="npr. 20012" />
              </div>
            </div>

            <div className="mt-4">
              <BigLabel>Količina (kosov)</BigLabel>
              <input type="number" inputMode="numeric" min="0" value={kosi} onChange={(e) => setKosi(e.target.value)} className={inpBig} placeholder="0" />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <TimeField label="Čas stroja" h={strojH} m={strojM} setH={setStrojH} setM={setStrojM} />
              <TimeField label="Čas delavca" h={delH} m={delM} setH={setDelH} setM={setDelM} />
            </div>

            {eff !== null && (
              <div className="mt-4 rounded-xl p-3 text-center font-bold text-lg"
                style={{
                  background: eff >= 95 ? '#DCFCE7' : eff >= 75 ? '#FEF3C7' : '#FEE2E2',
                  color: eff >= 95 ? '#16A34A' : eff >= 75 ? '#D97706' : '#DC2626',
                }}>
                🎯 Doseganje normativa: {eff}%
              </div>
            )}
          </Card>
        )}

        {/* Zastoj */}
        {machineInfo && !machineInfo.vOkvari && (
          <Card>
            <button type="button" onClick={() => setHasStop((v) => !v)}
              className="w-full flex items-center justify-between py-2 active:scale-95 transition">
              <span className="flex items-center gap-2 text-lg font-bold text-as-gray-700">
                <AlertTriangle className="w-6 h-6" style={{ color: '#D97706' }} /> Je bil zastoj?
              </span>
              <span className={`w-14 h-8 rounded-full transition relative ${hasStop ? '' : 'bg-as-gray-200'}`}
                style={hasStop ? { background: '#D97706' } : {}}>
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${hasStop ? 'left-7' : 'left-1'}`} />
              </span>
            </button>

            {hasStop && (
              <div className="mt-3 space-y-4">
                <TimeField label="Trajanje zastoja" h={stopH} m={stopM} setH={setStopH} setM={setStopM} />
                <div>
                  <BigLabel>Razlog</BigLabel>
                  <select value={stopReason} onChange={(e) => setStopReason(e.target.value)} className={selCls}>
                    <option value="">— izberi razlog —</option>
                    {STOP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )}
          </Card>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-xl text-base font-semibold"
            style={{ background: '#FEE2E2', color: '#991B1B' }}>
            <X className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* Sticky SHRANI */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-as-gray-200 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <button onClick={handleSave} disabled={loading || !machineInfo || machineInfo?.vOkvari}
            className="w-full py-5 text-white text-xl font-bold rounded-2xl shadow-md inline-flex items-center justify-center gap-3 transition active:scale-95 disabled:opacity-40"
            style={{ background: AS_RED }}>
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
            {loading ? 'Shranjujem…' : 'SHRANI VNOS'}
          </button>
        </div>
      </div>

      {/* Uspeh overlay */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-3xl px-10 py-8 text-center shadow-2xl animate-bounce-once">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: '#DCFCE7' }}>
              <Check className="w-12 h-12" style={{ color: '#16A34A' }} />
            </div>
            <div className="text-2xl font-bold text-as-gray-700">Shranjeno!</div>
            <div className="text-as-gray-500 mt-1">Vnesi naslednji.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tablični gradniki (veliki) ───
function Card({ children }) {
  return <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">{children}</div>;
}

function BigLabel({ children, className = '' }) {
  return <label className={`block text-sm font-bold text-as-gray-600 uppercase tracking-wide mb-2 ${className}`}>{children}</label>;
}

function ToggleBtn({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className="py-3 rounded-xl text-base font-bold border-2 transition active:scale-95"
      style={{
        borderColor: active ? AS_RED : '#E5E7EB',
        background: active ? '#FEE2E2' : '#fff',
        color: active ? AS_RED : '#6B7280',
      }}>
      {label}
    </button>
  );
}

function TimeField({ label, h, m, setH, setM }) {
  return (
    <div>
      <BigLabel>{label}</BigLabel>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" min="0" max="24" value={h} onChange={(e) => setH(e.target.value)}
          className={inpBig + ' text-center'} placeholder="0" />
        <span className="text-2xl font-bold text-as-gray-400">:</span>
        <input type="number" inputMode="numeric" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)}
          className={inpBig + ' text-center'} placeholder="00" />
      </div>
      <div className="text-xs text-as-gray-400 mt-1">ur : minut</div>
    </div>
  );
}

const inpCls = "w-full px-4 py-3 border-2 border-as-gray-200 rounded-xl bg-white text-base focus:outline-none focus:border-as-red-600";
const inpBig = "w-full px-4 py-3 border-2 border-as-gray-200 rounded-xl bg-white text-2xl font-bold focus:outline-none focus:border-as-red-600";
const selCls = "w-full px-4 py-3 border-2 border-as-gray-200 rounded-xl bg-white text-lg focus:outline-none focus:border-as-red-600";
