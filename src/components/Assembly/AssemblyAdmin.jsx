// AssemblyAdmin.jsx — Urejanje montaže (Milena + admini): delavke, linije, šifre/normativi,
// razlogi zastoja + popravljanje/brisanje vnosov delavk.
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, X, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';
import AssemblyCatalogAdmin from './AssemblyCatalogAdmin.jsx';
import {
  getAssemblyWorkLog, getAssemblyWorkStops,
  deleteAssemblyWorkLog, deleteAssemblyWorkStop, updateAssemblyWorkLog, formatNumber,
} from '../../lib/assemblyApi.js';

const AS_RED = '#C8102E';
const inputCls = "w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-as-red-600";
const num = (v) => Number(v) || 0;
const h1 = (n) => (Math.round(num(n) * 10) / 10).toLocaleString('sl-SI');
function addDays(s, n) { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

const SECTIONS = [
  { key: 'delavke', label: 'Delavke', config: { table: 'assembly_workers', order: 'display_order', fields: [
    { key: 'name', label: 'Ime', type: 'text', required: true },
    { key: 'segments', label: 'Segmenti', type: 'multi', options: ['avtomat', 'rocna', 'vrece', 'titus'] },
    { key: 'username', label: 'Uporabniško ime', type: 'text' },
    { key: 'password', label: 'Geslo', type: 'text' },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ] } },
  { key: 'razlogi', label: 'Razlogi zastoja', config: { table: 'assembly_stop_reasons', order: 'display_order', fields: [
    { key: 'reason', label: 'Razlog', type: 'text', required: true },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktiven', type: 'bool', default: true },
  ] } },
  { key: 'sifrant', label: 'Šifrant segmentov' },
  { key: 'vnosi', label: 'Popravi vnose' },
];

export default function AssemblyAdmin({ onlySection = null }) {
  const visible = SECTIONS.filter((s) => s.key !== 'linije');
  const [section, setSection] = useState('delavke');
  if (onlySection) {
    const sec = SECTIONS.find((s) => s.key === onlySection);
    return <div className="space-y-4">{sec && sec.config ? <CrudList config={sec.config} /> : null}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 w-fit">
        {visible.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`px-3 py-1.5 text-sm font-semibold rounded transition ${section === s.key ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
            style={section === s.key ? { backgroundColor: AS_RED } : {}}>
            {s.label}
          </button>
        ))}
      </div>
      {section === 'vnosi'
        ? <WorkLogEditor />
        : section === 'sifrant'
        ? <AssemblyCatalogAdmin />
        : <CrudList config={visible.find((s) => s.key === section).config} />}
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
    fields.forEach((f) => {
      o[f.key] = f.type === 'bool' ? (f.default ?? true)
        : f.type === 'multi' ? (f.default ?? [])
        : f.type === 'select' ? (f.default ?? '')
        : f.type === 'number' ? '' : '';
    });
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
      else if (f.type === 'multi') v = Array.isArray(v) ? v : [];
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
        ? 'Ni mogoče izbrisati — zapis je v uporabi (zgodovina). Raje ga nastavi na neaktivno.'
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
                      {f.type === 'bool' ? (r[f.key] ? '✅' : '—')
                        : f.type === 'multi' ? ((r[f.key] || []).length ? (r[f.key] || []).join(', ') : '—')
                        : (r[f.key] == null || r[f.key] === '' ? '—' : String(r[f.key]))}
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
            ) : fld.type === 'multi' ? (
              <div className="flex flex-wrap gap-3 py-2">
                {fld.options.map((o) => {
                  const arr = Array.isArray(f[fld.key]) ? f[fld.key] : [];
                  const on = arr.includes(o);
                  return (
                    <label key={o} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={on}
                        onChange={() => set(fld.key, on ? arr.filter((x) => x !== o) : [...arr, o])} /> {o}
                    </label>
                  );
                })}
              </div>
            ) : fld.type === 'select' ? (
              <select value={f[fld.key] ?? ''} onChange={(e) => set(fld.key, e.target.value)} className={inputCls}>
                <option value="">—</option>
                {fld.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
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

function WorkLogEditor() {
  const today = new Date().toISOString().slice(0, 10);
  const SEGS = [
    { key: 'avtomat', label: 'Avtomat' }, { key: 'rocna', label: 'Ročna' },
    { key: 'vrece', label: 'Vrečke' }, { key: 'titus', label: 'Titus' }, { key: 'ostalo', label: 'Ostalo' },
  ];
  const VRECE_STROJI = ['Vrečke 1', 'Vrečke 2'];
  const SEG_LBL = { avtomat: 'Avtomat', rocna: 'Ročna', vrece: 'Vrečke', titus: 'Titus', ostalo: 'Ostalo' };

  const [tab, setTab] = useState('nalogi'); // nalogi | zastoji | dan
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState([]);
  const [stops, setStops] = useState([]);
  const [times, setTimes] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [edit, setEdit] = useState(null); // { _kind: 'log'|'stop'|'time', ...vrstica }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const logEditRef = useRef(null);

  async function load() {
    setErr('');
    const [lg, st, tm, ct, rs, wk] = await Promise.all([
      supabase.from('assembly_work_log').select('*').eq('date', date).order('id'),
      supabase.from('assembly_work_stops').select('*').eq('date', date).order('id'),
      supabase.from('assembly_daily_time').select('*').eq('date', date).order('id'),
      supabase.from('assembly_catalog').select('segment,stroj,artikel,dimenzija,sifra,normativ_kos_h,normativ_stiskanje_kos_h,normativ_vijacenje_kos_h').eq('active', true),
      supabase.from('assembly_stop_reasons').select('id,reason').eq('active', true).order('display_order'),
      supabase.from('assembly_workers').select('id,name').eq('active', true).order('display_order'),
    ]);
    setLogs(lg.data || []); setStops(st.data || []); setTimes(tm.data || []);
    setCatalog(ct.data || []); setReasons(rs.data || []); setWorkers(wk.data || []);
  }
  useEffect(() => { setEdit(null); load(); /* eslint-disable-next-line */ }, [date]);
  useEffect(() => { if (edit) logEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [edit]);

  const h1 = (n) => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('sl-SI');
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const segCat = (seg) => catalog.filter((c) => c.segment === seg);
  const strojOpts = uniq(segCat('avtomat').map((c) => c.stroj)).sort();
  const artOpts = (f) => {
    let rows = segCat(f.segment);
    if (f.segment === 'avtomat') rows = rows.filter((c) => c.stroj === f.machine_name);
    return uniq(rows.map((c) => c.artikel)).sort();
  };
  const dimOpts = (f) => {
    let rows = segCat(f.segment).filter((c) => c.artikel === f.artikel);
    if (f.segment === 'avtomat') rows = rows.filter((c) => c.stroj === f.machine_name);
    return uniq(rows.map((c) => c.dimenzija)).sort((a, b) => {
      const pa = String(a).split('x').map(Number), pb = String(b).split('x').map(Number);
      return (pa[0] - pb[0]) || ((pa[1] || 0) - (pb[1] || 0));
    });
  };
  const catRow = (f) => {
    if (f.segment === 'titus') return segCat('titus').find((c) => c.sifra === f.sifra) || null;
    return segCat(f.segment).find((c) =>
      c.artikel === f.artikel && c.dimenzija === f.dimenzija &&
      (f.segment !== 'avtomat' || c.stroj === f.machine_name)) || null;
  };
  const workerName = (id) => workers.find((w) => String(w.id) === String(id))?.name || null;

  // ===== SHRANI NALOG =====
  async function saveLog(f) {
    setErr('');
    if (!f.worker_id) { setErr('Izberi delavko.'); return; }
    if (!f.segment) { setErr('Izberi segment.'); return; }
    let rec = {
      date: f.date || date,
      worker_id: Number(f.worker_id),
      worker_name: workerName(f.worker_id),
      segment: f.segment,
      faza: f.segment === 'rocna' ? (f.faza || 'vijacenje') : null,
      delovni_nalog: (f.delovni_nalog || '').trim() || null,
      kolicina: Number(f.kolicina) || 0,
      cas_dela_ur: Number(f.cas_dela_ur) || 0,
      cas_stroja_ur: Number(f.cas_stroja_ur) || 0,
      machine_id: null,
    };
    if (f.segment === 'ostalo') {
      if (!(f.opis || '').trim()) { setErr('Ostalo: vpiši opis.'); return; }
      rec = { ...rec, sifra: 'OSTALO', artikel: (f.opis || '').trim(), dimenzija: null, machine_name: null, normativ_kos_h: 0 };
    } else {
      const c = catRow(f);
      if (!c) { setErr('Izberi artikel/dimenzijo oz. šifro (iz šifranta).'); return; }
      const norm = f.segment === 'rocna'
        ? (rec.faza === 'stiskanje' ? Number(c.normativ_stiskanje_kos_h) || 0 : Number(c.normativ_vijacenje_kos_h) || 0)
        : Number(c.normativ_kos_h) || 0;
      rec = {
        ...rec,
        sifra: c.sifra, artikel: c.artikel || null, dimenzija: c.dimenzija || null,
        machine_name: f.segment === 'avtomat' ? (f.machine_name || null) : f.segment === 'vrece' ? (f.machine_name || null) : null,
        normativ_kos_h: norm,
      };
    }
    setBusy(true);
    const res = f.id
      ? await supabase.from('assembly_work_log').update(rec).eq('id', f.id)
      : await supabase.from('assembly_work_log').insert(rec);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setEdit(null); load();
  }

  // ===== SHRANI ZASTOJ =====
  async function saveStop(f) {
    setErr('');
    if (!f.worker_id) { setErr('Izberi delavko.'); return; }
    if (!(f.reason || '').trim()) { setErr('Vpiši razlog.'); return; }
    const rec = {
      date: f.date || date,
      worker_id: Number(f.worker_id),
      worker_name: workerName(f.worker_id),
      reason: (f.reason || '').trim(),
      machine_name: f.machine_name || null,
      delovni_nalog: (f.delovni_nalog || '').trim() || null,
      cas_ur: Number(f.cas_ur) || 0,
      opomba: (f.opomba || '').trim() || null,
    };
    setBusy(true);
    const res = f.id
      ? await supabase.from('assembly_work_stops').update(rec).eq('id', f.id)
      : await supabase.from('assembly_work_stops').insert({ ...rec, log_id: null });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    setEdit(null); load();
  }

  // ===== SHRANI DELOVNI DAN =====
  async function saveTime(f) {
    setErr('');
    if (!f.worker_id) { setErr('Izberi delavko.'); return; }
    if (!(Number(f.cas_ur) > 0)) { setErr('Vpiši čas (v urah, npr. 7.5).'); return; }
    if (f.vrsta === 'ostalo' && !(f.opomba || '').trim()) { setErr('Ostalo: vpiši opis.'); return; }
    const rec = {
      date: f.date || date,
      worker_id: Number(f.worker_id),
      worker_name: workerName(f.worker_id),
      vrsta: f.vrsta || 'stroj',
      opomba: f.vrsta === 'ostalo' ? (f.opomba || '').trim() : null,
      cas_ur: Number(f.cas_ur) || 0,
    };
    setBusy(true);
    const res = f.id
      ? await supabase.from('assembly_daily_time').update(rec).eq('id', f.id)
      : await supabase.from('assembly_daily_time').insert(rec);
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
  const c = edit && edit._kind === 'log' && edit.segment && edit.segment !== 'ostalo' ? catRow(edit) : null;

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 w-fit">
          {[['nalogi', 'Nalogi'], ['zastoji', 'Zastoji'], ['dan', 'Delovni dan']].map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setEdit(null); setErr(''); }}
              className={`px-3 py-1.5 text-sm font-semibold rounded transition ${tab === k ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
              style={tab === k ? { backgroundColor: '#C8102E' } : {}}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-as-gray-600">Datum:</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls + ' w-auto'} />
          <button onClick={() => {
            if (tab === 'nalogi') setEdit({ _kind: 'log', date, worker_id: '', segment: 'avtomat', faza: 'vijacenje', machine_name: '', artikel: '', dimenzija: '', sifra: '', opis: '', delovni_nalog: '', kolicina: '', cas_dela_ur: '', cas_stroja_ur: '' });
            else if (tab === 'zastoji') setEdit({ _kind: 'stop', date, worker_id: '', reason: '', machine_name: '', delovni_nalog: '', cas_ur: '', opomba: '' });
            else setEdit({ _kind: 'time', date, worker_id: '', vrsta: 'stroj', opomba: '', cas_ur: '' });
          }} className="px-3 py-2 text-white text-sm font-semibold rounded-lg" style={{ background: '#C8102E' }}>+ Dodaj</button>
        </div>
      </div>

      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}

      {/* ===== NALOGI ===== */}
      {tab === 'nalogi' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                <th className="text-left p-2">Delavka</th><th className="text-left p-2">Segment</th>
                <th className="text-left p-2">Stroj</th><th className="text-left p-2">Šifra / opis</th>
                <th className="text-left p-2">Artikel</th><th className="text-left p-2">Nalog</th>
                <th className="text-right p-2">Kos</th><th className="text-right p-2">Čas dela</th>
                <th className="text-right p-2">Čas stroja</th><th className="text-right p-2">Norm.</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.worker_name || '—'}</td>
                  <td className="p-2">{(SEG_LBL[r.segment] || r.segment || '—')}{r.faza ? ` · ${r.faza === 'vijacenje' ? 'vijačenje' : r.faza}` : ''}</td>
                  <td className="p-2">{r.machine_name || '—'}</td>
                  <td className="p-2">{r.segment === 'ostalo' ? (r.artikel || '—') : (r.sifra || '—')}</td>
                  <td className="p-2">{r.segment === 'ostalo' ? '—' : [r.artikel, r.dimenzija].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="p-2">{r.delovni_nalog || '—'}</td>
                  <td className="p-2 text-right">{Number(r.kolicina || 0).toLocaleString('sl-SI')}</td>
                  <td className="p-2 text-right">{h1(r.cas_dela_ur)}</td>
                  <td className="p-2 text-right">{h1(r.cas_stroja_ur)}</td>
                  <td className="p-2 text-right">{Number(r.normativ_kos_h) > 0 ? Number(r.normativ_kos_h).toLocaleString('sl-SI') : '—'}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'log', ...r, opis: r.segment === 'ostalo' ? (r.artikel || '') : '' })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('assembly_work_log', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={11} className="p-4 text-center text-as-gray-400">Ni vnosov za ta dan.</td></tr>}
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
                <th className="text-left p-2">Delavka</th><th className="text-left p-2">Razlog</th>
                <th className="text-left p-2">Stroj</th><th className="text-left p-2">Nalog</th>
                <th className="text-right p-2">Čas (h)</th><th className="text-left p-2">Opomba</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.worker_name || '—'}</td>
                  <td className="p-2">{r.reason || '—'}</td>
                  <td className="p-2">{r.machine_name || '—'}</td>
                  <td className="p-2">{r.delovni_nalog || '—'}</td>
                  <td className="p-2 text-right">{h1(r.cas_ur)}</td>
                  <td className="p-2">{r.opomba || '—'}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'stop', ...r })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('assembly_work_stops', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
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
                <th className="text-left p-2">Delavka</th><th className="text-left p-2">Vrsta</th>
                <th className="text-left p-2">Opis</th><th className="text-right p-2">Čas (h)</th>
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {times.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.worker_name || '—'}</td>
                  <td className="p-2">{r.vrsta === 'ostalo' ? 'Ostalo' : r.vrsta === 'malica' ? 'Malica (staro)' : 'Delo na stroju'}</td>
                  <td className="p-2">{r.opomba || '—'}</td>
                  <td className="p-2 text-right">{h1(r.cas_ur)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ _kind: 'time', ...r })} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove('assembly_daily_time', r.id)} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">Izbriši</button>
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
        <div ref={logEditRef} className="border-2 rounded-xl p-4" style={{ borderColor: '#C8102E' }}>
          <div className="font-semibold mb-3">{edit.id ? 'Uredi vnos' : 'Nov vnos'} — {new Date(edit.date || date).toLocaleDateString('sl-SI')}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Delavka *">
              <select value={edit.worker_id || ''} onChange={(e) => set('worker_id', e.target.value)} className={inputCls}>
                <option value="">— izberi —</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Datum">
              <input type="date" value={edit.date || date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </Field>

            {edit._kind === 'log' && (
              <>
                <Field label="Segment *">
                  <select value={edit.segment || ''} onChange={(e) => set('segment', e.target.value)} className={inputCls}>
                    {SEGS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
                {edit.segment === 'rocna' && (
                  <Field label="Faza">
                    <select value={edit.faza || 'vijacenje'} onChange={(e) => set('faza', e.target.value)} className={inputCls}>
                      <option value="stiskanje">Stiskanje</option>
                      <option value="vijacenje">Vijačenje + pakiranje</option>
                    </select>
                  </Field>
                )}
                {(edit.segment === 'avtomat' || edit.segment === 'vrece') && (
                  <Field label="Stroj">
                    <select value={edit.machine_name || ''} onChange={(e) => set('machine_name', e.target.value)} className={inputCls}>
                      <option value="">— izberi —</option>
                      {(edit.segment === 'avtomat' ? strojOpts : VRECE_STROJI).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                )}
                {edit.segment === 'ostalo' ? (
                  <Field label="Opis dela *">
                    <input value={edit.opis || ''} onChange={(e) => set('opis', e.target.value)} className={inputCls} placeholder="npr. čiščenje" />
                  </Field>
                ) : edit.segment === 'titus' ? (
                  <Field label="Šifra *">
                    <select value={edit.sifra || ''} onChange={(e) => set('sifra', e.target.value)} className={inputCls}>
                      <option value="">— izberi —</option>
                      {segCat('titus').map((x) => <option key={x.sifra} value={x.sifra}>{x.sifra}{x.artikel ? ` — ${x.artikel}` : ''}</option>)}
                    </select>
                  </Field>
                ) : (
                  <>
                    <Field label="Artikel *">
                      <select value={edit.artikel || ''} onChange={(e) => { set('artikel', e.target.value); set('dimenzija', ''); }} className={inputCls}>
                        <option value="">— izberi —</option>
                        {artOpts(edit).map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                    <Field label="Dimenzija *">
                      <select value={edit.dimenzija || ''} onChange={(e) => set('dimenzija', e.target.value)} className={inputCls}>
                        <option value="">— izberi —</option>
                        {dimOpts(edit).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                  </>
                )}
                <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => set('delovni_nalog', e.target.value)} className={inputCls} /></Field>
                <Field label="Količina (kos)"><input type="number" value={edit.kolicina ?? ''} onChange={(e) => set('kolicina', e.target.value)} className={inputCls} /></Field>
                <Field label="Čas dela (h)"><input type="number" step="0.1" value={edit.cas_dela_ur ?? ''} onChange={(e) => set('cas_dela_ur', e.target.value)} className={inputCls} /></Field>
                <Field label="Čas stroja (h)"><input type="number" step="0.1" value={edit.cas_stroja_ur ?? ''} onChange={(e) => set('cas_stroja_ur', e.target.value)} className={inputCls} /></Field>
                {c && (
                  <div className="sm:col-span-3 p-2 rounded-lg text-sm" style={{ background: '#f0f7f0', border: '1px solid #cde5cd' }}>
                    Šifra: <strong>{c.sifra}</strong>
                    {edit.segment === 'rocna'
                      ? <> · normativ ({edit.faza === 'stiskanje' ? 'stiskanje' : 'vijačenje'}): <strong>{Number(edit.faza === 'stiskanje' ? c.normativ_stiskanje_kos_h : c.normativ_vijacenje_kos_h).toLocaleString('sl-SI')} kos/h</strong></>
                      : <> · normativ: <strong>{Number(c.normativ_kos_h).toLocaleString('sl-SI')} kos/h</strong>{edit.segment === 'avtomat' ? ' (na čas stroja)' : ''}</>}
                  </div>
                )}
              </>
            )}

            {edit._kind === 'stop' && (
              <>
                <Field label="Razlog *">
                  <select value={reasons.some((x) => x.reason === edit.reason) ? edit.reason : (edit.reason ? '__custom__' : '')} onChange={(e) => set('reason', e.target.value === '__custom__' ? (edit.reason || '') : e.target.value)} className={inputCls}>
                    <option value="">— izberi —</option>
                    {reasons.map((r) => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                    {edit.reason && !reasons.some((x) => x.reason === edit.reason) && <option value="__custom__">{edit.reason}</option>}
                  </select>
                </Field>
                <Field label="Stroj">
                  <select value={edit.machine_name || ''} onChange={(e) => set('machine_name', e.target.value)} className={inputCls}>
                    <option value="">— brez —</option>
                    {[...strojOpts, ...VRECE_STROJI].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => set('delovni_nalog', e.target.value)} className={inputCls} /></Field>
                <Field label="Čas (h) *"><input type="number" step="0.1" value={edit.cas_ur ?? ''} onChange={(e) => set('cas_ur', e.target.value)} className={inputCls} placeholder="npr. 0.5" /></Field>
                <Field label="Opomba"><input value={edit.opomba || ''} onChange={(e) => set('opomba', e.target.value)} className={inputCls} /></Field>
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
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50" style={{ background: '#C8102E' }}>
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
