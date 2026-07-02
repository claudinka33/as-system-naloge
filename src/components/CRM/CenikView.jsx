// CenikView.jsx — CENIK: hitri izračun, urejanje cen (admin), artikli v poslu (pipeline)
// Vse cene so NETO (brez DDV). Enote: /100 kos, /kos, /garnituro, /kg.
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { Search, Plus, X, Save, Trash2, Loader2, Calculator, Pencil } from 'lucide-react';

const CRM_COLOR = '#7C2D12';
const AS_RED = '#C8102E';
const DDV = 0.22;
const UNIT_LABEL = { '100kos': '/ 100 kos', '1kos': '/ kos', '1grt': '/ garnituro', 'kg': '/ kg' };
const UNIT_QTY = { '100kos': '× 100 kos', '1kos': 'kos', '1grt': 'garnitur', 'kg': 'kg' };
const ENOTA_OPTS = [['100kos', '/ 100 kos'], ['1kos', '/ kos'], ['1grt', '/ garnituro'], ['kg', '/ kg']];
const inputCls = "w-full px-3 py-2.5 border border-as-gray-200 rounded-xl bg-white text-base focus:outline-none focus:border-as-red-600 focus:ring-2 focus:ring-red-100 disabled:bg-as-gray-50 disabled:text-as-gray-400";

const round4 = (n) => Math.round(n * 10000) / 10000;
const round2 = (n) => Math.round(n * 100) / 100;
function fmt(n, dec = 2) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('sl-SI', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
const unitLabel = (u) => UNIT_LABEL[u] || '';

const NETO_NOTE = (
  <div className="text-xs text-as-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
    ℹ️ Vse cene so <b>neto cene, brez DDV</b>. Prikaz »z DDV« je informativen (22 %).
  </div>
);

// Iskalnik po ceniku (šifra / naziv / dimenzija)
function ArticlePicker({ onPick, placeholder }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openList, setOpenList] = useState(false);
  const tRef = useRef(null);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    const term = q.trim();
    if (term.length < 2) { setRes([]); setOpenList(false); return; }
    tRef.current = setTimeout(async () => {
      setLoading(true);
      const t = term.replace(/[,%()*]/g, ' ').trim();
      const { data, error } = await supabase.from('cenik')
        .select('sifra,ean,naziv,naziv2,cena_neto,enota,na_povprasevanje,skupina,vir')
        .or(`sifra.ilike.%${t}%,naziv.ilike.%${t}%,naziv2.ilike.%${t}%`)
        .order('vir', { ascending: true })
        .limit(25);
      if (!error) { setRes(data || []); setOpenList(true); }
      setLoading(false);
    }, 250);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [q]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-as-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setOpenList(true)}
          className={inputCls + ' pl-9'} placeholder={placeholder || 'Išči po šifri ali nazivu…'} />
        {loading && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-as-gray-400" />}
      </div>
      {openList && res.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-auto bg-white border border-as-gray-200 rounded-xl shadow-lg">
          {res.map((a) => (
            <button type="button" key={a.sifra} onClick={() => { onPick(a); setOpenList(false); setQ(''); setRes([]); }}
              className="w-full text-left px-3 py-2 hover:bg-as-gray-50 border-b border-as-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-as-gray-800 truncate">{a.naziv2 || a.naziv}</span>
                <span className="text-[11px] text-as-gray-400 whitespace-nowrap">{a.sifra}</span>
                <span className="ml-auto text-sm font-bold whitespace-nowrap" style={{ color: CRM_COLOR }}>
                  {a.na_povprasevanje ? 'na povpr.' : `${fmt(a.cena_neto)} €`}
                </span>
              </div>
              <div className="text-xs text-as-gray-500 truncate">{a.naziv} · {unitLabel(a.enota)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Kalkulator: polna cena → popust ⇄ končna cena (+ DDV, + količina)
function CalcCard({ article, onAdd, addLabel, onClear }) {
  const full = article && !article.na_povprasevanje && article.cena_neto != null ? Number(article.cena_neto) : null;
  const [popust, setPopust] = useState('');
  const [koncna, setKoncna] = useState('');
  const [kolicina, setKolicina] = useState('');

  useEffect(() => {
    if (full != null) { setKoncna(String(round4(full))); setPopust('0'); }
    else { setKoncna(''); setPopust(''); }
    setKolicina('');
  }, [article ? article.sifra : null]);

  function onPopust(v) {
    setPopust(v);
    if (full == null) return;
    if (v === '' || isNaN(v)) { setKoncna(String(round4(full))); return; }
    setKoncna(String(round4(full * (1 - Number(v) / 100))));
  }
  function onKoncna(v) {
    setKoncna(v);
    if (full == null) return;
    if (v === '' || isNaN(v)) { setPopust(''); return; }
    if (full > 0) setPopust(String(round2((1 - Number(v) / full) * 100)));
  }

  if (!article) return null;
  const koncnaN = (koncna === '' || isNaN(koncna)) ? null : Number(koncna);
  const zDDV = koncnaN == null ? null : koncnaN * (1 + DDV);
  const kolN = (kolicina === '' || isNaN(kolicina)) ? null : Number(kolicina);
  const skupaj = (koncnaN != null && kolN != null) ? koncnaN * kolN : null;

  return (
    <div className="border border-as-gray-200 rounded-xl p-3 bg-white shadow-sm space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-as-gray-800">{article.naziv2 || article.naziv}</div>
          <div className="text-xs text-as-gray-500 truncate">{article.naziv} · šifra {article.sifra}</div>
          <div className="text-[11px] text-as-gray-400">enota cene: {unitLabel(article.enota)}{article.vir ? ' · ' + article.vir : ''}</div>
        </div>
        {onClear && <button type="button" onClick={onClear} className="p-1 text-as-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
      </div>

      {full == null ? (
        <div className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Cena na povpraševanje — brez izračuna.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Polna neto cena {unitLabel(article.enota)}</label>
              <input value={fmt(full, 4)} disabled className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Popust %</label>
              <input type="number" inputMode="decimal" value={popust} onChange={(e) => onPopust(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Končna neto cena</label>
              <input type="number" inputMode="decimal" value={koncna} onChange={(e) => onKoncna(e.target.value)} className={inputCls} style={{ fontWeight: 700 }} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Z DDV (22 %)</label>
              <input value={fmt(zDDV, 4)} disabled className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Količina ({UNIT_QTY[article.enota] || 'enot'})</label>
              <input type="number" inputMode="decimal" value={kolicina} onChange={(e) => setKolicina(e.target.value)} className={inputCls} placeholder="neobvezno" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-as-gray-500 uppercase mb-1">Skupaj neto</label>
              <input value={skupaj == null ? '—' : fmt(skupaj, 2) + ' €'} disabled className={inputCls} />
            </div>
          </div>
        </>
      )}

      {onAdd && (
        <button type="button" onClick={() => onAdd({
          sifra: article.sifra, naziv: article.naziv, naziv2: article.naziv2, enota: article.enota, vir: article.vir,
          na_povprasevanje: !!article.na_povprasevanje,
          polna: full, popust: popust === '' ? null : Number(popust),
          koncna: koncnaN, kolicina: kolN,
          skupaj: skupaj == null ? koncnaN : skupaj,
        })}
          className="w-full justify-center px-3 py-2.5 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2" style={{ background: CRM_COLOR }}>
          <Plus className="w-4 h-4" /> {addLabel || 'Dodaj artikel v posel'}
        </button>
      )}
    </div>
  );
}

// Hitri izračun (samostojni zavihek)
function QuickCalc() {
  const [article, setArticle] = useState(null);
  return (
    <div className="space-y-3 max-w-2xl">
      {NETO_NOTE}
      <ArticlePicker onPick={setArticle} placeholder="Išči artikel po šifri ali nazivu…" />
      {article
        ? <CalcCard article={article} onClear={() => setArticle(null)} />
        : <div className="text-center py-10 text-as-gray-400 text-sm border border-dashed border-as-gray-200 rounded-xl">Poišči artikel za izračun cene.</div>}
    </div>
  );
}

// Urejanje cenika (admin): naziv, dimenzija, enota, cena + dodajanje (šifra ni spremenljiva)
function CenikEditor() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const emptyNew = { sifra: '', naziv: '', naziv2: '', enota: '100kos', cena: '' };
  const [nu, setNu] = useState(emptyNew);

  function initDrafts(list) {
    const d = {};
    list.forEach((r) => { d[r.id] = { naziv: r.naziv || '', naziv2: r.naziv2 || '', enota: r.enota, cena: r.cena_neto ?? '' }; });
    setDrafts(d);
  }
  async function search() {
    setLoading(true); setMsg('');
    const t = q.trim().replace(/[,%()*]/g, ' ').trim();
    let qy = supabase.from('cenik').select('*').order('vir').order('skupina').limit(80);
    if (t.length >= 2) qy = qy.or(`sifra.ilike.%${t}%,naziv.ilike.%${t}%,naziv2.ilike.%${t}%`);
    const { data, error } = await qy;
    if (!error) { setRows(data || []); initDrafts(data || []); }
    setLoading(false);
  }
  useEffect(() => { search(); }, []);

  const setDraft = (id, field, val) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: val } }));
  function isDirty(r) {
    const d = drafts[r.id]; if (!d) return false;
    return d.naziv !== (r.naziv || '') || d.naziv2 !== (r.naziv2 || '') || d.enota !== r.enota || String(d.cena) !== String(r.cena_neto ?? '');
  }
  async function saveRow(r) {
    const d = drafts[r.id]; if (!d) return;
    setSavingId(r.id);
    const cena = (d.cena === '' || d.cena == null) ? null : Number(d.cena);
    const patch = { naziv: d.naziv || null, naziv2: d.naziv2 || null, enota: d.enota, cena_neto: cena, na_povprasevanje: cena == null };
    const { error } = await supabase.from('cenik').update(patch).eq('id', r.id);
    setSavingId(null);
    if (error) { setMsg('Napaka: ' + error.message); return; }
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, ...patch } : x));
    setMsg('Shranjeno.'); setTimeout(() => setMsg(''), 1500);
  }
  async function addNew() {
    if (!nu.sifra.trim()) { setMsg('Napaka: vnesi šifro.'); return; }
    const cena = nu.cena === '' ? null : Number(nu.cena);
    const row = { sifra: nu.sifra.trim(), naziv: nu.naziv || null, naziv2: nu.naziv2 || null, enota: nu.enota, cena_neto: cena, na_povprasevanje: cena == null, vir: 'rocno' };
    const { data, error } = await supabase.from('cenik').insert([row]).select();
    if (error) { setMsg('Napaka: ' + error.message); return; }
    const added = data || [];
    setRows((rs) => [...added, ...rs]);
    initDrafts([...added, ...rows]);
    setNu(emptyNew); setShowAdd(false);
    setMsg('Dodano.'); setTimeout(() => setMsg(''), 1500);
  }

  const smallInput = "w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:border-as-red-600";

  return (
    <div className="space-y-3">
      <div className="text-xs text-as-gray-600 bg-as-gray-50 border border-as-gray-200 rounded-lg px-3 py-2">
        Urejaš lahko naziv, dimenzijo, enoto in ceno (šifre ne). Za <b>veliko sprememb</b> raje ponovno uvozi Excel (uskladi se po šifri).
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-as-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
            className={inputCls + ' pl-9'} placeholder="Išči po šifri / nazivu / dimenziji…" />
        </div>
        <button type="button" onClick={search} className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl" style={{ background: CRM_COLOR }}>Išči</button>
        <button type="button" onClick={() => setShowAdd((s) => !s)} className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-as-gray-300 text-as-gray-700 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nov artikel
        </button>
      </div>

      {showAdd && (
        <div className="border border-as-gray-200 rounded-xl p-3 bg-white space-y-2">
          <div className="text-sm font-bold text-as-gray-700">Nov artikel</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input className={smallInput} placeholder="Šifra *" value={nu.sifra} onChange={(e) => setNu({ ...nu, sifra: e.target.value })} />
            <input className={smallInput} placeholder="Naziv" value={nu.naziv} onChange={(e) => setNu({ ...nu, naziv: e.target.value })} />
            <input className={smallInput} placeholder="Dimenzija" value={nu.naziv2} onChange={(e) => setNu({ ...nu, naziv2: e.target.value })} />
            <select className={smallInput} value={nu.enota} onChange={(e) => setNu({ ...nu, enota: e.target.value })}>
              {ENOTA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className={smallInput} type="number" inputMode="decimal" placeholder="Cena €" value={nu.cena} onChange={(e) => setNu({ ...nu, cena: e.target.value })} />
          </div>
          <button type="button" onClick={addNew} className="px-4 py-2 text-white text-sm font-semibold rounded-lg" style={{ background: CRM_COLOR }}>Dodaj artikel</button>
        </div>
      )}

      {msg && <div className="text-sm font-semibold" style={{ color: msg.startsWith('Napaka') ? '#b91c1c' : '#16a34a' }}>{msg}</div>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-as-gray-400" /></div>
      ) : (
        <div className="overflow-x-auto border border-as-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                <th className="text-left px-2 py-2">Šifra</th>
                <th className="text-left px-2 py-2 min-w-40">Naziv</th>
                <th className="text-left px-2 py-2">Dimenzija</th>
                <th className="text-left px-2 py-2">Enota</th>
                <th className="text-right px-2 py-2">Neto cena €</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = drafts[r.id] || {};
                const dirty = isDirty(r);
                return (
                  <tr key={r.id} className="border-t border-as-gray-100 align-top">
                    <td className="px-2 py-2 text-[11px] text-as-gray-400 whitespace-nowrap">{r.sifra}</td>
                    <td className="px-2 py-2"><input className={smallInput} value={d.naziv ?? ''} onChange={(e) => setDraft(r.id, 'naziv', e.target.value)} /></td>
                    <td className="px-2 py-2"><input className={smallInput + ' w-28'} value={d.naziv2 ?? ''} onChange={(e) => setDraft(r.id, 'naziv2', e.target.value)} /></td>
                    <td className="px-2 py-2">
                      <select className={smallInput} value={d.enota || '100kos'} onChange={(e) => setDraft(r.id, 'enota', e.target.value)}>
                        {ENOTA_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" inputMode="decimal" className={smallInput + ' w-24 text-right'}
                        value={d.cena ?? ''} onChange={(e) => setDraft(r.id, 'cena', e.target.value)} placeholder="povpr." />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => saveRow(r)} disabled={!dirty || savingId === r.id}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 disabled:opacity-30"
                        style={{ background: dirty ? CRM_COLOR : '#e5e7eb', color: dirty ? '#fff' : '#9ca3af' }}>
                        {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-as-gray-400">Ni zadetkov.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// GLAVNI zavihek CENIK
export default function CenikView({ isAdmin }) {
  const [mode, setMode] = useState('calc');
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {isAdmin && (
        <div className="inline-flex gap-1 bg-as-gray-100 rounded-xl p-1 border border-as-gray-200">
          <button type="button" onClick={() => setMode('calc')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 ${mode === 'calc' ? 'text-white' : 'text-as-gray-500'}`}
            style={mode === 'calc' ? { background: AS_RED } : {}}><Calculator className="w-4 h-4" /> Hitri izračun</button>
          <button type="button" onClick={() => setMode('edit')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 ${mode === 'edit' ? 'text-white' : 'text-as-gray-500'}`}
            style={mode === 'edit' ? { background: AS_RED } : {}}><Pencil className="w-4 h-4" /> Uredi cenik</button>
        </div>
      )}
      {mode === 'calc' ? <QuickCalc /> : <CenikEditor />}
    </div>
  );
}

// Urejevalnik artiklov posla — deluje na lokalnem seznamu (nov posel) ali na shranjenem poslu
export function ArticleEditor({ items, onChange, onSetValue }) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(null);
  const list = Array.isArray(items) ? items : [];
  const sum = list.reduce((s, it) => s + (Number(it.skupaj ?? it.koncna) || 0), 0);

  function add(it) { onChange([...list, it]); setPicked(null); setAdding(false); }
  function remove(i) { onChange(list.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="space-y-1.5">
          {list.map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-as-gray-50 border border-as-gray-100 rounded-lg px-2.5 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-as-gray-800 truncate">{it.naziv2 || it.naziv} <span className="text-as-gray-400">· {it.sifra}</span></div>
                <div className="text-as-gray-500">
                  {it.na_povprasevanje
                    ? 'na povpraševanje'
                    : `${fmt(it.koncna)} € ${unitLabel(it.enota)}${it.popust ? ` (−${fmt(it.popust)} %)` : ''}${it.kolicina ? ` × ${it.kolicina}` : ''}`}
                </div>
              </div>
              <button type="button" onClick={() => remove(i)} className="p-1 text-as-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {sum > 0 && onSetValue && (
        <button type="button" onClick={() => onSetValue(sum)} className="text-[11px] font-semibold text-as-gray-500 hover:text-as-gray-800 underline">
          Vsota {fmt(sum, 0)} € → vrednost posla
        </button>
      )}

      {adding ? (
        <div className="space-y-2">
          <ArticlePicker onPick={setPicked} placeholder="Išči artikel za dodajanje…" />
          {picked && <CalcCard article={picked} onAdd={add} onClear={() => setPicked(null)} addLabel="Dodaj v posel" />}
          <button type="button" onClick={() => { setAdding(false); setPicked(null); }} className="text-xs text-as-gray-500 hover:text-as-gray-800">Prekliči</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full justify-center px-3 py-2 text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 border border-dashed border-as-gray-300 text-as-gray-600 hover:border-as-red-600 hover:text-as-red-600">
          <Plus className="w-4 h-4" /> Dodaj artikel
        </button>
      )}
    </div>
  );
}
