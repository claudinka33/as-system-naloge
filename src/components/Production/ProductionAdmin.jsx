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
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr('');
    const start = date, end = addDays(date, 1);
    try {
      const [en, st] = await Promise.all([
        supabase.from('production_v2_entries').select('*').gte('date', start).lt('date', end).order('id', { ascending: true }),
        supabase.from('production_v2_stops').select('*').gte('date', start).lt('date', end).order('id', { ascending: true }),
      ]);
      if (en.error) throw en.error; if (st.error) throw st.error;
      setEntries(en.data || []); setStops(st.data || []);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  async function saveEntry(form) {
    setBusy(true); setErr('');
    const kosi = Number(form.kosi) || 0;
    const cas = Number(form.cas_ur) || 0;
    const patch = {
      delovni_nalog: (form.delovni_nalog || '').toString().trim() || null,
      tip_vijaka: (form.tip_vijaka || '').toString().trim() || null,
      kosi,
      cas_ur: cas,
      delavec_ur: form.delavec_ur === '' || form.delavec_ur == null ? null : Number(form.delavec_ur),
      ucinkovitost_pct: calculateEfficiency(kosi, cas, Number(form.normativ_kos_h) || 0),
    };
    const { error } = await supabase.from('production_v2_entries').update(patch).eq('id', form.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEdit(null); load();
  }
  async function delEntry(r) { if (!window.confirm('Izbrišem ta nalog?')) return; setBusy(true); const { error } = await supabase.from('production_v2_entries').delete().eq('id', r.id); setBusy(false); if (error) setErr(error.message); else load(); }
  async function delStop(r) { if (!window.confirm('Izbrišem ta zastoj?')) return; setBusy(true); const { error } = await supabase.from('production_v2_stops').delete().eq('id', r.id); setBusy(false); if (error) setErr(error.message); else load(); }

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 space-y-4">
      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-as-gray-600">Datum:</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm" />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-as-gray-400" />}
      </div>

      <div>
        <h4 className="font-bold text-as-gray-700 mb-2">Delovni nalogi</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-as-gray-500 border-b border-as-gray-200">
              <th className="text-left p-2">Operater</th><th className="text-left p-2">Nalog</th><th className="text-left p-2">Šifra</th><th className="text-left p-2">Stroj</th>
              <th className="text-right p-2">Kos</th><th className="text-right p-2">Stroj (h)</th><th className="text-right p-2">Delavec (h)</th><th className="text-right p-2">Učink. %</th><th className="text-right p-2">Akcije</th>
            </tr></thead>
            <tbody>
              {entries.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.operater || '—'}</td><td className="p-2">{r.delovni_nalog || '—'}</td><td className="p-2">{r.tip_vijaka || '—'}</td><td className="p-2">{r.machine_name || '—'}</td>
                  <td className="p-2 text-right">{fmt(r.kosi)}</td><td className="p-2 text-right">{h1(r.cas_ur)}</td><td className="p-2 text-right">{r.delavec_ur == null ? '—' : h1(r.delavec_ur)}</td><td className="p-2 text-right">{r.ucinkovitost_pct == null ? '—' : Math.round(r.ucinkovitost_pct)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => delEntry(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-as-gray-400">Ni nalogov za ta dan.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="border-2 rounded-xl p-4" style={{ borderColor: AS_RED }}>
          <div className="font-semibold mb-3">Uredi nalog — {edit.operater} · {edit.machine_name}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Št. naloga"><input value={edit.delovni_nalog || ''} onChange={(e) => setEdit({ ...edit, delovni_nalog: e.target.value })} className={inputCls} /></Field>
            <Field label="Šifra"><input value={edit.tip_vijaka || ''} onChange={(e) => setEdit({ ...edit, tip_vijaka: e.target.value })} className={inputCls} /></Field>
            <Field label="Količina (kos)"><input type="number" value={edit.kosi ?? ''} onChange={(e) => setEdit({ ...edit, kosi: e.target.value })} className={inputCls} /></Field>
            <Field label="Čas stroja (h)"><input type="number" step="0.01" value={edit.cas_ur ?? ''} onChange={(e) => setEdit({ ...edit, cas_ur: e.target.value })} className={inputCls} /></Field>
            <Field label="Čas delavca (h)"><input type="number" step="0.01" value={edit.delavec_ur ?? ''} onChange={(e) => setEdit({ ...edit, delavec_ur: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end text-xs text-as-gray-400">Normativ: {fmt(edit.normativ_kos_h)} kos/h</div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => saveEntry(edit)} disabled={busy} className="px-4 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50" style={{ background: AS_RED }}>
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
              <th className="text-left p-2">Operater</th><th className="text-left p-2">Razlog</th><th className="text-left p-2">Nalog</th><th className="text-right p-2">Trajanje (h)</th><th className="text-left p-2">Opomba</th><th className="text-right p-2">Akcije</th>
            </tr></thead>
            <tbody>
              {stops.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  <td className="p-2">{r.operater || '—'}</td><td className="p-2">{r.reason_category || '—'}</td><td className="p-2">{r.delovni_nalog || 'splošno'}</td><td className="p-2 text-right">{h1(r.duration_hours)}</td><td className="p-2">{r.description || '—'}</td>
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
