// MontazaWorkerEntry.jsx — Vnos montaže po segmentih (avtomat / ročna / vrečke / titus / ostalo)
// v3: zastoji se shranjujejo SPROTI (na vrhu), nalogi na koncu dneva.
//     "Moj čas" delavec vpisuje ročno (assembly_daily_time); števec 7:30 = moj čas + zastoji.
//     Avtomat: normativ na ČAS STROJA. Delavec lahko svoje vnose briše samo isti dan.
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Check, Loader2, X, Package, BarChart3, Clock } from 'lucide-react';
import { supabase } from '../../supabase';
import MojaNorma from './MojaNorma.jsx';

const AS_RED = '#C8102E';
const DAY_TARGET = 7.5; // 7:30 na dan

const SEGMENT_DEFS = [
  { key: 'avtomat', label: 'Avtomat' },
  { key: 'rocna', label: 'Ročna' },
  { key: 'vrece', label: 'Vrečke' },
  { key: 'titus', label: 'Titus' },
  { key: 'ostalo', label: 'Ostalo' },
];
const VRECE_STROJI = ['Vrečke 1', 'Vrečke 2'];

function hmToHours(h, m) {
  const hh = parseInt(h, 10) || 0;
  const mm = parseInt(m, 10) || 0;
  return Math.round((hh + mm / 60) * 1000) / 1000;
}
function hoursToSplit(h) {
  const total = Math.round(Number(h || 0) * 60);
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
}
function hoursToHM(h) {
  const total = Math.round(Number(h || 0) * 60);
  const hh = Math.floor(Math.abs(total) / 60), mm = Math.abs(total) % 60;
  return `${total < 0 ? '-' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}
function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('sl-SI');
}
let _k = 0;
const newKey = () => `r${++_k}`;
const blankOrder = () => ({
  key: newKey(), nalog: '',
  stroj: '', artikel: '', dimenzija: '', sifra: '',
  kolicina: '', delH: '', delM: '', strojH: '', strojM: '',
  kolSt: '', hSt: '', mSt: '', kolVj: '', hVj: '', mVj: '',
  opis: '',
});

export default function MontazaWorkerEntry({ currentUser }) {
  const fixedWorkerId = currentUser?.assemblyWorkerId || null;
  const today = new Date().toISOString().slice(0, 10);

  const [view, setView] = useState('vnos');
  const [datum, setDatum] = useState(today);
  const [workers, setWorkers] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [workerId, setWorkerId] = useState(fixedWorkerId ? String(fixedWorkerId) : '');
  const [segment, setSegment] = useState('');

  const [orders, setOrders] = useState([blankOrder()]);

  // zastoj (sprotni vnos)
  const [stop, setStop] = useState({ reason: '', newReason: '', nalog: '', stroj: '', h: '', m: '', opomba: '' });
  const [savingStop, setSavingStop] = useState(false);

  // moj čas
  const [timeH, setTimeH] = useState('');
  const [timeM, setTimeM] = useState('');
  const [timeVrsta, setTimeVrsta] = useState('stroj');
  const [timeOpis, setTimeOpis] = useState('');
  const [savingTime, setSavingTime] = useState(false);

  // današnji podatki (za števec in sezname)
  const [dayTime, setDayTime] = useState([]);   // assembly_daily_time vrstice
  const [dayStops, setDayStops] = useState([]); // zastoji
  const [dayLogs, setDayLogs] = useState([]);   // nalogi

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [editStopId, setEditStopId] = useState(null);
  const [editLog, setEditLog] = useState(null); // { id, faza }

  // delavec sme urejati samo današnji dan
  const canEditDay = datum === today;

  useEffect(() => {
    (async () => {
      const [mw, mr, mc] = await Promise.all([
        supabase.from('assembly_workers').select('id,name,active,segments').eq('active', true).order('display_order'),
        supabase.from('assembly_stop_reasons').select('id,reason,active,display_order').eq('active', true).order('display_order'),
        supabase.from('assembly_catalog').select('segment,stroj,artikel,dimenzija,sifra,normativ_kos_h,normativ_kos_smeno,normativ_stiskanje_kos_h,normativ_vijacenje_kos_h').eq('active', true),
      ]);
      setWorkers(mw.data || []);
      setReasons(mr.data || []);
      setCatalog(mc.data || []);
    })();
  }, []);

  const wid = fixedWorkerId || (workerId ? Number(workerId) : null);
  const selWorker = workers.find((w) => String(w.id) === String(wid));
  const workerName = fixedWorkerId ? (currentUser?.name || selWorker?.name || '') : (selWorker?.name || '');

  async function loadDay(w, d) {
    if (!w || !d) { setDayTime([]); setDayStops([]); setDayLogs([]); return; }
    const [t, st, lg] = await Promise.all([
      supabase.from('assembly_daily_time').select('id,date,cas_ur,vrsta,opomba').eq('worker_id', w).eq('date', d).order('id'),
      supabase.from('assembly_work_stops').select('id,date,reason,delovni_nalog,cas_ur,opomba,machine_name').eq('worker_id', w).eq('date', d).order('id'),
      supabase.from('assembly_work_log').select('id,date,segment,faza,delovni_nalog,sifra,artikel,dimenzija,machine_name,kolicina,cas_dela_ur,cas_stroja_ur').eq('worker_id', w).eq('date', d).order('id'),
    ]);
    setDayTime(t.data || []);
    setDayStops(st.data || []);
    setDayLogs(lg.data || []);
  }
  useEffect(() => { loadDay(wid, datum); /* eslint-disable-next-line */ }, [wid, datum]);

  const casDelo = dayTime.filter((r) => r.vrsta !== 'malica').reduce((a, r) => a + (Number(r.cas_ur) || 0), 0);
  const casMalica = dayTime.filter((r) => r.vrsta === 'malica').reduce((a, r) => a + (Number(r.cas_ur) || 0), 0);
  const dayTotal = Math.round((casDelo + casMalica) * 1000) / 1000; // delovni dan = delo + malica (cilj 8:00)

  const allowedSegments = useMemo(() => {
    const segs = selWorker?.segments || [];
    const rest = SEGMENT_DEFS.filter((s) => s.key !== 'ostalo');
    const base = segs.length ? rest.filter((s) => segs.includes(s.key)) : rest;
    return [...base, SEGMENT_DEFS.find((s) => s.key === 'ostalo')];
  }, [selWorker]);

  useEffect(() => {
    if (allowedSegments.length && !allowedSegments.some((s) => s.key === segment)) {
      setSegment(allowedSegments[0].key);
      setOrders([blankOrder()]);
    }
    // eslint-disable-next-line
  }, [allowedSegments.map((s) => s.key).join(',')]);

  function switchSegment(k) {
    if (k === segment) return;
    setSegment(k);
    setOrders([blankOrder()]);
    setError('');
  }

  // — šifrant —
  const segCatalog = useMemo(() => catalog.filter((c) => c.segment === segment), [catalog, segment]);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const strojOptions = useMemo(() => uniq(segCatalog.map((c) => c.stroj)).sort(), [segCatalog]);
  const artikelOptions = (o) => {
    let rows = segCatalog;
    if (segment === 'avtomat') rows = rows.filter((c) => c.stroj === o.stroj);
    return uniq(rows.map((c) => c.artikel)).sort();
  };
  const dimenzijaOptions = (o) => {
    let rows = segCatalog.filter((c) => c.artikel === o.artikel);
    if (segment === 'avtomat') rows = rows.filter((c) => c.stroj === o.stroj);
    const dims = uniq(rows.map((c) => c.dimenzija));
    return dims.sort((a, b) => {
      const pa = String(a).split('x').map(Number), pb = String(b).split('x').map(Number);
      return (pa[0] - pb[0]) || ((pa[1] || 0) - (pb[1] || 0));
    });
  };
  const stopStrojOptions = useMemo(() => {
    const avt = uniq(catalog.filter((c) => c.segment === 'avtomat').map((c) => c.stroj)).sort();
    return [...avt, ...VRECE_STROJI];
  }, [catalog]);
  const catRowFor = (o) => {
    if (segment === 'titus') return segCatalog.find((c) => c.sifra === o.sifra) || null;
    return segCatalog.find((c) =>
      c.artikel === o.artikel && c.dimenzija === o.dimenzija &&
      (segment !== 'avtomat' || c.stroj === o.stroj)) || null;
  };

  const setOrder = (key, patch) => setOrders((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const addOrder = () => setOrders((p) => [...p, blankOrder()]);
  const removeOrder = (key) => setOrders((p) => (p.length > 1 ? p.filter((o) => o.key !== key) : p));

  const orderHasData = (o) => {
    if (segment === 'rocna') return o.nalog || o.sifra || o.kolSt || o.kolVj;
    if (segment === 'ostalo') return (o.opis || '').trim() || o.delH || o.delM;
    return o.nalog || o.sifra || o.kolicina;
  };

  // ===== MOJ ČAS =====
  async function saveMyTime() {
    setError('');
    if (!wid) { setError('Izberi delavko.'); return; }
    if (!canEditDay && fixedWorkerId) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const c = hmToHours(timeH, timeM);
    if (!c) { setError('Vpiši svoj čas (ure in/ali minute).'); return; }
    if (timeVrsta === 'ostalo' && !(timeOpis || '').trim()) { setError('Ostalo: vpiši kaj si delala (opis).'); return; }
    setSavingTime(true);
    const { error: e } = await supabase.from('assembly_daily_time').insert({
      date: datum, worker_id: wid, worker_name: workerName || null, cas_ur: c,
      vrsta: timeVrsta, opomba: timeVrsta === 'ostalo' ? (timeOpis || '').trim() : null,
      created_by: currentUser?.email || null,
    });
    setSavingTime(false);
    if (e) { setError(e.message); return; }
    setTimeH(''); setTimeM(''); setTimeOpis('');
    loadDay(wid, datum);
  }
  async function deleteMyTime(r) {
    if (fixedWorkerId && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const { error: e } = await supabase.from('assembly_daily_time').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(wid, datum);
  }

  // ===== ZASTOJ (sprotni) =====
  async function saveStop() {
    setError('');
    if (!wid) { setError('Izberi delavko.'); return; }
    if (!canEditDay && fixedWorkerId) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const rname = stop.reason === '__new__' ? (stop.newReason || '').trim() : stop.reason;
    if (!rname) { setError('Zastoj: izberi ali vpiši razlog.'); return; }
    const c = hmToHours(stop.h, stop.m);
    if (!c) { setError('Zastoj: vpiši trajanje.'); return; }
    setSavingStop(true);
    try {
      if (stop.reason === '__new__') {
        const exists = reasons.some((r) => r.reason.trim().toLowerCase() === rname.toLowerCase());
        if (!exists) {
          const ord = (reasons.reduce((mx, r) => Math.max(mx, r.display_order || 0), 0)) + 10;
          await supabase.from('assembly_stop_reasons').upsert([{ reason: rname, display_order: ord }], { onConflict: 'reason' });
          const mr = await supabase.from('assembly_stop_reasons').select('id,reason,active,display_order').eq('active', true).order('display_order');
          setReasons(mr.data || []);
        }
      }
      const rec = {
        date: datum, worker_id: wid, worker_name: workerName || null,
        reason: rname, cas_ur: c,
        opomba: (stop.opomba || '').trim(),
        delovni_nalog: (stop.nalog || '').trim() || null,
        machine_name: stop.stroj || null,
        created_by: currentUser?.email || null,
      };
      const { error: e } = editStopId
        ? await supabase.from('assembly_work_stops').update(rec).eq('id', editStopId)
        : await supabase.from('assembly_work_stops').insert({ ...rec, log_id: null });
      if (e) throw e;
      setStop({ reason: '', newReason: '', nalog: '', stroj: '', h: '', m: '', opomba: '' });
      setEditStopId(null);
      loadDay(wid, datum);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju zastoja.');
    } finally {
      setSavingStop(false);
    }
  }
  function startEditStop(r) {
    const t = hoursToSplit(r.cas_ur);
    const known = reasons.some((x) => x.reason === r.reason);
    setStop({ reason: known ? r.reason : '__new__', newReason: known ? '' : (r.reason || ''), nalog: r.delovni_nalog || '', stroj: r.machine_name || '', h: t.h, m: t.m, opomba: r.opomba || '' });
    setEditStopId(r.id);
    setError('');
  }
  function cancelEditStop() {
    setStop({ reason: '', newReason: '', nalog: '', stroj: '', h: '', m: '', opomba: '' });
    setEditStopId(null);
  }
  function startEditLog(r) {
    setSegment(r.segment || 'avtomat');
    const o = blankOrder();
    o.nalog = r.delovni_nalog || '';
    if (r.segment === 'ostalo') {
      o.opis = r.artikel || '';
      const t = hoursToSplit(r.cas_dela_ur); o.delH = t.h; o.delM = t.m;
    } else if (r.segment === 'avtomat') {
      o.stroj = r.machine_name || ''; o.artikel = r.artikel || ''; o.dimenzija = r.dimenzija || '';
      o.kolicina = String(r.kolicina ?? '');
      const t = hoursToSplit(r.cas_stroja_ur); o.strojH = t.h; o.strojM = t.m;
    } else if (r.segment === 'rocna') {
      o.artikel = r.artikel || ''; o.dimenzija = r.dimenzija || '';
      const t = hoursToSplit(r.cas_dela_ur);
      if (r.faza === 'stiskanje') { o.kolSt = String(r.kolicina ?? ''); o.hSt = t.h; o.mSt = t.m; }
      else { o.kolVj = String(r.kolicina ?? ''); o.hVj = t.h; o.mVj = t.m; }
    } else if (r.segment === 'vrece') {
      o.stroj = r.machine_name || ''; o.artikel = r.artikel || ''; o.dimenzija = r.dimenzija || '';
      o.kolicina = String(r.kolicina ?? '');
      const t = hoursToSplit(r.cas_dela_ur); o.delH = t.h; o.delM = t.m;
    } else { // titus
      o.sifra = r.sifra || ''; o.kolicina = String(r.kolicina ?? '');
      const t = hoursToSplit(r.cas_dela_ur); o.delH = t.h; o.delM = t.m;
    }
    setOrders([o]);
    setEditLog({ id: r.id, faza: r.faza || null });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEditLog() {
    setOrders([blankOrder()]);
    setEditLog(null);
  }
  async function deleteStop(r) {
    if (fixedWorkerId && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    const { error: e } = await supabase.from('assembly_work_stops').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(wid, datum);
  }

  // ===== NALOGI =====
  async function handleSave() {
    setError('');
    if (!wid) { setError('Izberi delavko.'); return; }
    if (!datum) { setError('Izberi datum.'); return; }
    if (!segment) { setError('Izberi segment.'); return; }
    if (!canEditDay && fixedWorkerId) { setError('Vnos za pretekle dni je zaklenjen.'); return; }

    const orderRows = orders.filter(orderHasData);
    if (orderRows.length === 0) { setError('Vnesi vsaj en delovni nalog.'); return; }

    for (const o of orderRows) {
      if (segment === 'ostalo') {
        if (!(o.opis || '').trim()) { setError('Ostalo delo: vpiši opis dela.'); return; }
        if (!hmToHours(o.delH, o.delM)) { setError('Ostalo delo: vpiši čas.'); return; }
        continue;
      }
      const cat = catRowFor(o);
      if (!cat) { setError(`Nalog ${o.nalog || '?'}: izberi artikel/dimenzijo (šifra ni določena).`); return; }
      if (segment === 'avtomat' && !hmToHours(o.strojH, o.strojM)) {
        setError(`Nalog ${o.nalog || '?'}: vpiši čas stroja.`); return;
      }
      if (segment === 'rocna' && !(Number(o.kolSt) || Number(o.kolVj))) {
        setError(`Nalog ${o.nalog || '?'}: vnesi količino za stiskanje in/ali vijačenje.`); return;
      }
    }

    setSaving(true);
    try {
      const payload = [];
      for (const o of orderRows) {
        if (segment === 'ostalo') {
          payload.push({
            date: datum, worker_id: wid, worker_name: workerName || null,
            segment: 'ostalo', delovni_nalog: (o.nalog || '').trim() || null,
            sifra: 'OSTALO', artikel: (o.opis || '').trim(), dimenzija: null,
            machine_id: null, machine_name: null, faza: null,
            kolicina: 0, cas_dela_ur: hmToHours(o.delH, o.delM), cas_stroja_ur: 0,
            normativ_kos_h: 0, created_by: currentUser?.email || null,
          });
          continue;
        }
        const cat = catRowFor(o);
        const base = {
          date: datum,
          worker_id: wid,
          worker_name: workerName || null,
          segment,
          delovni_nalog: (o.nalog || '').trim() || null,
          sifra: cat.sifra,
          artikel: cat.artikel || null,
          dimenzija: cat.dimenzija || null,
          machine_id: null,
          created_by: currentUser?.email || null,
        };
        if (segment === 'avtomat') {
          // normativ na ČAS STROJA; delavčev čas se vodi posebej (Moj čas)
          payload.push({ ...base, machine_name: o.stroj || null, faza: null,
            kolicina: Number(o.kolicina) || 0,
            cas_dela_ur: 0,
            cas_stroja_ur: hmToHours(o.strojH, o.strojM),
            normativ_kos_h: Number(cat.normativ_kos_h) || 0 });
        } else if (segment === 'rocna') {
          const allowSt = !editLog || editLog.faza === 'stiskanje';
          const allowVj = !editLog || editLog.faza === 'vijacenje';
          if (allowSt && (Number(o.kolSt) || o.hSt || o.mSt)) {
            payload.push({ ...base, machine_name: null, faza: 'stiskanje',
              kolicina: Number(o.kolSt) || 0,
              cas_dela_ur: hmToHours(o.hSt, o.mSt), cas_stroja_ur: 0,
              normativ_kos_h: Number(cat.normativ_stiskanje_kos_h) || 0 });
          }
          if (allowVj && (Number(o.kolVj) || o.hVj || o.mVj)) {
            payload.push({ ...base, machine_name: null, faza: 'vijacenje',
              kolicina: Number(o.kolVj) || 0,
              cas_dela_ur: hmToHours(o.hVj, o.mVj), cas_stroja_ur: 0,
              normativ_kos_h: Number(cat.normativ_vijacenje_kos_h) || 0 });
          }
        } else if (segment === 'vrece') {
          payload.push({ ...base, machine_name: o.stroj || null, faza: null,
            kolicina: Number(o.kolicina) || 0,
            cas_dela_ur: hmToHours(o.delH, o.delM), cas_stroja_ur: 0,
            normativ_kos_h: Number(cat.normativ_kos_h) || 0 });
        } else { // titus
          payload.push({ ...base, machine_name: null, faza: null,
            kolicina: Number(o.kolicina) || 0,
            cas_dela_ur: hmToHours(o.delH, o.delM), cas_stroja_ur: 0,
            normativ_kos_h: Number(cat.normativ_kos_h) || 24 });
        }
      }

      if (editLog) {
        const upd = { ...payload[0] };
        const { error: e1 } = await supabase.from('assembly_work_log').update(upd).eq('id', editLog.id);
        if (e1) throw e1;
        setEditLog(null);
      } else {
        const { error: e1 } = await supabase.from('assembly_work_log').insert(payload);
        if (e1) throw e1;
      }

      setSuccess(true);
      setOrders([blankOrder()]);
      loadDay(wid, datum);
      setTimeout(() => setSuccess(false), 1800);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(r) {
    if (fixedWorkerId && r.date !== today) { setError('Vnos za pretekle dni je zaklenjen.'); return; }
    if (!window.confirm('Izbrišem ta vnos?')) return;
    const { error: e } = await supabase.from('assembly_work_log').delete().eq('id', r.id);
    if (e) { setError(e.message); return; }
    loadDay(wid, datum);
  }

  const segLabel = (r) => {
    const m = { avtomat: 'Avtomat', rocna: 'Ročna', vrece: 'Vrečke', titus: 'Titus', ostalo: 'Ostalo' };
    const s = m[r.segment] || r.segment || '—';
    return r.faza ? `${s} · ${r.faza === 'vijacenje' ? 'vijačenje' : r.faza}` : s;
  };

  return (
    <div className="min-h-screen bg-as-gray-50 pb-32">
      {/* Glava */}
      <div className="text-white px-5 py-4 shadow-md" style={{ background: AS_RED }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8" />
            <div>
              <div className="text-2xl font-bold leading-tight">Vnos montaže</div>
              <div className="text-sm opacity-90">AS system · {new Date(datum).toLocaleDateString('sl-SI')}</div>
            </div>
          </div>
          {wid && (
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

      {view === 'norma' && wid ? (
        <div className="max-w-3xl mx-auto px-4 py-5">
          <MojaNorma workerId={wid} workerName={workerName} />
        </div>
      ) : (
      <div className="max-w-3xl mx-auto px-4 py-5">

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg border text-sm" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <X className="w-4 h-4" /> <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Delavka + datum */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <BigLabel>Delavka</BigLabel>
            {fixedWorkerId ? (
              <div className="px-3 py-3 rounded-lg bg-as-gray-100 font-semibold">{currentUser?.name}</div>
            ) : (
              <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className={selCls}>
                <option value="">— izberi delavko —</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <BigLabel>Datum</BigLabel>
            {fixedWorkerId ? (
              <div className="px-3 py-3 rounded-lg bg-as-gray-100 font-semibold">{new Date(today).toLocaleDateString('sl-SI')} (danes)</div>
            ) : (
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={selCls} />
            )}
          </div>
        </div>
      </Card>

      {/* MOJ ČAS + števec 7:30 */}
      {wid && (
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
                <div className="text-xs font-semibold mt-1 mb-3" style={{ color }}>{msg} · delo {hoursToHM(casDelo)} / 7:30 · malica {hoursToHM(casMalica)}</div>
              </>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <BigLabel>Vrsta</BigLabel>
              <select value={timeVrsta} onChange={(e) => setTimeVrsta(e.target.value)} className={selCls}>
                <option value="stroj">Delo na stroju</option>
                <option value="malica">Malica</option>
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
                <BigLabel>Kaj si delala (opis)</BigLabel>
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

      {/* ZASTOJI — sprotni vnos (na vrhu) */}
      {wid && (
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
                  {reasons.map((r) => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                  <option value="__new__">➕ Nov razlog…</option>
                </select>
                {stop.reason === '__new__' && (
                  <input value={stop.newReason} onChange={(e) => setStop((p) => ({ ...p, newReason: e.target.value }))} className={inpCls + ' mt-2'} placeholder="vpiši nov razlog (ostane shranjen)" />
                )}
              </div>
              <div>
                <BigLabel>Št. delovnega naloga (neobvezno)</BigLabel>
                <input value={stop.nalog} onChange={(e) => setStop((p) => ({ ...p, nalog: e.target.value }))} className={inpCls} placeholder="npr. DN-1234 ali prazno" />
              </div>
              <div>
                <BigLabel>Stroj (neobvezno — avtomat/vrečke)</BigLabel>
                <select value={stop.stroj} onChange={(e) => setStop((p) => ({ ...p, stroj: e.target.value }))} className={selCls}>
                  <option value="">— brez stroja (ročna, titus) —</option>
                  {stopStrojOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <TimeField label="Trajanje" h={stop.h} m={stop.m}
                setH={(v) => setStop((p) => ({ ...p, h: v }))} setM={(v) => setStop((p) => ({ ...p, m: v }))} />
              <div>
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
                        <td className="p-2">{r.reason}</td>
                        <td className="p-2">{r.machine_name || '—'}</td>
                        <td className="p-2">{r.delovni_nalog || '—'}</td>
                        <td className="p-2 text-right font-semibold">{hoursToHM(r.cas_ur)}</td>
                        <td className="p-2">{r.opomba || '—'}</td>
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

      {/* Segment + nalogi */}
      <Card>
        <BigLabel>Segment</BigLabel>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {allowedSegments.map((s) => (
            <button key={s.key} onClick={() => switchSegment(s.key)}
              className={`py-3 rounded-lg font-bold text-sm border-2 transition ${segment === s.key ? 'text-white' : 'bg-white text-as-gray-600 border-as-gray-200'}`}
              style={segment === s.key ? { background: AS_RED, borderColor: AS_RED } : {}}>
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-4 mb-1 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
          <span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />
          Delovni nalogi — {SEGMENT_DEFS.find((s) => s.key === segment)?.label || ''}
          <span className="text-as-gray-400 font-normal text-sm">{editLog ? '(urejaš shranjen vnos)' : '(vpiši na koncu dneva)'}</span>
        </h2>
        {editLog && (
          <button onClick={cancelEditLog} className="px-3 py-1.5 rounded-lg border border-as-gray-200 text-sm font-semibold">Prekliči urejanje</button>
        )}
      </div>

      {orders.map((o, idx) => {
        const cat = segment === 'ostalo' ? null : catRowFor(o);
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

              {segment === 'avtomat' && (
                <div>
                  <BigLabel>Stroj</BigLabel>
                  <select value={o.stroj} onChange={(e) => setOrder(o.key, { stroj: e.target.value, artikel: '', dimenzija: '' })} className={selCls}>
                    <option value="">— izberi stroj —</option>
                    {strojOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {segment === 'vrece' && (
                <div>
                  <BigLabel>Stroj</BigLabel>
                  <select value={o.stroj} onChange={(e) => setOrder(o.key, { stroj: e.target.value })} className={selCls}>
                    <option value="">— izberi stroj —</option>
                    {VRECE_STROJI.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {segment === 'ostalo' ? (
                <div className="sm:col-span-2">
                  <BigLabel>Ostalo delo</BigLabel>
                  <input value={o.opis} onChange={(e) => setOrder(o.key, { opis: e.target.value })} className={inpCls} placeholder="npr. čiščenje, urejanje skladišča, pomoč…" />
                </div>
              ) : segment === 'titus' ? (
                <div>
                  <BigLabel>Šifra izdelka</BigLabel>
                  <select value={o.sifra} onChange={(e) => setOrder(o.key, { sifra: e.target.value })} className={selCls}>
                    <option value="">— izberi šifro —</option>
                    {segCatalog.map((c) => (
                      <option key={c.sifra} value={c.sifra}>{c.sifra}{c.artikel ? ` — ${c.artikel}` : ''}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <BigLabel>Artikel</BigLabel>
                    <select value={o.artikel} disabled={segment === 'avtomat' && !o.stroj}
                      onChange={(e) => setOrder(o.key, { artikel: e.target.value, dimenzija: '' })} className={selCls}>
                      <option value="">— izberi artikel —</option>
                      {artikelOptions(o).map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <BigLabel>Dimenzija</BigLabel>
                    <select value={o.dimenzija} disabled={!o.artikel}
                      onChange={(e) => setOrder(o.key, { dimenzija: e.target.value })} className={selCls}>
                      <option value="">— izberi dimenzijo —</option>
                      {dimenzijaOptions(o).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </>
              )}

              {segment !== 'ostalo' && (
              <div className="sm:col-span-2">
                {cat ? (
                  <div className="p-3 rounded-lg text-sm" style={{ background: '#f0f7f0', border: '1px solid #cde5cd' }}>
                    Šifra: <strong>{cat.sifra}</strong>
                    {segment === 'rocna' ? (
                      <> · stiskanje <strong>{formatNumber(cat.normativ_stiskanje_kos_h)} kos/h</strong> · vijačenje+pak. <strong>{formatNumber(cat.normativ_vijacenje_kos_h)} kos/h</strong></>
                    ) : (
                      <> · normativ <strong>{formatNumber(cat.normativ_kos_h)} {segment === 'vrece' ? 'vrečk/h' : segment === 'titus' ? 'škatel/h' : 'kos/h'}</strong>{segment === 'avtomat' ? ' (na čas stroja)' : ''}</>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-as-gray-400">Šifra se prikaže, ko izbereš {segment === 'titus' ? 'šifro' : 'artikel in dimenzijo'}.</div>
                )}
              </div>
              )}

              {/* Količine in časi */}
              {segment === 'ostalo' ? (
                <TimeField label="Čas" h={o.delH} m={o.delM} setH={(v) => setOrder(o.key, { delH: v })} setM={(v) => setOrder(o.key, { delM: v })} />
              ) : segment === 'rocna' ? (
                <>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-as-gray-200">
                    <div className="sm:col-span-2 font-bold text-sm" style={{ color: AS_RED }}>Stiskanje</div>
                    <div>
                      <BigLabel>Količina (kos)</BigLabel>
                      <input type="number" inputMode="numeric" value={o.kolSt} onChange={(e) => setOrder(o.key, { kolSt: e.target.value })} className={inpCls} placeholder="0" />
                    </div>
                    <TimeField label="Čas" h={o.hSt} m={o.mSt} setH={(v) => setOrder(o.key, { hSt: v })} setM={(v) => setOrder(o.key, { mSt: v })} />
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-as-gray-200">
                    <div className="sm:col-span-2 font-bold text-sm" style={{ color: AS_RED }}>Vijačenje + pakiranje</div>
                    <div>
                      <BigLabel>Količina (kos)</BigLabel>
                      <input type="number" inputMode="numeric" value={o.kolVj} onChange={(e) => setOrder(o.key, { kolVj: e.target.value })} className={inpCls} placeholder="0" />
                    </div>
                    <TimeField label="Čas" h={o.hVj} m={o.mVj} setH={(v) => setOrder(o.key, { hVj: v })} setM={(v) => setOrder(o.key, { mVj: v })} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <BigLabel>Količina ({segment === 'vrece' ? 'vrečke' : segment === 'titus' ? 'škatle' : 'kos'})</BigLabel>
                    <input type="number" inputMode="numeric" value={o.kolicina} onChange={(e) => setOrder(o.key, { kolicina: e.target.value })} className={inpCls} placeholder="0" />
                  </div>
                  {segment === 'avtomat' ? (
                    <TimeField label="Čas stroja" h={o.strojH} m={o.strojM} setH={(v) => setOrder(o.key, { strojH: v })} setM={(v) => setOrder(o.key, { strojM: v })} />
                  ) : (
                    <TimeField label="Čas dela" h={o.delH} m={o.delM} setH={(v) => setOrder(o.key, { delH: v })} setM={(v) => setOrder(o.key, { delM: v })} />
                  )}
                </>
              )}
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

      {/* Moji današnji nalogi */}
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
                    <th className="text-left p-2">Segment</th>
                    <th className="text-left p-2">Šifra / opis</th>
                    <th className="text-left p-2">Artikel</th>
                    <th className="text-left p-2">Nalog</th>
                    <th className="text-right p-2">Kos</th>
                    <th className="text-right p-2">Čas</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dayLogs.map((r) => (
                    <tr key={r.id} className="border-b border-as-gray-100">
                      <td className="p-2">{segLabel(r)}</td>
                      <td className="p-2">{r.segment === 'ostalo' ? (r.artikel || '—') : (r.sifra || '—')}</td>
                      <td className="p-2">{r.segment === 'ostalo' ? '—' : [r.artikel, r.dimenzija].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="p-2">{r.delovni_nalog || '—'}</td>
                      <td className="p-2 text-right">{Number(r.kolicina) ? formatNumber(r.kolicina) : '—'}</td>
                      <td className="p-2 text-right font-semibold">{hoursToHM(r.segment === 'avtomat' ? r.cas_stroja_ur : r.cas_dela_ur)}</td>
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
            {!canEditDay && <div className="text-xs text-as-gray-400 mt-2">Vnose za pretekle dni lahko popravi samo Milena/admin.</div>}
          </Card>
        </>
      )}

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
      </div>
      )}
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
