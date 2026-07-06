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
    { key: 'work_type', label: 'Tip', type: 'select', options: ['avtomat', 'rocna', 'oba'], default: 'rocna' },
    { key: 'segments', label: 'Segmenti', type: 'multi', options: ['avtomat', 'rocna', 'vrece', 'titus'] },
    { key: 'username', label: 'Uporabniško ime', type: 'text' },
    { key: 'password', label: 'Geslo', type: 'text' },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ] } },
  { key: 'linije', label: 'Montažne linije', config: { table: 'assembly_machines', order: 'display_order', fields: [
    { key: 'name', label: 'Naziv', type: 'text', required: true },
    { key: 'display_order', label: 'Vrstni red', type: 'number' },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ] } },
  { key: 'sifre', label: 'Šifre / normativi', config: { table: 'assembly_sifra_normativ', order: 'sifra', fields: [
    { key: 'sifra', label: 'Šifra', type: 'text', required: true },
    { key: 'naziv', label: 'Naziv', type: 'text' },
    { key: 'normativ_kos_h', label: 'Normativ (kos/h)', type: 'number' },
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
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState([]);
  const [stops, setStops] = useState([]);
  const [machines, setMachines] = useState([]);
  const [sifre, setSifre] = useState([]);
  const [workers, setWorkers] = useState([]);
  const logEditRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const start = date, end = addDays(date, 1);
      const [lg, st, mc, sf, wk] = await Promise.all([
        getAssemblyWorkLog(start, end), getAssemblyWorkStops(start, end),
        supabase.from('assembly_machines').select('id,name').order('display_order'),
        supabase.from('assembly_sifra_normativ').select('sifra,normativ_kos_h'),
        supabase.from('assembly_workers').select('id,name').eq('active', true).order('display_order'),
      ]);
      setLogs(lg); setStops(st); setMachines(mc.data || []); setSifre(sf.data || []); setWorkers(wk.data || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);
  useEffect(() => { if (edit) logEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [edit]);

  const normFor = (sifra) => {
    const h = (sifre || []).find((x) => String(x.sifra).toLowerCase() === String(sifra || '').trim().toLowerCase());
    return h ? Number(h.normativ_kos_h) || 0 : 0;
  };

  async function saveLog(form) {
    setBusy(true); setErr('');
    const base = {
      delovni_nalog: (form.delovni_nalog || '').trim() || null,
      sifra: (form.sifra || '').trim() || null,
      machine_id: form.machine_id ? Number(form.machine_id) : null,
      machine_name: machines.find((m) => String(m.id) === String(form.machine_id))?.name || null,
      kolicina: Number(form.kolicina) || 0,
      cas_dela_ur: Number(form.cas_dela_ur) || 0,
      cas_stroja_ur: Number(form.cas_stroja_ur) || 0,
      normativ_kos_h: normFor(form.sifra),
    };
    try {
      if (form.id) {
        await updateAssemblyWorkLog(form.id, base);
      } else {
        if (!form.worker_id) { setErr('Izberi delavko.'); setBusy(false); return; }
        const w = workers.find((x) => String(x.id) === String(form.worker_id));
        const { error } = await supabase.from('assembly_work_log').insert({
          date: form.date || date, worker_id: Number(form.worker_id), worker_name: w?.name || null, ...base,
        });
        if (error) throw error;
      }
      setEdit(null); load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function delLog(r) { if (!window.confirm('Izbrišem ta nalog?')) return; setBusy(true); try { await deleteAssemblyWorkLog(r.id); load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }
  async function delStop(r) { if (!window.confirm('Izbrišem ta zastoj?')) return; setBusy(true); try { await deleteAssemblyWorkStop(r.id); load(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 space-y-4">
      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-as-gray-600">Datum:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm" />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-as-gray-400" />}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-as-gray-700">Delovni nalogi</h4>
          <button onClick={() => setEdit({ date, worker_id: '', delovni_nalog: '', sifra: '', machine_id: '', kolicina: '', cas_dela_ur: '', cas_stroja_ur: '' })}
            className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1" style={{ background: AS_RED }}>
            <Plus className="w-3 h-3" /> Dodaj nalog
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-as-gray-500 border-b border-as-gray-200">
              <th className="text-left p-2">Delavka</th><th className="text-left p-2">Nalog</th><th className="text-left p-2">Šifra</th>
              <th className="text-left p-2">Stroj</th><th className="text-right p-2">Kos</th><th className="text-right p-2">Delo (h)</th><th className="text-right p-2">Stroj (h)</th><th className="text-right p-2">Akcije</th>
            </tr></thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.worker_name || '—'}</td><td className="p-2">{r.delovni_nalog || '—'}</td><td className="p-2">{r.sifra || '—'}</td>
                  <td className="p-2">{r.machine_name || '—'}</td><td className="p-2 text-right">{formatNumber(r.kolicina)}</td>
                  <td className="p-2 text-right">{h1(r.cas_dela_ur)}</td><td className="p-2 text-right">{h1(r.cas_stroja_ur)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => delLog(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-as-gray-400">Ni nalogov za ta dan.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div ref={logEditRef} className="border-2 rounded-xl p-4" style={{ borderColor: AS_RED }}>
          <div className="font-semibold mb-3">{edit.id ? `Uredi nalog — ${edit.worker_name}` : 'Dodaj nalog'}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!edit.id && (
              <Field label="Delavka">
                <select value={edit.worker_id || ''} onChange={(e) => setEdit({ ...edit, worker_id: e.target.value })} className={inputCls}>
                  <option value="">— izberi —</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => setEdit({ ...edit, delovni_nalog: e.target.value })} className={inputCls} /></Field>
            <Field label="Šifra"><input value={edit.sifra || ''} onChange={(e) => setEdit({ ...edit, sifra: e.target.value })} className={inputCls} /></Field>
            <Field label="Stroj / linija">
              <select value={edit.machine_id || ''} onChange={(e) => setEdit({ ...edit, machine_id: e.target.value })} className={inputCls}>
                <option value="">—</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Količina"><input type="number" value={edit.kolicina ?? ''} onChange={(e) => setEdit({ ...edit, kolicina: e.target.value })} className={inputCls} /></Field>
            <Field label="Čas dela (h)"><input type="number" step="0.1" value={edit.cas_dela_ur ?? ''} onChange={(e) => setEdit({ ...edit, cas_dela_ur: e.target.value })} className={inputCls} /></Field>
            <Field label="Čas stroja (h)"><input type="number" step="0.1" value={edit.cas_stroja_ur ?? ''} onChange={(e) => setEdit({ ...edit, cas_stroja_ur: e.target.value })} className={inputCls} /></Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => saveLog(edit)} disabled={busy} className="px-4 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50" style={{ background: AS_RED }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Shrani
            </button>
            <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-as-gray-200 inline-flex items-center gap-2"><X className="w-4 h-4" /> Prekliči</button>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold text-as-gray-700 mb-2">Zastoji</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-as-gray-500 border-b border-as-gray-200">
              <th className="text-left p-2">Delavka</th><th className="text-left p-2">Razlog</th><th className="text-left p-2">Nalog</th><th className="text-right p-2">Trajanje (h)</th><th className="text-left p-2">Opomba</th><th className="text-right p-2">Akcije</th>
            </tr></thead>
            <tbody>
              {stops.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.worker_name || '—'}</td><td className="p-2">{r.reason || '—'}</td><td className="p-2">{r.delovni_nalog || 'splošno'}</td><td className="p-2 text-right">{h1(r.cas_ur)}</td><td className="p-2">{r.opomba || '—'}</td>
                  <td className="p-2 text-right"><button onClick={() => delStop(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}
              {stops.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-as-gray-400">Ni zastojev za ta dan.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="block text-sm font-semibold text-as-gray-600 mb-1">{label}</label>{children}</div>;
}
