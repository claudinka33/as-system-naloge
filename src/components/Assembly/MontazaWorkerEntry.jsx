// MontazaWorkerEntry.jsx — Vnos montaže po segmentih (avtomat / ročna / vreče / titus)
// Piše v assembly_work_log (+ faza za ročno) in assembly_work_stops (zastoji).
// Šifrant: assembly_catalog. Segmente delavca določi Milena (assembly_workers.segments).
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Check, Loader2, X, Package, BarChart3 } from 'lucide-react';
import { supabase } from '../../supabase';
import MojaNorma from './MojaNorma.jsx';

const AS_RED = '#C8102E';

const SEGMENT_DEFS = [
  { key: 'avtomat', label: 'Avtomat' },
  { key: 'rocna', label: 'Ročna' },
  { key: 'vrece', label: 'Vreče' },
  { key: 'titus', label: 'Titus' },
];
const VRECE_STROJI = ['Vrečke 1', 'Vrečke 2'];

function hmToHours(h, m) {
  const hh = parseInt(h, 10) || 0;
  const mm = parseInt(m, 10) || 0;
  return Math.round((hh + mm / 60) * 1000) / 1000;
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
});
const blankStop = () => ({ key: newKey(), reason: '', newReason: '', linkKey: '', h: '', m: '', opomba: '' });

export default function MontazaWorkerEntry({ currentUser }) {
  const fixedWorkerId = currentUser?.assemblyWorkerId || null;

  const [view, setView] = useState('vnos');
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [workers, setWorkers] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [workerId, setWorkerId] = useState(fixedWorkerId ? String(fixedWorkerId) : '');
  const [segment, setSegment] = useState('');

  const [orders, setOrders] = useState([blankOrder()]);
  const [stops, setStops] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

  const selWorker = workers.find((w) => String(w.id) === String(fixedWorkerId || workerId));
  const workerName = fixedWorkerId ? (currentUser?.name || selWorker?.name || '') : (selWorker?.name || '');

  // Segmenti, ki jih delavec vidi (če ni določeno, vidi vse)
  const allowedSegments = useMemo(() => {
    const segs = selWorker?.segments || [];
    const allowed = segs.length ? SEGMENT_DEFS.filter((s) => segs.includes(s.key)) : SEGMENT_DEFS;
    return allowed;
  }, [selWorker]);

  useEffect(() => {
    if (allowedSegments.length && !allowedSegments.some((s) => s.key === segment)) {
      setSegment(allowedSegments[0].key);
      setOrders([blankOrder()]); setStops([]);
    }
    // eslint-disable-next-line
  }, [allowedSegments.map((s) => s.key).join(',')]);

  function switchSegment(k) {
    if (k === segment) return;
    setSegment(k);
    setOrders([blankOrder()]);
    setStops([]);
    setError('');
  }

  // — šifrant za trenutni segment —
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
    // numerično sortiranje dimenzij (8x80 < 8x115 < 10x60)
    const dims = uniq(rows.map((c) => c.dimenzija));
    return dims.sort((a, b) => {
      const pa = String(a).split('x').map(Number), pb = String(b).split('x').map(Number);
      return (pa[0] - pb[0]) || ((pa[1] || 0) - (pb[1] || 0));
    });
  };
  const catRowFor = (o) => {
    if (segment === 'titus') return segCatalog.find((c) => c.sifra === o.sifra) || null;
    return segCatalog.find((c) =>
      c.artikel === o.artikel && c.dimenzija === o.dimenzija &&
      (segment !== 'avtomat' || c.stroj === o.stroj)) || null;
  };

  // — orders —
  const setOrder = (key, patch) => setOrders((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const addOrder = () => setOrders((p) => [...p, blankOrder()]);
  const removeOrder = (key) => setOrders((p) => (p.length > 1 ? p.filter((o) => o.key !== key) : p));

  // — stops —
  const setStop = (key, field, val) => setStops((p) => p.map((s) => (s.key === key ? { ...s, [field]: val } : s)));
  const addStop = () => setStops((p) => [...p, blankStop()]);
  const removeStop = (key) => setStops((p) => p.filter((s) => s.key !== key));

  function resetForm() {
    setOrders([blankOrder()]);
    setStops([]);
  }

  const orderHasData = (o) => {
    if (segment === 'rocna') return o.nalog || o.sifra || o.kolSt || o.kolVj;
    return o.nalog || o.sifra || o.kolicina;
  };

  async function handleSave() {
    setError('');
    const wid = fixedWorkerId || (workerId ? Number(workerId) : null);
    if (!wid) { setError('Izberi delavko.'); return; }
    if (!datum) { setError('Izberi datum.'); return; }
    if (!segment) { setError('Izberi segment.'); return; }

    const orderRows = orders.filter(orderHasData);
    const stopRows = stops.filter((s) => (s.reason || s.newReason) && (s.h || s.m));
    if (orderRows.length === 0 && stopRows.length === 0) { setError('Vnesi vsaj en delovni nalog.'); return; }

    // validacija: šifra mora biti razrešena, če je vnesena količina
    for (const o of orderRows) {
      const cat = catRowFor(o);
      if (!cat) { setError(`Nalog ${o.nalog || '?'}: izberi artikel/dimenzijo (šifra ni določena).`); return; }
      if (segment === 'rocna' && !(Number(o.kolSt) || Number(o.kolVj))) {
        setError(`Nalog ${o.nalog || '?'}: vnesi količino za stiskanje in/ali vijačenje.`); return;
      }
    }

    setSaving(true);
    try {
      // Nove razloge zastoja shrani v šifrant
      const existing = new Set(reasons.map((r) => r.reason.trim().toLowerCase()));
      const toAdd = [];
      let ord = (reasons.reduce((mx, r) => Math.max(mx, r.display_order || 0), 0)) + 10;
      for (const s of stopRows) {
        const rname = (s.newReason || '').trim();
        if (s.reason === '__new__' && rname.length > 0 && !existing.has(rname.toLowerCase())) {
          existing.add(rname.toLowerCase());
          toAdd.push({ reason: rname, display_order: ord }); ord += 10;
        }
      }
      if (toAdd.length) {
        await supabase.from('assembly_stop_reasons').upsert(toAdd, { onConflict: 'reason' });
        const mr = await supabase.from('assembly_stop_reasons').select('id,reason,active,display_order').eq('active', true).order('display_order');
        setReasons(mr.data || []);
      }

      // sestavi vrstice za work_log
      const payload = [];
      const rowMeta = []; // za povezavo zastojev: index prve vrstice vsakega naloga
      for (const o of orderRows) {
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
        rowMeta.push({ key: o.key, index: payload.length });
        if (segment === 'avtomat') {
          payload.push({ ...base, machine_name: o.stroj || null, faza: null,
            kolicina: Number(o.kolicina) || 0,
            cas_dela_ur: hmToHours(o.delH, o.delM),
            cas_stroja_ur: hmToHours(o.strojH, o.strojM),
            normativ_kos_h: Number(cat.normativ_kos_h) || 0 });
        } else if (segment === 'rocna') {
          if (Number(o.kolSt) || o.hSt || o.mSt) {
            payload.push({ ...base, machine_name: null, faza: 'stiskanje',
              kolicina: Number(o.kolSt) || 0,
              cas_dela_ur: hmToHours(o.hSt, o.mSt), cas_stroja_ur: 0,
              normativ_kos_h: Number(cat.normativ_stiskanje_kos_h) || 0 });
          }
          if (Number(o.kolVj) || o.hVj || o.mVj) {
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

      const logByKey = {};
      if (payload.length) {
        const { data: insLogs, error: e1 } = await supabase.from('assembly_work_log').insert(payload).select();
        if (e1) throw e1;
        for (const meta of rowMeta) {
          const row = (insLogs || [])[meta.index];
          if (row) logByKey[meta.key] = row;
        }
      }

      if (stopRows.length) {
        const sp = stopRows.map((s) => {
          const linked = s.linkKey ? logByKey[s.linkKey] : null;
          return {
            date: datum,
            worker_id: wid,
            worker_name: workerName || null,
            reason: ((s.newReason || '').trim() || s.reason || '').trim(),
            cas_ur: hmToHours(s.h, s.m),
            opomba: (s.opomba || '').trim(),
            log_id: linked ? linked.id : null,
            delovni_nalog: linked ? (linked.delovni_nalog || null) : null,
            created_by: currentUser?.email || null,
          };
        });
        const { error: e2 } = await supabase.from('assembly_work_stops').insert(sp);
        if (e2) throw e2;
      }

      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 1800);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setSaving(false);
    }
  }

  const currentWid = fixedWorkerId || (workerId ? Number(workerId) : null);

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
          {currentWid && (
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

      {view === 'norma' && currentWid ? (
        <div className="max-w-3xl mx-auto px-4 py-5">
          <MojaNorma workerId={currentWid} workerName={workerName} />
        </div>
      ) : (
      <div className="max-w-3xl mx-auto px-4 py-5">

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg border text-sm" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <X className="w-4 h-4" /> <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Glava vnosa */}
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
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={selCls} />
          </div>
        </div>
        <div className="mt-3">
          <BigLabel>Segment</BigLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {allowedSegments.map((s) => (
              <button key={s.key} onClick={() => switchSegment(s.key)}
                className={`py-3 rounded-lg font-bold text-sm border-2 transition ${segment === s.key ? 'text-white' : 'bg-white text-as-gray-600 border-as-gray-200'}`}
                style={segment === s.key ? { background: AS_RED, borderColor: AS_RED } : {}}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Delovni nalogi */}
      <div className="mt-4 mb-1 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
          <span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />
          Delovni nalogi — {SEGMENT_DEFS.find((s) => s.key === segment)?.label || ''}
        </h2>
      </div>

      {orders.map((o, idx) => {
        const cat = catRowFor(o);
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

              {/* AVTOMAT: stroj → artikel → dimenzija */}
              {segment === 'avtomat' && (
                <div>
                  <BigLabel>Stroj</BigLabel>
                  <select value={o.stroj} onChange={(e) => setOrder(o.key, { stroj: e.target.value, artikel: '', dimenzija: '' })} className={selCls}>
                    <option value="">— izberi stroj —</option>
                    {strojOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* VREČE: stroj (Vrečke 1/2) */}
              {segment === 'vrece' && (
                <div>
                  <BigLabel>Stroj</BigLabel>
                  <select value={o.stroj} onChange={(e) => setOrder(o.key, { stroj: e.target.value })} className={selCls}>
                    <option value="">— izberi stroj —</option>
                    {VRECE_STROJI.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* TITUS: šifra direktno */}
              {segment === 'titus' ? (
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

              {/* Šifra + normativ (avtomatsko) */}
              <div className="sm:col-span-2">
                {cat ? (
                  <div className="p-3 rounded-lg text-sm" style={{ background: '#f0f7f0', border: '1px solid #cde5cd' }}>
                    Šifra: <strong>{cat.sifra}</strong>
                    {segment === 'rocna' ? (
                      <> · stiskanje <strong>{formatNumber(cat.normativ_stiskanje_kos_h)} kos/h</strong> · vijačenje+pak. <strong>{formatNumber(cat.normativ_vijacenje_kos_h)} kos/h</strong></>
                    ) : (
                      <> · normativ <strong>{formatNumber(cat.normativ_kos_h)} {segment === 'vrece' ? 'vrečk/h' : segment === 'titus' ? 'škatel/h' : 'kos/h'}</strong></>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-as-gray-400">Šifra se prikaže, ko izbereš {segment === 'titus' ? 'šifro' : 'artikel in dimenzijo'}.</div>
                )}
              </div>

              {/* Količine in časi */}
              {segment === 'rocna' ? (
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
                  <TimeField label="Čas dela" h={o.delH} m={o.delM} setH={(v) => setOrder(o.key, { delH: v })} setM={(v) => setOrder(o.key, { delM: v })} />
                  {segment === 'avtomat' && (
                    <TimeField label="Čas stroja" h={o.strojH} m={o.strojM} setH={(v) => setOrder(o.key, { strojH: v })} setM={(v) => setOrder(o.key, { strojM: v })} />
                  )}
                </>
              )}
            </div>
          </Card>
        );
      })}
      <button onClick={addOrder} className="w-full py-3 rounded-lg border-2 border-dashed font-semibold inline-flex items-center justify-center gap-2"
        style={{ borderColor: AS_RED, color: AS_RED }}>
        <Plus className="w-4 h-4" /> Dodaj nalog
      </button>

      {/* Zastoji */}
      <div className="mt-5 mb-1 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: '#F39C12' }}><span className="inline-block w-1.5 h-5 rounded" style={{ background: '#F39C12' }} />Zastoji <span className="text-as-gray-400 font-normal text-sm">(neobvezno)</span></h2>
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
                {reasons.map((r) => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                <option value="__new__">➕ Nov razlog…</option>
              </select>
              {s.reason === '__new__' && (
                <input value={s.newReason} onChange={(e) => setStop(s.key, 'newReason', e.target.value)} className={inpCls + ' mt-2'} placeholder="vpiši nov razlog (ostane shranjen)" />
              )}
            </div>
            <div>
              <BigLabel>Vezan na nalog</BigLabel>
              <select value={s.linkKey} onChange={(e) => setStop(s.key, 'linkKey', e.target.value)} className={selCls}>
                <option value="">Ni vezan (splošno)</option>
                {orders.filter(orderHasData).map((o, i) => (
                  <option key={o.key} value={o.key}>{(o.nalog || o.sifra) || `Nalog ${i + 1}`}</option>
                ))}
              </select>
            </div>
            <TimeField label="Trajanje" h={s.h} m={s.m} setH={(v) => setStop(s.key, 'h', v)} setM={(v) => setStop(s.key, 'm', v)} />
            <div className="sm:col-span-2">
              <BigLabel>Opomba</BigLabel>
              <input value={s.opomba} onChange={(e) => setStop(s.key, 'opomba', e.target.value)} className={inpCls} placeholder="neobvezno" />
            </div>
          </div>
        </Card>
      ))}
      <button onClick={addStop} className="w-full py-3 rounded-lg border-2 border-dashed font-semibold inline-flex items-center justify-center gap-2 border-as-gray-300 text-as-gray-600">
        <Plus className="w-4 h-4" /> Dodaj zastoj
      </button>

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
