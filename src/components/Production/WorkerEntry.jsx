// WorkerEntry.jsx — Tablični vnos PROIZVODNJE (usklajen z montažo v4).
// Moj delovni dan (production_daily_time: stroj/malica/ostalo) — cilj 8:00 (delo 7:30 + malica).
// Zastoji se vpisujejo SPROTI (production_v2_stops), nalogi na koncu dneva (production_v2_entries).
// Delavec lahko svoje vnose ureja/briše samo isti dan; za nazaj Boris/admin.
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Check, Loader2, X, Plus, Trash2, BarChart3, Clock } from 'lucide-react';
import { supabase } from '../../supabase';
import MojaNormaProizvodnja from './MojaNormaProizvodnja.jsx';
import { loadMachines, buildSegments, makeFindMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

const STOP_REASONS = [
  'Menjava', 'Menjava orodja', 'Menjava žice', 'Nastavitev proge',
  'Nastavitev senzorja', 'Nastavitev valjanja', 'Zatikanje na progi',
  'Zlomljene vzmeti', 'Čiščenje stroja', 'Servis stroja', 'Drugo',
];

function hoursToHM(h) {
  const total = Math.round(Number(h || 0) * 60);
  const hh = Math.floor(Math.abs(total) / 60), mm = Math.abs(total) % 60;
  return `${total < 0 ? '-' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}
function hoursToSplit(h) {
  const total = Math.round(Number(h || 0) * 60);
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
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
const blankOrder = () => ({ key: newKey(), segmentId: '', machineId: '', sifra: '', nalog: '', kosi: '', strojH: '', strojM: '' });

export default function WorkerEntry({ currentUser }) {
  const today = new Date().toISOString().slice(0, 10);

  const [operaterji, setOperaterji] = useState([]);
  const [stopReasons, setStopReasons] = useState(STOP_REASONS);
  const isKnownOperater = !!currentUser?.isProductionWorker || operaterji.includes(currentUser?.name);

  const [operater, setOperater] = useState(currentUser?.name || '');
  const [view, setView] = useState('vnos'); // 'vnos' | 'norma'

  const [datum, setDatum] = useState(today);
  const [shift, setShift] = useState(1);
  const [machineRows, setMachineRows] = useState([]);

  const [orders, setOrders] = useState([blankOrder()]);
  const [editLog, setEditLog] = useState(null); // { id }

  // zastoj (sprotni vnos)
  const [stop, setStop] = useState({ reason: '', nalog: '', machineId: '', h: '', m: '', opomba: '' });
  const [editStopId, setEditStopId] = useState(null);
  const [savingStop, setSavingStop] = useState(false);

  // moj delovni dan
  const [timeH, setTimeH] = useState('');
  const [timeM, setTimeM] = useState('');
  const [timeVrsta, setTimeVrsta] = useState('stroj');
  const [timeOpis, setTimeOpis] = useState('');
  const [savingTime, setSavingTime] = useState(false);

  const [dayTime, setDayTime] = useState([]);
  const [dayStops, setDayStops] = useState([]);
  const [dayLogs, setDayLogs] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fixed = isKnownOperater; // delavec na portalu
  const canEditDay = datum === today;

  useEffect(() => { loadMachines().then(setMachineRows); }, []);
  useEffect(() => {
    supabase.from('production_v2_workers').select('name').eq('active', true).order('display_order')
      .then(({ data }) => setOperaterji((data || []).map((w) => w.name).filter(Boolean)));
    supabase.from('production_v2_stop_reasons').select('reason').eq('active', true).order('display_order')
      .then(({ data }) => {
        const names = (data || []).map((r) => r.reason).filter(Boolean);
        if (names.length) setStopReasons(names);
      });
  }, []);

  const SEGMENTS = useMemo(() => buildSegments(machineRows, false), [machineRows]);
  const findMachine = useMemo(() => makeFindMachine(machineRows), [machineRows]);
  const machinesFor = (segmentId) => (SEGMENTS.find((s) => s.id === segmentId)?.machines) || [];
  const allMachines = useMemo(() => SEGMENTS.flatMap((s) => s.machines.map((m) => ({ ...m, segLabel: s.label }))), [SEGMENTS]);

  async function loadDay(op, d) {
    if (!op || !d) { setDayTime([]); setDayStops([]); setDayLogs([]); return; }
    const [t, st, lg] = await Promise.all([
      supabase.from('production_daily_time').select('id,date,cas_ur,vrsta,opomba').eq('operater', op).eq('date', d).order('id'),
      supabase.from('production_v2_stops').select('id,date,reason_category,delovni_nalog,duration_hours,description,machine_id,machine_name,segment').eq('operater', op).eq('date', d).order('id'),
      supabase.from('production_v2_entries').select('id,date,segment,machine_id,machine_name,tip_vijaka,delovni_nalog,kosi,cas_ur,normativ_kos_h,ucinkovitost_pct').eq('operater', op).eq('date', d).order('id'),
    ]);
    setDayTime(t.data || []);
    setDayStops(st.data || []);
    setDayLogs(lg.data || []);
  }
  useEffect(() => { loadDay(operater, datum); /* eslint-disable-next-line */ }, [operater, datum]);

  const casDelo = dayTime.filter((r) => r.vrsta !== 'malica').reduce((a, r) => a + (Number(r.cas_ur) || 0), 0);
  const casMalica = casDelo > 4 ? 0.5 : 0; // malica avtomatsko: 0:30, če je dela več kot 4 h
  const dayTotal = Math.round((casDelo + casMalica) * 1000) / 1000;

  const setOrder = (key, patch) => setOrders((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const addOrder = () => setOrders((p) => [...p, blankOrder()]);
  const removeOrder = (key) => setOrders((p) => (p.length > 1 ? p.filter((o) => o.key !== key) : p));

  // ===== MOJ DELOVNI DAN =====
  async function saveMyTime() {
    setError('');
    if (!operater) { setError('Izberi svoje ime.'); return; }
    if (fixed && !canEditDay) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const c = hmToHours(timeH, timeM);
    if (!c) { setError('Vpiši čas (ure in/ali minute).'); return; }
    if (timeVrsta === 'ostalo' && !(timeOpis || '').trim()) { setError('Ostalo: vpiši kaj si delal (opis).'); return; }
    setSavingTime(true);
    const { error: e } = await supabase.from('production_daily_time').insert({
      date: datum, operater, cas_ur: c,
      vrsta: timeVrsta, opomba: timeVrsta === 'ostalo' ? (timeOpis || '').trim() : null,
      created_by: currentUser?.email || null,
    });
    setSavingTime(false);
    if (e) { setError(e.message); return; }
    setTimeH(''); setTimeM(''); setTimeOpis('');
    loadDay(operater, datum);
  }
  async function deleteMyTime(r) {
    if (fixed && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const { error: e } = await supabase.from('production_daily_time').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(operater, datum);
  }

  // ===== ZASTOJ (sprotni) =====
  async function saveStop() {
    setError('');
    if (!operater) { setError('Izberi svoje ime.'); return; }
    if (fixed && !canEditDay) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    if (!stop.reason) { setError('Zastoj: izberi razlog.'); return; }
    const c = hmToHours(stop.h, stop.m);
    if (!c) { setError('Zastoj: vpiši trajanje.'); return; }
    const mi = stop.machineId ? findMachine(stop.machineId) : null;
    setSavingStop(true);
    const rec = {
      date: datum,
      duration_hours: c,
      shift: Number(shift) || 1,
      segment: mi ? mi.segment : null,
      machine_id: mi ? stop.machineId : null,
      machine_name: mi ? mi.stroj : null,
      delovni_nalog: (stop.nalog || '').trim() || null,
      reason_category: stop.reason || 'Drugo',
      description: (stop.opomba || '').trim() || null,
      operater,
      created_by: currentUser?.email || null,
    };
    const { error: e } = editStopId
      ? await supabase.from('production_v2_stops').update(rec).eq('id', editStopId)
      : await supabase.from('production_v2_stops').insert({ ...rec, repair_done: null, frequency: 1, fixed_by: null });
    setSavingStop(false);
    if (e) { setError(e.message); return; }
    setStop({ reason: '', nalog: '', machineId: '', h: '', m: '', opomba: '' });
    setEditStopId(null);
    loadDay(operater, datum);
  }
  function startEditStop(r) {
    const t = hoursToSplit(r.duration_hours);
    setStop({ reason: r.reason_category || '', nalog: r.delovni_nalog || '', machineId: r.machine_id || '', h: t.h, m: t.m, opomba: r.description || '' });
    setEditStopId(r.id);
    setError('');
  }
  function cancelEditStop() {
    setStop({ reason: '', nalog: '', machineId: '', h: '', m: '', opomba: '' });
    setEditStopId(null);
  }
  async function deleteStop(r) {
    if (fixed && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const { error: e } = await supabase.from('production_v2_stops').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(operater, datum);
  }

  // ===== NALOGI =====
  function startEditLog(r) {
    const o = blankOrder();
    const mi = r.machine_id ? findMachine(r.machine_id) : null;
    o.segmentId = mi ? mi.segment : (r.segment || '');
    o.machineId = r.machine_id || '';
    o.sifra = r.tip_vijaka || '';
    o.nalog = r.delovni_nalog || '';
    o.kosi = String(r.kosi ?? '');
    const t = hoursToSplit(r.cas_ur); o.strojH = t.h; o.strojM = t.m;
    setOrders([o]);
    setEditLog({ id: r.id });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEditLog() {
    setOrders([blankOrder()]);
    setEditLog(null);
  }

  async function handleSave() {
    setError('');
    if (!operater) { setError('Izberi svoje ime.'); return; }
    if (!datum) { setError('Izberi datum.'); return; }
    if (fixed && !canEditDay) { setError('Vnos za pretekle dni je zaklenjen.'); return; }

    const orderRows = orders.filter((o) => (o.machineId || o.sifra || o.nalog || o.kosi));
    if (orderRows.length === 0) { setError('Vnesi vsaj en delovni nalog.'); return; }

    for (let i = 0; i < orderRows.length; i++) {
      const o = orderRows[i];
      const mi = o.machineId ? findMachine(o.machineId) : null;
      if (!mi) { setError(`Nalog #${i + 1}: izberi stroj.`); return; }
      if (mi.vOkvari) { setError(`Nalog #${i + 1}: stroj je V OKVARI.`); return; }
      const pieces = parseInt(o.kosi, 10);
      if (isNaN(pieces) || pieces <= 0) { setError(`Nalog #${i + 1}: vpiši količino.`); return; }
      if (hmToHours(o.strojH, o.strojM) <= 0) { setError(`Nalog #${i + 1}: vpiši čas stroja.`); return; }
    }

    setSaving(true);
    try {
      const payload = orderRows.map((o) => {
        const mi = findMachine(o.machineId);
        const casStroja = hmToHours(o.strojH, o.strojM);
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
          delavec_ur: null, // delavčev čas se vodi v "Moj delovni dan"
          shift: Number(shift) || 1,
          tip_vijaka: (o.sifra || '').trim() || null,
          delovni_nalog: (o.nalog || '').trim() || null,
          operater,
          opombe: null,
          ucinkovitost_pct: calculateEfficiency(pieces, casStroja, mi.normativ_h),
          created_by: currentUser?.email || null,
        };
      });

      if (editLog) {
        const { error: e1 } = await supabase.from('production_v2_entries').update(payload[0]).eq('id', editLog.id);
        if (e1) throw e1;
        setEditLog(null);
      } else {
        const { error: e1 } = await supabase.from('production_v2_entries').insert(payload);
        if (e1) throw e1;
      }

      setSuccess(true);
      setOrders([blankOrder()]);
      loadDay(operater, datum);
      setTimeout(() => setSuccess(false), 1800);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(r) {
    if (fixed && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    if (!window.confirm('Izbrišem ta vnos?')) return;
    const { error: e } = await supabase.from('production_v2_entries').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(operater, datum);
  }

  const segLabelOf = (id) => (SEGMENTS.find((s) => s.id === id)?.label) || id || '—';

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

      {/* Operater / datum / smena */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <BigLabel>Delavec</BigLabel>
            {isKnownOperater ? (
              <div className="px-3 py-3 rounded-lg bg-as-gray-100 font-semibold">{operater}</div>
            ) : (
              <select value={operater} onChange={(e) => setOperater(e.target.value)} className={selCls}>
                <option value="">— izberi ime —</option>
                {operaterji.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
          <div>
            <BigLabel>Datum</BigLabel>
            {fixed ? (
              <div className="px-3 py-3 rounded-lg bg-as-gray-100 font-semibold">{new Date(today).toLocaleDateString('sl-SI')} (danes)</div>
            ) : (
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={selCls} />
            )}
          </div>
          <div>
            <BigLabel>Smena</BigLabel>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className={selCls}>
              <option value={1}>1. smena (dopoldan)</option>
              <option value={2}>2. smena (popoldan)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* MOJ DELOVNI DAN */}
      {operater && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-as-gray-600 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> Moj delovni dan</span>
            {(() => {
              const target = 8;
              const diff = Math.round((target - dayTotal) * 1000) / 1000;
              const full = Math.abs(diff) < 0.009;
              const over = diff < -0.009;
              const color = full ? '#1b5e20' : over ? '#C8102E' : '#F39C12';
              return <span className="text-lg font-bold" style={{ color }}>{hoursToHM(dayTotal)} / 8:00</span>;
            })()}
          </div>
          {(() => {
            const target = 8;
            const diff = Math.round((target - dayTotal) * 1000) / 1000;
            const full = Math.abs(diff) < 0.009;
            const over = diff < -0.009;
            const color = full ? '#1b5e20' : over ? '#C8102E' : '#F39C12';
            const msg = full ? 'Dan je poln (8:00) ✔' : over ? `Preseženo za ${hoursToHM(-diff)} (nadure)` : `Manjka še ${hoursToHM(diff)}`;
            const pctW = Math.max(0, Math.min(100, (dayTotal / target) * 100));
            return (
              <>
                <div className="w-full h-3 rounded-full bg-as-gray-100 overflow-hidden">
                  <div className="h-3 rounded-full transition-all" style={{ width: `${pctW}%`, background: color }} />
                </div>
                <div className="text-xs font-semibold mt-1 mb-3" style={{ color }}>{msg} · delo {hoursToHM(casDelo)} / 7:30 · malica {hoursToHM(casMalica)} (avtomatsko)</div>
              </>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <BigLabel>Vrsta</BigLabel>
              <select value={timeVrsta} onChange={(e) => setTimeVrsta(e.target.value)} className={selCls}>
                <option value="stroj">Delo na stroju</option>
                <option value="ostalo">Ostalo (čiščenje, karton…)</option>
              </select>
            </div>
            <TimeField label="Čas" h={timeH} m={timeM} setH={setTimeH} setM={setTimeM} />
            <button onClick={saveMyTime} disabled={savingTime}
              className="px-4 py-3 text-white text-sm font-bold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: AS_RED }}>
              {savingTime ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dodaj čas
            </button>
            {timeVrsta === 'ostalo' && (
              <div className="sm:col-span-3">
                <BigLabel>Kaj si delal (opis)</BigLabel>
                <input value={timeOpis} onChange={(e) => setTimeOpis(e.target.value)} className={inpCls} placeholder="npr. čiščenje, stiskanje kartona…" />
              </div>
            )}
          </div>
          {dayTime.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-as-gray-500 border-b border-as-gray-200">
                    <th className="text-left p-2">Vrsta</th>
                    <th className="text-left p-2">Opis</th>
                    <th className="text-right p-2">Čas</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dayTime.map((r) => (
                    <tr key={r.id} className="border-b border-as-gray-100">
                      <td className="p-2">{r.vrsta === 'malica' ? 'Malica' : r.vrsta === 'ostalo' ? 'Ostalo' : 'Delo na stroju'}</td>
                      <td className="p-2">{r.opomba || '—'}</td>
                      <td className="p-2 text-right font-semibold">{hoursToHM(r.cas_ur)}</td>
                      <td className="p-2 text-right">
                        {canEditDay && (
                          <button onClick={() => deleteMyTime(r)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ZASTOJI — sprotni vnos */}
      {operater && (
        <>
          <div className="mt-4 mb-1">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: '#F39C12' }}>
              <span className="inline-block w-1.5 h-5 rounded" style={{ background: '#F39C12' }} />
              Zastoji <span className="text-as-gray-400 font-normal text-sm">(vpiši takoj, ko se zgodi)</span>
            </h2>
          </div>
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <BigLabel>Razlog</BigLabel>
                <select value={stop.reason} onChange={(e) => setStop((p) => ({ ...p, reason: e.target.value }))} className={selCls}>
                  <option value="">— izberi razlog —</option>
                  {stopReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <BigLabel>Stroj (neobvezno)</BigLabel>
                <select value={stop.machineId} onChange={(e) => setStop((p) => ({ ...p, machineId: e.target.value }))} className={selCls}>
                  <option value="">— brez stroja —</option>
                  {allMachines.map((m) => <option key={m.id} value={m.id}>{m.segLabel} · {m.id} - {m.stroj}</option>)}
                </select>
              </div>
              <div>
                <BigLabel>Št. delovnega naloga (neobvezno)</BigLabel>
                <input value={stop.nalog} onChange={(e) => setStop((p) => ({ ...p, nalog: e.target.value }))} className={inpCls} placeholder="npr. DN-1234 ali prazno" />
              </div>
              <TimeField label="Trajanje" h={stop.h} m={stop.m}
                setH={(v) => setStop((p) => ({ ...p, h: v }))} setM={(v) => setStop((p) => ({ ...p, m: v }))} />
              <div className="sm:col-span-2">
                <BigLabel>Opomba</BigLabel>
                <input value={stop.opomba} onChange={(e) => setStop((p) => ({ ...p, opomba: e.target.value }))} className={inpCls} placeholder="neobvezno" />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={saveStop} disabled={savingStop}
                className="flex-1 py-3 rounded-lg text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: '#F39C12' }}>
                {savingStop ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} {editStopId ? 'POSODOBI ZASTOJ' : 'SHRANI ZASTOJ'}
              </button>
              {editStopId && (
                <button onClick={cancelEditStop} className="px-4 py-3 rounded-lg border border-as-gray-200 font-semibold">Prekliči</button>
              )}
            </div>
            {dayStops.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <div className="text-xs font-semibold text-as-gray-500 mb-1">Današnji zastoji:</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-as-gray-500 border-b border-as-gray-200">
                      <th className="text-left p-2">Razlog</th>
                      <th className="text-left p-2">Stroj</th>
                      <th className="text-left p-2">Nalog</th>
                      <th className="text-right p-2">Čas</th>
                      <th className="text-left p-2">Opomba</th>
                      <th className="text-right p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayStops.map((r) => (
                      <tr key={r.id} className="border-b border-as-gray-100">
                        <td className="p-2">{r.reason_category || '—'}</td>
                        <td className="p-2">{r.machine_id ? `${r.machine_id} - ${r.machine_name || ''}` : (r.machine_name || '—')}</td>
                        <td className="p-2">{r.delovni_nalog || '—'}</td>
                        <td className="p-2 text-right font-semibold">{hoursToHM(r.duration_hours)}</td>
                        <td className="p-2">{r.description || '—'}</td>
                        <td className="p-2 text-right whitespace-nowrap">
                          {canEditDay ? (
                            <>
                              <button onClick={() => startEditStop(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                              <button onClick={() => deleteStop(r)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                            </>
                          ) : <span className="text-xs text-as-gray-400">🔒</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Delovni nalogi */}
      <div className="mt-4 mb-1 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
          <span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />
          Delovni nalogi
          <span className="text-as-gray-400 font-normal text-sm">{editLog ? '(urejaš shranjen vnos)' : '(vpiši na koncu dneva)'}</span>
        </h2>
        {editLog && (
          <button onClick={cancelEditLog} className="px-3 py-1.5 rounded-lg border border-as-gray-200 text-sm font-semibold">Prekliči urejanje</button>
        )}
      </div>

      {orders.map((o, idx) => {
        const mi = o.machineId ? findMachine(o.machineId) : null;
        return (
          <Card key={o.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold" style={{ color: AS_RED }}>Nalog #{idx + 1}</span>
              {orders.length > 1 && (
                <button onClick={() => removeOrder(o.key)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <BigLabel>Št. delovnega naloga</BigLabel>
                <input value={o.nalog} onChange={(e) => setOrder(o.key, { nalog: e.target.value })} className={inpCls} placeholder="npr. DN-1234" />
              </div>
              <div>
                <BigLabel>Skupina</BigLabel>
                <select value={o.segmentId} onChange={(e) => setOrder(o.key, { segmentId: e.target.value, machineId: '' })} className={selCls}>
                  <option value="">— izberi skupino —</option>
                  {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <BigLabel>Stroj</BigLabel>
                <select value={o.machineId} disabled={!o.segmentId}
                  onChange={(e) => setOrder(o.key, { machineId: e.target.value })} className={selCls}>
                  <option value="">— izberi stroj —</option>
                  {machinesFor(o.segmentId).map((m) => (
                    <option key={m.id} value={m.id} disabled={m.vOkvari}>{m.id} - {m.stroj}{m.vOkvari ? ' (V OKVARI)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <BigLabel>Šifra / tip vijaka</BigLabel>
                <input value={o.sifra} onChange={(e) => setOrder(o.key, { sifra: e.target.value })} className={inpCls} placeholder="npr. 3101011" />
              </div>
              {mi && (
                <div className="sm:col-span-2 p-3 rounded-lg text-sm" style={{ background: '#f0f7f0', border: '1px solid #cde5cd' }}>
                  {o.machineId} - {mi.stroj} · {mi.operacija} · normativ <strong>{formatNumber(mi.normativ_h)} kos/h</strong> (na čas stroja)
                </div>
              )}
              <div>
                <BigLabel>Količina (kos)</BigLabel>
                <input type="number" inputMode="numeric" value={o.kosi} onChange={(e) => setOrder(o.key, { kosi: e.target.value })} className={inpCls} placeholder="0" />
              </div>
              <TimeField label="Čas stroja" h={o.strojH} m={o.strojM}
                setH={(v) => setOrder(o.key, { strojH: v })} setM={(v) => setOrder(o.key, { strojM: v })} />
            </div>
          </Card>
        );
      })}
      {!editLog && (
      <button onClick={addOrder} className="w-full py-3 rounded-lg border-2 border-dashed font-semibold inline-flex items-center justify-center gap-2"
        style={{ borderColor: AS_RED, color: AS_RED }}>
        <Plus className="w-4 h-4" /> Dodaj nalog
      </button>
      )}

      {/* Moji shranjeni nalogi */}
      {dayLogs.length > 0 && (
        <>
          <div className="mt-5 mb-1">
            <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
              <span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />
              Moji shranjeni nalogi ({new Date(datum).toLocaleDateString('sl-SI')})
            </h2>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-as-gray-500 border-b border-as-gray-200">
                    <th className="text-left p-2">Skupina</th>
                    <th className="text-left p-2">Stroj</th>
                    <th className="text-left p-2">Šifra</th>
                    <th className="text-left p-2">Nalog</th>
                    <th className="text-right p-2">Kos</th>
                    <th className="text-right p-2">Čas stroja</th>
                    <th className="text-right p-2">%</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dayLogs.map((r) => (
                    <tr key={r.id} className="border-b border-as-gray-100">
                      <td className="p-2">{segLabelOf(r.segment)}</td>
                      <td className="p-2">{r.machine_id ? `${r.machine_id} - ${r.machine_name || ''}` : (r.machine_name || '—')}</td>
                      <td className="p-2">{r.tip_vijaka || '—'}</td>
                      <td className="p-2">{r.delovni_nalog || '—'}</td>
                      <td className="p-2 text-right">{formatNumber(r.kosi)}</td>
                      <td className="p-2 text-right font-semibold">{hoursToHM(r.cas_ur)}</td>
                      <td className="p-2 text-right">{r.ucinkovitost_pct != null ? `${Math.round(r.ucinkovitost_pct)}%` : '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {canEditDay ? (
                          <>
                            <button onClick={() => startEditLog(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                            <button onClick={() => deleteLog(r)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <span className="text-xs text-as-gray-400">🔒</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!canEditDay && <div className="text-xs text-as-gray-400 mt-2">Vnose za pretekle dni lahko popravi samo Boris/admin.</div>}
          </Card>
        </>
      )}

      </div>

      {/* Sticky SHRANI */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-as-gray-200">
        <button onClick={handleSave} disabled={saving}
          className="max-w-3xl mx-auto w-full py-4 rounded-xl text-white font-bold text-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: AS_RED }}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {saving ? 'Shranjujem…' : editLog ? 'SHRANI SPREMEMBO' : 'SHRANI NALOGE'}
        </button>
      </div>

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

const selCls = "w-full px-3 py-3 border border-as-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-as-red-600";
const inpCls = "w-full px-3 py-3 border border-as-gray-200 rounded-lg bg-white text-base focus:outline-none focus:border-as-red-600";

function Card({ children }) {
  return <div className="bg-white rounded-xl border border-as-gray-200 p-4 mb-3">{children}</div>;
}
function BigLabel({ children }) {
  return <label className="block text-sm font-semibold text-as-gray-600 mb-1">{children}</label>;
}
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
