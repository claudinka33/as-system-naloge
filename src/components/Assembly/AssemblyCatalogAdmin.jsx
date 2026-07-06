// AssemblyCatalogAdmin.jsx — Šifrant montaže po segmentih (assembly_catalog)
// Milena ureja: avtomat / ročna (uvoženo iz Excela), vreče / titus (vnaša sproti).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Save, X, Trash2, Loader2, Search } from 'lucide-react';
import { supabase } from '../../supabase';

const AS_RED = '#C8102E';
const inputCls = "w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-as-red-600";

export const SEGMENTS = [
  { key: 'avtomat', label: 'Avtomat' },
  { key: 'rocna', label: 'Ročna' },
  { key: 'vrece', label: 'Vreče' },
  { key: 'titus', label: 'Titus' },
];

// Polja po segmentih
const SEGMENT_FIELDS = {
  avtomat: [
    { key: 'stroj', label: 'Stroj', type: 'text', required: true },
    { key: 'artikel', label: 'Artikel', type: 'text', required: true },
    { key: 'dimenzija', label: 'Dimenzija', type: 'text', required: true },
    { key: 'sifra', label: 'Šifra', type: 'text', required: true },
    { key: 'normativ_kos_h', label: 'Normativ (kos/h)', type: 'number', required: true },
    { key: 'normativ_kos_smeno', label: 'Normativ (kos/smeno)', type: 'number' },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ],
  rocna: [
    { key: 'artikel', label: 'Artikel', type: 'text', required: true },
    { key: 'dimenzija', label: 'Dimenzija', type: 'text', required: true },
    { key: 'sifra', label: 'Šifra', type: 'text', required: true },
    { key: 'normativ_stiskanje_kos_h', label: 'Stiskanje (kos/h)', type: 'number', required: true },
    { key: 'normativ_vijacenje_kos_h', label: 'Vijačenje+pak. (kos/h)', type: 'number', required: true },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ],
  vrece: [
    { key: 'artikel', label: 'Artikel', type: 'text', required: true },
    { key: 'dimenzija', label: 'Dimenzija', type: 'text', required: true },
    { key: 'sifra', label: 'Šifra', type: 'text', required: true },
    { key: 'normativ_kos_h', label: 'Normativ (vrečke/h)', type: 'number', required: true },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ],
  titus: [
    { key: 'sifra', label: 'Šifra izdelka', type: 'text', required: true },
    { key: 'artikel', label: 'Naziv (neobvezno)', type: 'text' },
    { key: 'normativ_kos_h', label: 'Normativ (škatle/h)', type: 'number', required: true, default: 24 },
    { key: 'active', label: 'Aktivna', type: 'bool', default: true },
  ],
};

export default function AssemblyCatalogAdmin() {
  const [segment, setSegment] = useState('avtomat');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const fields = SEGMENT_FIELDS[segment];

  async function load() {
    setLoading(true); setErr('');
    const { data, error } = await supabase.from('assembly_catalog')
      .select('*').eq('segment', segment)
      .order('stroj', { ascending: true }).order('artikel', { ascending: true }).order('sifra', { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { setEditing(null); setQ(''); load(); /* eslint-disable-next-line */ }, [segment]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.sifra, r.artikel, r.dimenzija, r.stroj].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  function openNew() {
    const o = { segment };
    fields.forEach((f) => { o[f.key] = f.type === 'bool' ? (f.default ?? true) : (f.default ?? ''); });
    setEditing(o);
  }

  async function save(form) {
    setErr('');
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) { setErr(`Polje "${f.label}" je obvezno.`); return; }
    }
    setBusy(true);
    const payload = { segment };
    fields.forEach((f) => {
      let v = form[f.key];
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
      else if (f.type === 'bool') v = !!v;
      else v = v == null || String(v).trim() === '' ? null : String(v).trim();
      payload[f.key] = v;
    });
    const res = (form.id != null && form.id !== '')
      ? await supabase.from('assembly_catalog').update(payload).eq('id', form.id)
      : await supabase.from('assembly_catalog').insert(payload);
    setBusy(false);
    if (res.error) {
      const dup = (res.error.message || '').toLowerCase().includes('duplicate');
      setErr(dup ? 'Ta šifra v tem segmentu že obstaja.' : res.error.message);
      return;
    }
    setEditing(null); load();
  }

  async function remove(row) {
    if (!window.confirm(`Res izbrišem šifro ${row.sifra}?`)) return;
    setBusy(true);
    const { error } = await supabase.from('assembly_catalog').delete().eq('id', row.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    load();
  }

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 w-fit">
          {SEGMENTS.map((s) => (
            <button key={s.key} onClick={() => setSegment(s.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded transition ${segment === s.key ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
              style={segment === s.key ? { backgroundColor: AS_RED } : {}}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={openNew} className="px-3 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2" style={{ background: AS_RED }}>
          <Plus className="w-4 h-4" /> Dodaj šifro
        </button>
      </div>

      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-as-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Išči po šifri, artiklu, dimenziji…"
          className="w-full pl-9 pr-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:border-as-red-600" />
      </div>

      {editing && <CatEditor fields={fields} initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />}

      {loading ? (
        <div className="text-sm text-as-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Nalagam…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-as-gray-500 border-b border-as-gray-200">
                {fields.map((f) => <th key={f.key} className="text-left p-2">{f.label}</th>)}
                <th className="text-right p-2">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-as-gray-100">
                  {fields.map((f) => (
                    <td key={f.key} className="p-2">
                      {f.type === 'bool' ? (r[f.key] ? '✅' : '—')
                        : (r[f.key] == null || r[f.key] === '' ? '—'
                          : f.type === 'number' ? Number(r[f.key]).toLocaleString('sl-SI') : String(r[f.key]))}
                    </td>
                  ))}
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 mr-1">Uredi</button>
                    <button onClick={() => remove(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={fields.length + 1} className="p-4 text-center text-as-gray-400">Ni zapisov.</td></tr>}
            </tbody>
          </table>
          <div className="text-xs text-as-gray-400 mt-2">{filtered.length} / {rows.length} šifer</div>
        </div>
      )}
    </div>
  );
}

function CatEditor({ fields, initial, busy, onCancel, onSave }) {
  const [f, setF] = useState({ ...initial });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);
  return (
    <div ref={ref} className="border-2 rounded-xl p-4" style={{ borderColor: AS_RED }}>
      <div className="font-semibold mb-3">{f.id != null && f.id !== '' ? `Uredi — ${f.sifra}` : 'Nova šifra'}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {fields.map((fld) => (
          <div key={fld.key}>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">{fld.label}{fld.required ? ' *' : ''}</label>
            {fld.type === 'bool' ? (
              <label className="flex items-center gap-2 text-sm h-[38px]">
                <input type="checkbox" checked={!!f[fld.key]} onChange={(e) => set(fld.key, e.target.checked)} /> {fld.label}
              </label>
            ) : (
              <input type={fld.type === 'number' ? 'number' : 'text'} step={fld.type === 'number' ? 'any' : undefined}
                value={f[fld.key] ?? ''} onChange={(e) => set(fld.key, e.target.value)} className={inputCls} />
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
