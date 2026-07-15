// DepartmentsAdmin.jsx — graditelj delovnih mest po meri (uporabljen kot zavihek v UserAdmin).
// Admin sestavi: ime, ikono, barvo, kategorije (+ podkategorije) in polja vnosa po meri.
import { useState } from 'react';
import {
  saveDepartment, deleteDepartment, useDepartments,
  EMPTY_CATEGORY, EMPTY_FIELD, FIELD_TYPES, slugify,
} from './lib/departmentsApi.js';
import { getIcon, ICON_LIST } from './lib/iconRegistry.jsx';
import { Plus, Trash2, Edit2, X, Check, Loader2, Layers, ChevronDown, ChevronUp } from 'lucide-react';

const PALETTE = [
  { color: '#C8102E', bg: '#FEE2E2' }, { color: '#854D0E', bg: '#FEF3C7' },
  { color: '#1E40AF', bg: '#DBEAFE' }, { color: '#065F46', bg: '#A7F3D0' },
  { color: '#5B21B6', bg: '#DDD6FE' }, { color: '#0F766E', bg: '#CCFBF1' },
  { color: '#9F1239', bg: '#FFE4E6' }, { color: '#374151', bg: '#E5E7EB' },
];

const EMPTY_DEP = () => ({
  id: null, key: '', name: '', icon: 'Building2',
  accentColor: '#374151', accentBg: '#E5E7EB', descr: '',
  categories: [], fields: [], allowedEmails: [], sortOrder: 0, active: true,
});

// Majhen izbirnik ikon
function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const Cur = getIcon(value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50" title="Izberi ikono">
        <Cur className="w-5 h-5 text-gray-700" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[75]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-[76] bg-white border border-gray-200 rounded-xl shadow-2xl p-2 grid grid-cols-6 gap-1 w-64 max-h-56 overflow-y-auto">
            {ICON_LIST.map(([name, Ic]) => (
              <button key={name} type="button" title={name}
                onClick={() => { onChange(name); setOpen(false); }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 ${value === name ? 'bg-red-50 ring-1 ring-red-300' : ''}`}>
                <Ic className="w-5 h-5 text-gray-700" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ColorPicker({ color, bg, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((p) => (
        <button key={p.color} type="button" onClick={() => onChange(p.color, p.bg)}
          className={`w-7 h-7 rounded-full border-2 ${color === p.color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
          style={{ backgroundColor: p.bg, borderColor: p.color }} title={p.color} />
      ))}
    </div>
  );
}

// Vnos seznama (podkategorije / opcije polja)
function MiniTags({ items, setItems, placeholder }) {
  const [val, setVal] = useState('');
  const add = () => { const v = val.trim(); if (!v || items.includes(v)) { setVal(''); return; } setItems([...items, v]); setVal(''); };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700">
            {it}
            <button type="button" onClick={() => setItems(items.filter((x) => x !== it))} className="text-gray-400 hover:text-red-600"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder} className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-red-500" />
        <button type="button" onClick={add} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-semibold text-gray-700">+ Dodaj</button>
      </div>
    </div>
  );
}

export default function DepartmentsAdmin({ currentUser, onChanged }) {
  const { departments, loading, reload } = useDepartments();
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState(EMPTY_DEP());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openCat, setOpenCat] = useState({});

  const openNew = () => { setForm(EMPTY_DEP()); setError(''); setOpenCat({}); setShowEditor(true); };
  const openEdit = (d) => { setForm({ ...d, categories: d.categories.map((c) => ({ ...c })), fields: d.fields.map((f) => ({ ...f })) }); setError(''); setOpenCat({}); setShowEditor(true); };

  const patch = (o) => setForm((f) => ({ ...f, ...o }));

  // Kategorije
  const addCategory = () => patch({ categories: [...form.categories, EMPTY_CATEGORY()] });
  const updateCategory = (i, o) => patch({ categories: form.categories.map((c, idx) => (idx === i ? { ...c, ...o } : c)) });
  const removeCategory = (i) => patch({ categories: form.categories.filter((_, idx) => idx !== i) });

  // Polja
  const addField = () => patch({ fields: [...form.fields, EMPTY_FIELD()] });
  const updateField = (i, o) => patch({ fields: form.fields.map((f, idx) => (idx === i ? { ...f, ...o } : f)) });
  const removeField = (i) => patch({ fields: form.fields.filter((_, idx) => idx !== i) });

  const save = async () => {
    setError('');
    if (!form.name.trim()) { setError('Ime delovnega mesta je obvezno.'); return; }
    if (form.categories.length === 0) { setError('Dodaj vsaj eno kategorijo.'); return; }
    if (form.categories.some((c) => !c.name.trim())) { setError('Vsaka kategorija mora imeti ime.'); return; }
    const key = form.key && form.key.trim() ? form.key.trim() : slugify(form.name);
    setSaving(true);
    const payload = { ...form, key, name: form.name.trim() };
    const { error: err } = await saveDepartment(payload);
    setSaving(false);
    if (err) { setError('Napaka pri shranjevanju: ' + err.message); return; }
    setShowEditor(false);
    await reload();
    if (onChanged) onChanged();
  };

  const remove = async (d) => {
    if (!confirm(`Res izbrišeš delovno mesto "${d.name}"?\n\nVnosi v bazi (md_entries) ostanejo, a delovno mesto izgine iz aplikacije.`)) return;
    await deleteDepartment(d.id);
    await reload();
    if (onChanged) onChanged();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Sestavi novo delovno mesto — pojavi se v zgornji vrstici, s svojimi kategorijami in polji vnosa.</p>
        <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm font-semibold flex-shrink-0"><Plus className="w-4 h-4" /> Novo delovno mesto</button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Nalagam...</div>
      ) : departments.length === 0 ? (
        <div className="py-10 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          Ni delovnih mest po meri. Klikni "Novo delovno mesto".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {departments.map((d) => {
            const Ic = getIcon(d.icon);
            return (
              <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border ${d.active ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: d.accentBg }}>
                  <Ic className="w-5 h-5" style={{ color: d.accentColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{d.name}{!d.active && <span className="text-xs text-gray-400 font-normal"> (skrito)</span>}</div>
                  <div className="text-xs text-gray-400">{d.categories.length} kategorij · {d.fields.length} polj</div>
                </div>
                <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Uredi"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => remove(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Izbriši"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setShowEditor(false); }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-lg z-10">
              <h3 className="text-base font-bold text-gray-900">{form.id ? 'Uredi delovno mesto' : 'Novo delovno mesto'}</h3>
              <button onClick={() => setShowEditor(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Osnovno */}
              <div className="flex items-start gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ikona</label>
                  <IconPicker value={form.icon} onChange={(icon) => patch({ icon })} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ime delovnega mesta *</label>
                  <input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="npr. Skladišče" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Barva</label>
                <ColorPicker color={form.accentColor} bg={form.accentBg} onChange={(color, bg) => patch({ accentColor: color, accentBg: bg })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opis (neobvezno)</label>
                <input value={form.descr} onChange={(e) => patch({ descr: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                <span className="text-gray-700">Aktivno (prikazano v vrstici)</span>
              </label>

              {/* Kategorije */}
              <div className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-gray-800 text-sm">Kategorije</div>
                  <button onClick={addCategory} className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Kategorija</button>
                </div>
                {form.categories.length === 0 && <p className="text-xs text-gray-400">Ni kategorij. Dodaj vsaj eno.</p>}
                <div className="space-y-2">
                  {form.categories.map((c, i) => {
                    const CIc = getIcon(c.icon);
                    const open = !!openCat[i];
                    return (
                      <div key={c.key} className="border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 p-2">
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bgColor }}><CIc className="w-4 h-4" style={{ color: c.color }} /></div>
                          <input value={c.name} onChange={(e) => updateCategory(i, { name: e.target.value })} placeholder="Ime kategorije" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                          <button onClick={() => setOpenCat((p) => ({ ...p, [i]: !p[i] }))} className="p-1 text-gray-400 hover:text-gray-700" title="Podrobnosti">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
                          <button onClick={() => removeCategory(i)} className="p-1 text-gray-400 hover:text-red-600" title="Odstrani"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {open && (
                          <div className="px-2 pb-2 space-y-2 border-t border-gray-100 pt-2">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Ikona</div>
                                <IconPicker value={c.icon} onChange={(icon) => updateCategory(i, { icon })} />
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Barva</div>
                                <ColorPicker color={c.color} bg={c.bgColor} onChange={(color, bg) => updateCategory(i, { color, bgColor: bg })} />
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Opis</div>
                              <input value={c.desc || ''} onChange={(e) => updateCategory(i, { desc: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-red-500" />
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Podkategorije</div>
                              <MiniTags items={c.subKategorije || []} setItems={(sub) => updateCategory(i, { subKategorije: sub })} placeholder="Nova podkategorija…" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Polja po meri */}
              <div className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-gray-800 text-sm">Polja vnosa po meri</div>
                  <button onClick={addField} className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Polje</button>
                </div>
                <p className="text-[11px] text-gray-400 mb-2">Poleg standardnih polj (naslov, opis, partner, delavec, rok, status).</p>
                {form.fields.length === 0 && <p className="text-xs text-gray-400">Ni dodatnih polj.</p>}
                <div className="space-y-2">
                  {form.fields.map((f, i) => (
                    <div key={f.key} className="border border-gray-100 rounded-lg p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Ime polja (npr. Št. ponudbe)" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                        <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                          {FIELD_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                          <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(i, { required: e.target.checked })} className="w-3.5 h-3.5" style={{ accentColor: '#C8102E' }} /> obvezno
                        </label>
                        <button onClick={() => removeField(i)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      {f.type === 'select' && (
                        <div>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Možnosti za izbiro</div>
                          <MiniTags items={f.options || []} setItems={(opts) => updateField(i, { options: opts })} placeholder="Nova možnost…" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            </div>

            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Prekliči</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Shrani delovno mesto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
