// MontazaWorkerEntry.jsx — Tablični vnos za delavke montaže
// Piše v assembly_work_log (en delovni nalog = ena vrstica) + assembly_work_stops (zastoji).
// → analiza montaže (line-item) dela na teh tabelah.
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Check, Loader2, X, Clock, Package } from 'lucide-react';
import { supabase } from '../../supabase';

const AS_RED = '#C8102E';

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
const blankOrder = () => ({ key: newKey(), nalog: '', sifra: '', machineId: '', kolicina: '', delH: '', delM: '', strojH: '', strojM: '' });
const blankStop = () => ({ key: newKey(), reason: '', newReason: '', h: '', m: '', opomba: '' });

export default function MontazaWorkerEntry({ currentUser }) {
  const fixedWorkerId = currentUser?.assemblyWorkerId || null;

  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [sifraList, setSifraList] = useState([]);
  const [workerId, setWorkerId] = useState(fixedWorkerId ? String(fixedWorkerId) : '');

  const [orders, setOrders] = useState([blankOrder()]);
  const [stops, setStops] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [mw, mm, mr, ms] = await Promise.all([
        supabase.from('assembly_workers').select('id,name,active').eq('active', true).order('display_order'),
        supabase.from('assembly_machines').select('id,name,active').eq('active', true).order('display_order'),
        supabase.from('assembly_stop_reasons').select('id,reason,active,display_order').eq('active', true).order('display_order'),
        supabase.from('assembly_sifra_normativ').select('sifra,naziv,normativ_kos_h,active').eq('active', true),
      ]);
      setWorkers(mw.data || []);
      setMachines(mm.data || []);
      setReasons(mr.data || []);
      setSifraList(ms.data || []);
    })();
  }, []);

  const sifraMap = useMemo(() => {
    const map = {};
    for (const s of sifraList) map[String(s.sifra).trim().toLowerCase()] = s;
    return map;
  }, [sifraList]);
  const normForSifra = (sifra) => {
    const hit = sifraMap[String(sifra || '').trim().toLowerCase()];
    return hit ? Number(hit.normativ_kos_h) || 0 : 0;
  };

  const workerName = fixedWorkerId
    ? (currentUser?.name || '')
    : (workers.find((w) => String(w.id) === String(workerId))?.name || '');

  // — orders —
  const setOrder = (key, field, val) => setOrders((p) => p.map((o) => (o.key === key ? { ...o, [field]: val } : o)));
  const addOrder = () => setOrders((p) => [...p, blankOrder()]);
  const removeOrder = (key) => setOrders((p) => (p.length > 1 ? p.filter((o) => o.key !== key) : p));

  // — stops —
  const setStop = (key, field, val) => setStops((p) => p.map((s) => (s.key === key ? { ...s, [field]: val } : s)));
  const addStop = () => setStops((p) => [...p, blankStop()]);
  const removeStop = (key) => setStops((p) => p.filter((s) => s.key !== key));

  function resetForm() {
    setOrders([blankOrder()]);
    setStops([]);
    if (!fixedWorkerId) setWorkerId('');
  }

  async function handleSave() {
    setError('');
    const wid = fixedWorkerId || (workerId ? Number(workerId) : null);
    if (!wid) { setError('Izberi delavko.'); return; }
    if (!datum) { setError('Izberi datum.'); return; }

    const orderRows = orders.filter((o) => (o.nalog || o.sifra || o.kolicina));
    const stopRows = stops.filter((s) => (s.reason || s.newReason) && (s.h || s.m));
    if (orderRows.length === 0 && stopRows.length === 0) { setError('Vnesi vsaj en delovni nalog.'); return; }

    setSaving(true);
    try {
      // Nove razloge zastoja shrani v šifrant (ostanejo v spominu)
      const existing = new Set(reasons.map((r) => r.reason.trim().toLowerCase()));
      const toAdd = [];
      let ord = (reasons.reduce((mx, r) => Math.max(mx, r.display_order || 0), 0)) + 10;
      for (const s of stopRows) {
        const rname = (s.newReason || '').trim();
        if (rname_ok(rname, s.reason) && !existing.has(rname.toLowerCase())) {
          existing.add(rname.toLowerCase());
          toAdd.push({ reason: rname, display_order: ord }); ord += 10;
        }
      }
      if (toAdd.length) {
        await supabase.from('assembly_stop_reasons').upsert(toAdd, { onConflict: 'reason' });
        const mr = await supabase.from('assembly_stop_reasons').select('id,reason,active,display_order').eq('active', true).order('display_order');
        setReasons(mr.data || []);
      }

      if (orderRows.length) {
        const payload = orderRows.map((o) => ({
          date: datum,
          worker_id: wid,
          worker_name: workerName || null,
          machine_id: o.machineId ? Number(o.machineId) : null,
          machine_name: machines.find((m) => String(m.id) === String(o.machineId))?.name || null,
          delovni_nalog: (o.nalog || '').trim() || null,
          sifra: (o.sifra || '').trim() || null,
          kolicina: Number(o.kolicina) || 0,
          cas_dela_ur: hmToHours(o.delH, o.delM),
          cas_stroja_ur: hmToHours(o.strojH, o.strojM),
          normativ_kos_h: normForSifra(o.sifra),
          created_by: currentUser?.email || null,
        }));
        const { error: e1 } = await supabase.from('assembly_work_log').insert(payload);
        if (e1) throw e1;
      }

      if (stopRows.length) {
        const payload = stopRows.map((s) => ({
          date: datum,
          worker_id: wid,
          worker_name: workerName || null,
          reason: ((s.newReason || '').trim() || s.reason || '').trim(),
          cas_ur: hmToHours(s.h, s.m),
          opomba: (s.opomba || '').trim(),
          created_by: currentUser?.email || null,
        }));
        const { error: e2 } = await supabase.from('assembly_work_stops').insert(payload);
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

  return (
    <div className="min-h-screen bg-as-gray-50 pb-32">
      {/* Glava */}
      <div className="text-white px-5 py-4 shadow-md" style={{ background: AS_RED }}>
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8" />
          <div>
            <div className="text-2xl font-bold leading-tight">Vnos montaže</div>
            <div className="text-sm opacity-90">AS system · {new Date(datum).toLocaleDateString('sl-SI')}</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg border text-sm" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <X className="w-4 h-4" /> <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Glava */}
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
      </Card>

      {/* Delovni nalogi */}
      <div className="mt-4 mb-1 flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}><span className="inline-block w-1.5 h-5 rounded" style={{ background: AS_RED }} />Delovni nalogi</h2>
      </div>
      {orders.map((o, idx) => {
        const norm = normForSifra(o.sifra);
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
                <input value={o.nalog} onChange={(e) => setOrder(o.key, 'nalog', e.target.value)} className={inpCls} placeholder="npr. DN-1234" />
              </div>
              <div>
                <BigLabel>Šifra izdelka</BigLabel>
                <input value={o.sifra} onChange={(e) => setOrder(o.key, 'sifra', e.target.value)} className={inpCls} placeholder="šifra" list="sifre-list" />
                {o.sifra && (
                  <div className="text-xs mt-1 text-as-gray-500">
                    {norm > 0 ? <>Normativ: <strong>{formatNumber(norm)} kos/h</strong></> : 'Normativ ni vpisan za to šifro'}
                  </div>
                )}
              </div>
              <div>
                <BigLabel>Stroj / linija</BigLabel>
                <select value={o.machineId} onChange={(e) => setOrder(o.key, 'machineId', e.target.value)} className={selCls}>
                  <option value="">— izberi —</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <BigLabel>Količina (kos)</BigLabel>
                <input type="number" inputMode="numeric" value={o.kolicina} onChange={(e) => setOrder(o.key, 'kolicina', e.target.value)} className={inpCls} placeholder="0" />
              </div>
              <TimeField label="Čas dela" h={o.delH} m={o.delM} setH={(v) => setOrder(o.key, 'delH', v)} setM={(v) => setOrder(o.key, 'delM', v)} />
              <TimeField label="Čas stroja" h={o.strojH} m={o.strojM} setH={(v) => setOrder(o.key, 'strojH', v)} setM={(v) => setOrder(o.key, 'strojM', v)} />
            </div>
          </Card>
        );
      })}
      <datalist id="sifre-list">
        {sifraList.map((s) => <option key={s.sifra} value={s.sifra}>{s.naziv}</option>)}
      </datalist>
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
    </div>
  );
}

// helper: ali je nov razlog veljaven (uporabnik izbral "nov" in vpisal besedilo)
function rname_ok(rname, reason) {
  return reason === '__new__' && rname.length > 0;
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
