// ProductionAdmin.jsx — Urejanje proizvodnje (Boris + admini): delavci (uporabniška imena/gesla),
// razlogi zastoja + popravljanje/brisanje vnosov. Stroji/normativi so v zavihku "Stroji".
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, X, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';
const inputCls = "w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-as-red-600";
const num = (v) => Number(v) || 0;
const h1 = (n) => (Math.round(num(n) * 10) / 10).toLocaleString('sl-SI');
const fmt = (n) => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('sl-SI');
function addDays(s, n) { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

const SECTIONS = [
  { key: 'delavci', label: 'Delavci', config: { table: 'production_v2_workers', order: 'display_order', fields: [
    { key: 'name', label: 'Ime', type: 'text', required: true },
    { key: 'username', label: 'Uporabniško ime', type: 'text' },
    { key: 'password', label: 'Geslo', type: 'text' },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktiven', type: 'bool', default: true },
  ] } },
  { key: 'razlogi', label: 'Razlogi zastoja', config: { table: 'production_v2_stop_reasons', order: 'display_order', fields: [
    { key: 'reason', label: 'Razlog', type: 'text', required: true },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktiven', type: 'bool', default: true },
  ] } },
  { key: 'vnosi', label: 'Popravi vnose' },
];

export default function ProductionAdmin() {
  const [section, setSection] = useState('delavci');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 w-fit">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-3 py-1.5 text-sm font-semibold rounded transition ${section === s.key ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
            style={section === s.key ? { backgroundColor: AS_RED } : {}}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'vnosi'
        ? <ProductionLogEditor />
        : <CrudList config={SECTIONS.find((s) => s.key === section).config} />}
    </div>
  );
}

function CrudList({ config }) {
  const { table, fields, order } = config;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr('');
    let q = supabase.from(table).select('*');
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  function openNew() {
    const o = {};
    fields.forEach((f) => { o[f.key] = f.type === 'bool' ? (f.default ?? true) : ''; });
    const ordField = fields.find((f) => f.key === 'display_order');
    if (ordField) o.display_order = (rows.reduce((mx, r) => Math.max(mx, r.display_order || 0), 0)) + 10;
    setEditing(o);
  }

  async function save(form) {
    setErr('');
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) { setErr(`Polje "${f.label}" je obvezno.`); return; }
    }
    setBusy(true);
    const payload = {};
    fields.forEach((f) => {
      let v = form[f.key];
      if (f.type === 'number') v = v === '' || v == null ? 0 : Number(v);
      else if (f.type === 'bool') v = !!v;
      else v = v == null ? null : String(v).trim();
      payload[f.key] = v;
    });
    const res = (form.id != null && form.id !== '')
      ? await supabase.from(table).update(payload).eq('id', form.id)
      : await supabase.from(table).insert(payload);
    setBusy(false);
    if (res.error) {
      const dup = (res.error.message || '').toLowerCase().includes('duplicate');
      setErr(dup ? 'Vrednost že obstaja (mora biti unikatna).' : res.error.message);
      return;
    }
    setEditing(null); load();
  }

  async function remove(row) {
    if (!window.confirm('Res izbrišem? Tega ni mogoče razveljaviti.')) return;
    setBusy(true);
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    setBusy(false);
    if (error) {
      setErr(error.message.toLowerCase().includes('foreign')
        ? 'Ni mogoče izbrisati — zapis je v uporabi. Raje ga nastavi na neaktivno.'
        : error.message);
      return;
    }
    load();
  }

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4">
      {err && <div className="mb-3 p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="px-3 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2" style={{ background: AS_RED }}>
          <Plus className="w-4 h-4" /> Dodaj
        </button>
      </div>
      {editing && <Editor fields={fields} initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}
      {loading ? <div className="text-sm text-as-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Nalagam…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                {fields.map((f) => <th key={f.key} className="text-left p-2">{f.label}</th>)}
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  {fields.map((f) => (
                    <td key={f.key} className="p-2">
                      {f.type === 'bool' ? (r[f.key] ? '✅' : '—') : (r[f.key] == null || r[f.key] === '' ? '—' : String(r[f.key]))}
                    </td>
                  ))}
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={fields.length + 1} className="p-4 text-center text-as-gray-400">Ni zapisov.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Editor({ fields, initial, busy, onCancel, onSave }) {
  const [f, setF] = useState({ ...initial });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const editRef = useRef(null);
  useEffect(() => { editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);
  return (
    <div ref={editRef} className="border-2 rounded-xl p-4 mb-4" style={{ borderColor: AS_RED }}>
      <div className="font-semibold mb-3">{f.id != null && f.id !== '' ? 'Uredi' : 'Nov zapis'}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((fld) => (
          <div key={fld.key}>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">{fld.label}{fld.required ? ' *' : ''}</label>
            {fld.type === 'bool' ? (
              <label className="flex items-center gap-2 text-sm h-[38px]">
                <input type="checkbox" checked={!!f[fld.key]} onChange={(e) => set(fld.key, e.target.checked)} /> {fld.label}
              </label>
            ) : (
              <input type={fld.type === 'number' ? 'number' : 'text'} value={f[fld.key] ?? ''} onChange={(e) => set(fld.key, e.target.value)} className={inputCls} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSave(f)} disabled={busy} className="px-4 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50" style={{ background: AS_RED }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Shrani
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold rounded-lg border border-as-gray-200 inline-flex items-center gap-2"><X className="w-4 h-4" /> Prekliči</button>
      </div>
    </div>
  );
}

function ProductionLogEditor() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState('nalogi'); // nalogi | zastoji | dan
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [stops, setStops] = useState([]);
  const [times, setTimes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [edit, setEdit] = useState(null); // { _kind: 'log'|'stop'|'time', ... }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const editRef = useRef(null);

  async function load() {
    setErr('');
    const [en, st, tm, mc, wk, rs] = await Promise.all([
      supabase.from('production_v2_entries').select('*').eq('date', date).order('id'),
      supabase.from('production_v2_stops').select('*').eq('date', date).order('id'),
      supabase.from('production_daily_time').select('*').eq('date', date).order('id'),
      supabase.from('production_v2_machines').select('*').order('machine_id'),
      supabase.from('production_v2_workers').select('id,name').eq('active', true).order('display_order'),
      supabase.from('production_v2_stop_reasons').select('id,reason').eq('active', true).order('display_order'),
    ]);
    setEntries(en.data || []); setStops(st.data || []); setTimes(tm.data || []);
    setMachines(mc.data || []); setWorkers(wk.data || []); setReasons(rs.data || []);
  }
  useEffect(() => { setEdit(null); load(); /* eslint-disable-next-line */ }, [date]);
  useEffect(() => { if (edit) editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [edit]);

  const h1 = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('sl-SI');
  const machineOf = (id) => machines.find((m) => m.machine_id === id) || null;
  const effOf = (kosi, ur, norm) => {
    const exp = Number(norm) * Number(ur);
    return exp > 0 ? Math.round((Number(kosi) / exp) * 100) : null;
  };

  // ===== SHRANI NALOG =====
  async function saveLog(f) {
    setErr('');
    if (!(f.operater || '').trim()) { setErr('Izberi delavca.'); return; }
    if (!f.machine_id) { setErr('Izberi stroj.'); return; }
    const m = machineOf(f.machine_id);
    if (!m) { setErr('Stroj ni najden.'); return; }
    const kosi = Number(f.kosi) || 0;
    const cas = Number(f.cas_ur) || 0;
    const rec = {
      date: f.date || date,
      operater: f.operater,
      shift: Number(f.shift) || 1,
      segment: m.segment,
      machine_id: m.machine_id,
      machine_name: m.stroj,
      operacija: m.operacija || '',
      normativ_kos_h: Number(m.normativ_h) || 0,
      tip_vijaka: (f.tip_vijaka || '').trim() || null,
      delovni_nalog: (f.delovni_nalog || '').trim() || null,
      kosi,
      cas_ur: cas,
      ucinkovitost_pct: effOf(kosi, cas, m.normativ_h),
    };
    setBusy(true);
    const res = f.id
      ? await supabase.from('production_v2_entries').update(rec).eq('id', f.id)
      : await supabase.from('production_v2_entries').insert({ ...rec, delavec_ur: null, opombe: null });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setEdit(null); load();
  }

  // ===== SHRANI ZASTOJ =====
  async function saveStop(f) {
    setErr('');
    if (!(f.operater || '').trim()) { setErr('Izberi delavca.'); return; }
    if (!(f.reason_category || '').trim()) { setErr('Izberi razlog.'); return; }
    const m = f.machine_id ? machineOf(f.machine_id) : null;
    const rec = {
      date: f.date || date,
      operater: f.operater,
      shift: Number(f.shift) || 1,
      segment: m ? m.segment : null,
      machine_id: m ? m.machine_id : null,
      machine_name: m ? m.stroj : null,
      delovni_nalog: (f.delovni_nalog || '').trim() || null,
      reason_category: f.reason_category,
      duration_hours: Number(f.duration_hours) || 0,
      description: (f.description || '').trim() || null,
    };
    setBusy(true);
    const res = f.id
      ? await supabase.from('production_v2_stops').update(rec).eq('id', f.id)
      : await supabase.from('production_v2_stops').insert({ ...rec, repair_done: null, frequency: 1, fixed_by: null });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setEdit(null); load();
  }

  // ===== SHRANI DELOVNI DAN =====
  async function saveTime(f) {
    setErr('');
    if (!(f.operater || '').trim()) { setErr('Izberi delavca.'); return; }
    if (!(Number(f.cas_ur) > 0)) { setErr('Vpiši čas (v urah, npr. 7.5).'); return; }
    if (f.vrsta === 'ostalo' && !(f.opomba || '').trim()) { setErr('Ostalo: vpiši opis.'); return; }
    const rec = {
      date: f.date || date,
      operater: f.operater,
      vrsta: f.vrsta || 'stroj',
      opomba: f.vrsta === 'ostalo' ? (f.opomba || '').trim() : null,
      cas_ur: Number(f.cas_ur) || 0,
    };
    setBusy(true);
    const res = f.id
      ? await supabase.from('production_daily_time').update(rec).eq('id', f.id)
      : await supabase.from('production_daily_time').insert(rec);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setEdit(null); load();
  }

  async function remove(table, id) {
    if (!window.confirm('Res izbrišem ta vnos?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    setEdit(null); load();
  }

  const set = (k, v) => setEdit((p) => ({ ...p, [k]: v }));
  const em = edit && edit._kind === 'log' && edit.machine_id ? machineOf(edit.machine_id) : null;

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 w-fit">
          {[['nalogi', 'Nalogi'], ['zastoji', 'Zastoji'], ['dan', 'Delovni dan']].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setEdit(null); setErr(''); }}
              className={`px-3 py-1.5 text-sm font-semibold rounded transition ${tab === k ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
              style={tab === k ? { backgroundColor: AS_RED } : {}}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-as-gray-600">Datum:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls + ' w-auto'} />
          <button onClick={() => {
            if (tab === 'nalogi') setEdit({ _kind: 'log', date, operater: '', shift: 1, machine_id: '', tip_vijaka: '', delovni_nalog: '', kosi: '', cas_ur: '' });
            else if (tab === 'zastoji') setEdit({ _kind: 'stop', date, operater: '', shift: 1, reason_category: '', machine_id: '', delovni_nalog: '', duration_hours: '', description: '' });
            else setEdit({ _kind: 'time', date, operater: '', vrsta: 'stroj', opomba: '', cas_ur: '' });
          }} className="px-3 py-2 text-white text-sm font-semibold rounded-lg" style={{ background: AS_RED }}>+ Dodaj</button>
        </div>
      </div>

      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}

      {/* ===== NALOGI ===== */}
      {tab === 'nalogi' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                <th className="text-left p-2">Delavec</th><th className="text-left p-2">Stroj</th>
                <th className="text-left p-2">Šifra</th><th className="text-left p-2">Nalog</th>
                <th className="text-right p-2">Smena</th><th className="text-right p-2">Kos</th>
                <th className="text-right p-2">Čas stroja (h)</th><th className="text-right p-2">%</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.operater || '—'}</td>
                  <td className="p-2">{r.machine_id} - {r.machine_name || '—'}</td>
                  <td className="p-2">{r.tip_vijaka || '—'}</td>
                  <td className="p-2">{r.delovni_nalog || '—'}</td>
                  <td className="p-2 text-right">{r.shift ?? '—'}</td>
                  <td className="p-2 text-right">{Number(r.kosi || 0).toLocaleString('sl-SI')}</td>
                  <td className="p-2 text-right">{h1(r.cas_ur)}</td>
                  <td className="p-2 text-right">{r.ucinkovitost_pct != null ? `${Math.round(r.ucinkovitost_pct)}%` : '—'}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'log', ...r })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('production_v2_entries', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-as-gray-400">Ni vnosov za ta dan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== ZASTOJI ===== */}
      {tab === 'zastoji' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                <th className="text-left p-2">Delavec</th><th className="text-left p-2">Razlog</th>
                <th className="text-left p-2">Stroj</th><th className="text-left p-2">Nalog</th>
                <th className="text-right p-2">Čas (h)</th><th className="text-left p-2">Opomba</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.operater || '—'}</td>
                  <td className="p-2">{r.reason_category || '—'}</td>
                  <td className="p-2">{r.machine_id ? `${r.machine_id} - ${r.machine_name || ''}` : '—'}</td>
                  <td className="p-2">{r.delovni_nalog || '—'}</td>
                  <td className="p-2 text-right">{h1(r.duration_hours)}</td>
                  <td className="p-2">{r.description || '—'}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'stop', ...r })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('production_v2_stops', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
                  </td>
                </tr>
              ))}
              {stops.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-as-gray-400">Ni zastojev za ta dan.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== DELOVNI DAN ===== */}
      {tab === 'dan' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                <th className="text-left p-2">Delavec</th><th className="text-left p-2">Vrsta</th>
                <th className="text-left p-2">Opis</th><th className="text-right p-2">Čas (h)</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {times.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.operater || '—'}</td>
                  <td className="p-2">{r.vrsta === 'ostalo' ? 'Ostalo' : r.vrsta === 'malica' ? 'Malica (staro)' : 'Delo na stroju'}</td>
                  <td className="p-2">{r.opomba || '—'}</td>
                  <td className="p-2 text-right">{h1(r.cas_ur)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'time', ...r })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('production_daily_time', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
                  </td>
                </tr>
              ))}
              {times.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-as-gray-400">Ni vnosov delovnega dneva za ta dan.</td></tr>}
            </tbody>
          </table>
          <div className="text-xs text-as-gray-400 mt-2">Malica se v analitiki obračuna avtomatsko (0:30, če je dela več kot 4 h).</div>
        </div>
      )}

      {/* ===== UREJANJE ===== */}
      {edit && (
        <div ref={editRef} className="border-2 rounded-xl p-4" style={{ borderColor: AS_RED }}>
          <div className="font-semibold mb-3">{edit.id ? 'Uredi vnos' : 'Nov vnos'} — {new Date(edit.date || date).toLocaleDateString('sl-SI')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Delavec *">
              <select value={edit.operater || ''} onChange={(e) => set('operater', e.target.value)} className={inputCls}>
                <option value="">— izberi —</option>
                {workers.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
                {edit.operater && !workers.some((w) => w.name === edit.operater) && <option value={edit.operater}>{edit.operater}</option>}
              </select>
            </Field>
            <Field label="Datum">
              <input type="date" value={edit.date || date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </Field>

            {edit._kind === 'log' && (
              <>
                <Field label="Smena">
                  <select value={edit.shift ?? 1} onChange={(e) => set('shift', e.target.value)} className={inputCls}>
                    <option value={1}>1. smena</option>
                    <option value={2}>2. smena</option>
                  </select>
                </Field>
                <Field label="Stroj *">
                  <select value={edit.machine_id || ''} onChange={(e) => set('machine_id', e.target.value)} className={inputCls}>
                    <option value="">— izberi —</option>
                    {machines.map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_id} - {m.stroj}</option>)}
                  </select>
                </Field>
                <Field label="Šifra / tip vijaka"><input value={edit.tip_vijaka || ''} onChange={(e) => set('tip_vijaka', e.target.value)} className={inputCls} /></Field>
                <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => set('delovni_nalog', e.target.value)} className={inputCls} /></Field>
                <Field label="Količina (kos)"><input type="number" value={edit.kosi ?? ''} onChange={(e) => set('kosi', e.target.value)} className={inputCls} /></Field>
                <Field label="Čas stroja (h)"><input type="number" step="0.01" value={edit.cas_ur ?? ''} onChange={(e) => set('cas_ur', e.target.value)} className={inputCls} /></Field>
                {em && (
                  <div className="sm:col-span-3 p-2 rounded-lg text-sm" style={{ background: '#f0f7f0', border: '1px solid #cde5cd' }}>
                    {em.machine_id} - {em.stroj} · {em.operacija || '—'} · normativ <strong>{Number(em.normativ_h).toLocaleString('sl-SI')} kos/h</strong> — učinkovitost se preračuna ob shranjevanju
                  </div>
                )}
              </>
            )}

            {edit._kind === 'stop' && (
              <>
                <Field label="Razlog *">
                  <select value={edit.reason_category || ''} onChange={(e) => set('reason_category', e.target.value)} className={inputCls}>
                    <option value="">— izberi —</option>
                    {reasons.map((r) => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                    {edit.reason_category && !reasons.some((x) => x.reason === edit.reason_category) && <option value={edit.reason_category}>{edit.reason_category}</option>}
                  </select>
                </Field>
                <Field label="Stroj">
                  <select value={edit.machine_id || ''} onChange={(e) => set('machine_id', e.target.value)} className={inputCls}>
                    <option value="">— brez —</option>
                    {machines.map((m) => <option key={m.machine_id} value={m.machine_id}>{m.machine_id} - {m.stroj}</option>)}
                  </select>
                </Field>
                <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => set('delovni_nalog', e.target.value)} className={inputCls} /></Field>
                <Field label="Čas (h) *"><input type="number" step="0.1" value={edit.duration_hours ?? ''} onChange={(e) => set('duration_hours', e.target.value)} className={inputCls} placeholder="npr. 0.5" /></Field>
                <Field label="Opomba"><input value={edit.description || ''} onChange={(e) => set('description', e.target.value)} className={inputCls} /></Field>
              </>
            )}

            {edit._kind === 'time' && (
              <>
                <Field label="Vrsta">
                  <select value={edit.vrsta || 'stroj'} onChange={(e) => set('vrsta', e.target.value)} className={inputCls}>
                    <option value="stroj">Delo na stroju</option>
                    <option value="ostalo">Ostalo</option>
                  </select>
                </Field>
                {edit.vrsta === 'ostalo' && (
                  <Field label="Opis *"><input value={edit.opomba || ''} onChange={(e) => set('opomba', e.target.value)} className={inputCls} placeholder="npr. čiščenje" /></Field>
                )}
                <Field label="Čas (h) *"><input type="number" step="0.1" value={edit.cas_ur ?? ''} onChange={(e) => set('cas_ur', e.target.value)} className={inputCls} placeholder="npr. 7.5" /></Field>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => (edit._kind === 'log' ? saveLog(edit) : edit._kind === 'stop' ? saveStop(edit) : saveTime(edit))} disabled={busy}
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: AS_RED }}>
              {busy ? 'Shranjujem…' : 'Shrani'}
            </button>
            <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-as-gray-200">Prekliči</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="block text-sm font-semibold text-as-gray-600 mb-1">{label}</label>{children}</div>;
}
