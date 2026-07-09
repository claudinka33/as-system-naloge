// WorkerEntry.jsx — Tablični vnos PROIZVODNJE (več delovnih nalogov na dan).
// Piše v production_v2_entries (vsak nalog = ena vrstica) + production_v2_stops (zastoji).
// Struktura usklajena z montažo (MontazaWorkerEntry).
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Check, Loader2, X, Plus, Trash2, BarChart3 } from 'lucide-react';
import { supabase } from '../../supabase';
import MojaNormaProizvodnja from './MojaNormaProizvodnja.jsx';
import { loadMachines, buildSegments, makeFindMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

// Operaterji se naložijo iz baze (production_v2_workers) — ureja se v Urejanje → Delavci.
const STOP_REASONS = [
  'Menjava', 'Menjava orodja', 'Menjava žice', 'Nastavitev proge',
  'Nastavitev senzorja', 'Nastavitev valjanja', 'Zatikanje na progi',
  'Zlomljene vzmeti', 'Čiščenje stroja', 'Servis stroja', 'Drugo',
];

const DAY_TARGET = 7.5; // 7:30 na dan
function hoursToHM(h) {
  const total = Math.round(Number(h || 0) * 60);
  const hh = Math.floor(Math.abs(total) / 60), mm = Math.abs(total) % 60;
  return `${total < 0 ? '-' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}
function hmToHours(h, m) {
  const hh = parseInt(h, 10) || 0, mm = parseInt(m, 10) || 0;
  return Math.round((hh + mm / 60) * 1000) / 1000;
}
function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('sl-SI');
}
let _k = 0; const newKey = () => `r${++_k}`;
const blankOrder = () => ({ key: newKey(), segmentId: '', machineId: '', sifra: '', nalog: '', kosi: '', strojH: '', strojM: '', delH: '', delM: '' });
const blankStop = () => ({ key: newKey(), reason: '', linkKey: '', h: '', m: '', opomba: '' });

export default function WorkerEntry({ currentUser }) {
  const [operaterji, setOperaterji] = useState([]);
  const isKnownOperater = !!currentUser?.isProductionWorker || operaterji.includes(currentUser?.name);

  const [operater, setOperater] = useState(currentUser?.name || '');
  const [view, setView] = useState('vnos'); // 'vnos' | 'norma'

  async function loadDayTotal(op, d) {
    if (!op || !d) { setDayTotal(null); return; }
    const [lg, st] = await Promise.all([
      supabase.from('production_v2_entries').select('cas_ur,delavec_ur').eq('operater', op).eq('date', d),
      supabase.from('production_v2_stops').select('duration_hours').eq('operater', op).eq('date', d),
    ]);
    const t = (lg.data || []).reduce((a, r) => a + (Number(r.delavec_ur ?? r.cas_ur) || 0), 0)
      + (st.data || []).reduce((a, r) => a + (Number(r.duration_hours) || 0), 0);
    setDayTotal(Math.round(t * 1000) / 1000);
  }
  useEffect(() => { loadDayTotal(operater, datum); /* eslint-disable-next-line */ }, [operater, datum]);
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState(1);
  const [machineRows, setMachineRows] = useState([]);
  const [orders, setOrders] = useState([blankOrder()]);
  const [stops, setStops] = useState([]);
  const [dayTotal, setDayTotal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { loadMachines().then(setMachineRows); }, []);
  useEffect(() => {
    supabase.from('production_v2_workers').select('name').eq('active', true).order('display_order')
      .then(({ data }) => setOperaterji((data || []).map((w) => w.name).filter(Boolean)));
  }, []);
  const SEGMENTS = useMemo(() => buildSegments(machineRows, false), [machineRows]); // brez "v okvari"
  const findMachine = useMemo(() => makeFindMachine(machineRows), [machineRows]);
  const machinesFor = (segmentId) => (SEGMENTS.find((s) => s.id === segmentId)?.machines) || [];

  // — orders —
  const setOrder = (key, field, val) => setOrders((p) => p.map((o) => {
    if (o.key !== key) return o;
    const next = { ...o, [field]: val };
    if (field === 'segmentId') next.machineId = ''; // reset stroja ob menjavi segmenta
    return next;
  }));
  const addOrder = () => setOrders((p) => [...p, blankOrder()]);
  const removeOrder = (key) => setOrders((p) => (p.length > 1 ? p.filter((o) => o.key !== key) : p));

  // — stops —
  const setStop = (key, field, val) => setStops((p) => p.map((s) => (s.key === key ? { ...s, [field]: val } : s)));
  const addStop = () => setStops((p) => [...p, blankStop()]);
  const removeStop = (key) => setStops((p) => p.filter((s) => s.key !== key));

  function resetForm() {
    setOrders([blankOrder()]); setStops([]);
  }

  async function handleSave() {
    setError('');
    if (!operater) { setError('Izberi svoje ime.'); return; }
    if (!datum) { setError('Izberi datum.'); return; }

    const orderRows = orders.filter((o) => (o.machineId || o.sifra || o.nalog || o.kosi));
    const stopRows = stops.filter((s) => s.reason && (s.h || s.m));
    if (orderRows.length === 0 && stopRows.length === 0) { setError('Vnesi vsaj en delovni nalog.'); return; }

    // validacija nalogov
    for (let i = 0; i < orderRows.length; i++) {
      const o = orderRows[i];
      const mi = o.machineId ? findMachine(o.machineId) : null;
      if (!mi) { setError(`Nalog #${i + 1}: izberi stroj.`); return; }
      if (mi.vOkvari) { setError(`Nalog #${i + 1}: stroj je V OKVARI.`); return; }
      const pieces = parseInt(o.kosi, 10);
      if (isNaN(pieces) || pieces <= 0) { setError(`Nalog #${i + 1}: vpiši količino.`); return; }
      if (hmToHours(o.strojH, o.strojM) <= 0) { setError(`Nalog #${i + 1}: vpiši čas stroja.`); return; }
    }
    for (let i = 0; i < stopRows.length; i++) {
      if (hmToHours(stopRows[i].h, stopRows[i].m) <= 0) { setError(`Zastoj #${i + 1}: vpiši trajanje.`); return; }
    }

    setSaving(true);
    try {
      if (orderRows.length) {
        const payload = orderRows.map((o) => {
          const mi = findMachine(o.machineId);
          const casStroja = hmToHours(o.strojH, o.strojM);
          const casDelavca = hmToHours(o.delH, o.delM);
          const pieces = parseInt(o.kosi, 10) || 0;
          return {
            date: datum,
            segment: mi.segment,
            machine_id: o.machineId,
            machine_name: mi.stroj,
            operacija: mi.operacija,
            normativ_kos_h: mi.normativ_h,
            kosi: pieces,
            cas_ur: casStroja,
            delavec_ur: casDelavca > 0 ? casDelavca : null,
            shift: Number(shift) || 1,
            tip_vijaka: (o.sifra || '').trim() || null,
            delovni_nalog: (o.nalog || '').trim() || null,
            operater,
            opombe: null,
            ucinkovitost_pct: calculateEfficiency(pieces, casStroja, mi.normativ_h),
            created_by: currentUser?.email || null,
          };
        });
        const { error: e1 } = await supabase.from('production_v2_entries').insert(payload);
        if (e1) throw e1;
      }

      if (stopRows.length) {
        const payload = stopRows.map((s) => {
          const linkedOrder = s.linkKey ? orders.find((o) => o.key === s.linkKey) : null;
          const mi = linkedOrder && linkedOrder.machineId ? findMachine(linkedOrder.machineId) : null;
          return {
            date: datum,
            duration_hours: hmToHours(s.h, s.m),
            shift: Number(shift) || 1,
            segment: mi ? mi.segment : null,
            machine_id: mi ? linkedOrder.machineId : null,
            machine_name: mi ? mi.stroj : null,
            delovni_nalog: linkedOrder ? ((linkedOrder.nalog || '').trim() || null) : null,
            reason_category: s.reason || 'Drugo',
            description: (s.opomba || '').trim() || null,
            repair_done: null,
            frequency: 1,
            fixed_by: null,
            operater,
            created_by: currentUser?.email || null,
          };
        });
        const { error: e2 } = await supabase.from('production_v2_stops').insert(payload);
        if (e2) throw e2;
      }

      setSuccess(true);
      resetForm();
      loadDayTotal(operater, datum);
      setTimeout(() => setSuccess(false), 1800);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setSaving(false);
    }
  }

  const orderOptions = orders.filter((o) => (o.nalog || o.sifra || o.machineId));

  return (
    <div className="min-h-screen bg-as-gray-50 pb-32">
      {/* Glava */}
      <div className="text-white px-5 py-4 shadow-md" style={{ background: AS_RED }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8" />
            <div>
              <div className="text-2xl font-bold leading-tight">Vnos proizvodnje</div>
              <div className="text-sm opacity-90">AS system · {new Date(datum).toLocaleDateString('sl-SI')}</div>
            </div>
          </div>
          {operater && (
            <div className="flex gap-1 bg-white/15 rounded-lg p-1">
              <button onClick={() => setView('vnos')}
                className={`px-3 py-1.5 text-sm font-semibold rounded ${view === 'vnos' ? 'bg-white' : 'text-white'}`}
                style={view === 'vnos' ? { color: AS_RED } : {}}>
                Vnos
              </button>
              <button onClick={() => setView('norma')}
                className={`px-3 py-1.5 text-sm font-semibold rounded inline-flex items-center gap-1 ${view === 'norma' ? 'bg-white' : 'text-white'}`}
                style={view === 'norma' ? { color: AS_RED } : {}}>
                <BarChart3 className="w-4 h-4" /> Moja norma
              </button>
            </div>
          )}
        </div>
      </div>

      {view === 'norma' && operater ? (
        <div className="max-w-3xl mx-auto px-4 py-5">
          <MojaNormaProizvodnja operater={operater} />
        </div>
      ) : (<>
      <div className="max-w-3xl mx-auto px-4 py-5">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-3 rounded-lg border text-sm" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
            <X className="w-4 h-4" /> <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Glava: operater / datum / smena */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <BigLabel>Delavec</BigLabel>
              {isKnownOperater ? (
                <div className="px-3 py-3 rounded-lg bg-as-gray-100 font-semibold">{operater}</div>
              ) : (
                <select value={operater} onChange={(e) => setOperater(e.target.value)} className={selCls}>
                  <option value="">— izberi —</option>
                  {operaterji.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
            <div>
              <BigLabel>Datum</BigLabel>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={selCls} />
            </div>
            <div className="sm:col-span-2">
              <BigLabel>Smena</BigLabel>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShift(1)}
                  className={`flex-1 py-3 rounded-lg border-2 font-bold ${shift === 1 ? 'text-white' : 'text-as-gray-600 border-as-gray-200'}`}
                  style={shift === 1 ? { background: AS_RED, borderColor: AS_RED } : {}}>🌅 Dop.</button>
                <button type="button" onClick={() => setShift(2)}
                  className={`flex-1 py-3 rounded-lg border-2 font-bold ${shift === 2 ? 'text-white' : 'text-as-gray-600 border-as-gray-200'}`}
                  style={shift === 2 ? { background: AS_RED, borderColor: AS_RED } : {}}>🌙 Pop.</button>
              </div>
            </div>
          </div>
        </Card>

        {/* Števec dneva — cilj 7:30 */}
        {dayTotal != null && operater && (
          <Card>
            {(() => {
              const diff = Math.round((DAY_TARGET - dayTotal) * 1000) / 1000;
              const full = Math.abs(diff) < 0.009;
              const over = diff < -0.009;
              const color = full ? '#1b5e20' : over ? '#C8102E' : '#F39C12';
              const msg = full ? 'Dan je poln (7:30) ✔' : over ? `Preseženo za ${hoursToHM(-diff)}` : `Manjka še ${hoursToHM(diff)}`;
              const pctW = Math.max(0, Math.min(100, (dayTotal / DAY_TARGET) * 100));
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-as-gray-600">Danes vneseno (delo + zastoji)</span>
                    <span className="text-lg font-bold" style={{ color }}>{hoursToHM(dayTotal)} / 7:30</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-as-gray-100 overflow-hidden">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${pctW}%`, background: color }} />
                  </div>
                  <div className="text-xs font-semibold mt-1" style={{ color }}>{msg}</div>
                </>
              );
            })()}
          </Card>
        )}

        {/* Delovni nalogi */}
        <div className="mt-4 mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
            <span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />Delovni nalogi
          </h2>
        </div>
        {orders.map((o, idx) => {
          const segMachines = machinesFor(o.segmentId);
          const mi = o.machineId ? findMachine(o.machineId) : null;
          return (
            <Card key={o.key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: AS_RED }}>Nalog #{idx + 1}</span>
                {orders.length > 1 && <button onClick={() => removeOrder(o.key)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <BigLabel>Segment</BigLabel>
                  <select value={o.segmentId} onChange={(e) => setOrder(o.key, 'segmentId', e.target.value)} className={selCls}>
                    <option value="">— izberi —</option>
                    {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <BigLabel>Stroj</BigLabel>
                  <select value={o.machineId} onChange={(e) => setOrder(o.key, 'machineId', e.target.value)} className={selCls} disabled={!o.segmentId}>
                    <option value="">— izberi —</option>
                    {segMachines.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.stroj}</option>)}
                  </select>
                  {mi && <div className="text-xs mt-1 text-as-gray-500">Normativ: <strong>{formatNumber(mi.normativ_h)} kos/h</strong></div>}
                </div>
                <div>
                  <BigLabel>Šifra izdelka</BigLabel>
                  <input value={o.sifra} onChange={(e) => setOrder(o.key, 'sifra', e.target.value)} className={inpCls} placeholder="šifra" />
                </div>
                <div>
                  <BigLabel>Št. delovnega naloga</BigLabel>
                  <input value={o.nalog} onChange={(e) => setOrder(o.key, 'nalog', e.target.value)} className={inpCls} placeholder="npr. 20012" />
                </div>
                <div>
                  <BigLabel>Količina (kos)</BigLabel>
                  <input type="number" inputMode="numeric" value={o.kosi} onChange={(e) => setOrder(o.key, 'kosi', e.target.value)} className={inpCls} placeholder="0" />
                </div>
                <div />
                <TimeField label="Čas stroja" h={o.strojH} m={o.strojM} setH={(v) => setOrder(o.key, 'strojH', v)} setM={(v) => setOrder(o.key, 'strojM', v)} />
                <TimeField label="Čas delavca" h={o.delH} m={o.delM} setH={(v) => setOrder(o.key, 'delH', v)} setM={(v) => setOrder(o.key, 'delM', v)} />
              </div>
            </Card>
          );
        })}
        <button onClick={addOrder} className="w-full py-3 rounded-lg border-2 border-dashed font-semibold inline-flex items-center justify-center gap-2" style={{ borderColor: AS_RED, color: AS_RED }}>
          <Plus className="w-4 h-4" /> Dodaj nalog
        </button>

        {/* Zastoji */}
        <div className="mt-5 mb-1">
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: '#F39C12' }}>
            <span className="inline-block w-1.5 h-5 rounded" style={{ background: '#F39C12' }} />Zastoji <span className="text-as-gray-400 font-normal text-sm">(neobvezno)</span>
          </h2>
        </div>
        {stops.map((s, idx) => (
          <Card key={s.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-as-gray-500">Zastoj #{idx + 1}</span>
              <button onClick={() => removeStop(s.key)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <BigLabel>Razlog</BigLabel>
                <select value={s.reason} onChange={(e) => setStop(s.key, 'reason', e.target.value)} className={selCls}>
                  <option value="">— izberi razlog —</option>
                  {STOP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <BigLabel>Vezan na nalog</BigLabel>
                <select value={s.linkKey} onChange={(e) => setStop(s.key, 'linkKey', e.target.value)} className={selCls}>
                  <option value="">Ni vezan (splošno)</option>
                  {orderOptions.map((o, i) => {
                    const mi = o.machineId ? findMachine(o.machineId) : null;
                    const label = (o.nalog || o.sifra || (mi ? mi.stroj : `Nalog ${i + 1}`));
                    return <option key={o.key} value={o.key}>{label}</option>;
                  })}
                </select>
              </div>
              <TimeField label="Trajanje" h={s.h} m={s.m} setH={(v) => setStop(s.key, 'h', v)} setM={(v) => setStop(s.key, 'm', v)} />
              <div>
                <BigLabel>Opomba</BigLabel>
                <input value={s.opomba} onChange={(e) => setStop(s.key, 'opomba', e.target.value)} className={inpCls} placeholder="neobvezno" />
              </div>
            </div>
          </Card>
        ))}
        <button onClick={addStop} className="w-full py-3 rounded-lg border-2 border-dashed font-semibold inline-flex items-center justify-center gap-2 border-as-gray-300 text-as-gray-600">
          <Plus className="w-4 h-4" /> Dodaj zastoj
        </button>
      </div>

      {/* Sticky SHRANI */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-as-gray-200">
        <button onClick={handleSave} disabled={saving}
          className="max-w-3xl mx-auto w-full py-4 rounded-xl text-white font-bold text-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: AS_RED }}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? 'Shranjujem…' : 'SHRANI VNOS'}
        </button>
      </div>

      {/* Uspeh */}
      {success && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl px-8 py-6 text-center shadow-xl">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: '#e8f5e9' }}>
              <Check className="w-8 h-8" style={{ color: '#1b5e20' }} />
            </div>
            <div className="font-bold text-lg">Shranjeno!</div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

const selCls = "w-full px-3 py-3 border border-as-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-as-red-600 disabled:bg-as-gray-50";
const inpCls = "w-full px-3 py-3 border border-as-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-as-red-600";

function Card({ children }) { return <div className="bg-white rounded-xl border border-as-gray-200 p-4 mb-3">{children}</div>; }
function BigLabel({ children }) { return <label className="block text-sm font-semibold text-as-gray-600 mb-1">{children}</label>; }
function TimeField({ label, h, m, setH, setM }) {
  return (
    <div>
      <BigLabel>{label}</BigLabel>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} className={inpCls} placeholder="ur" />
        <span className="text-as-gray-400">:</span>
        <input type="number" inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} className={inpCls} placeholder="min" />
      </div>
    </div>
  );
}
