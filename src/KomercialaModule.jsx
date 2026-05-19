import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  Phone, Plus, Save, Edit2, Trash2, X, Calendar as CalendarIcon,
  Paperclip, TrendingUp, FileText, AlertCircle, Package, Briefcase,
  Cog, ChevronDown, ChevronUp, Download
} from 'lucide-react';

const TABLE = 'komerciala_dnevni';
const BUCKET = 'komerciala-priponke';

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateSlo(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function emptyForm() {
  return {
    datum: todayISO(),
    mn_odprti: 0,
    mn_zakljuceni: 0,
    pn_odprti: 0,
    pn_zakljuceni: 0,
    prevzemnice: 0,
    reklamacije: 0,
    kooperanti: 0,
    ostalo: 0,
    opomba: '',
  };
}

export default function KomercialaModule({ currentUser, isAdmin }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('dnevno'); // 'dnevno' | 'mesecno'
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('datum', { ascending: false })
      .limit(365);
    if (error) {
      console.error('load komerciala:', error);
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setPendingFile(null);
    setShowForm(true);
  }

  function openEdit(entry) {
    setEditingId(entry.id);
    setForm({
      datum: entry.datum,
      mn_odprti: entry.mn_odprti || 0,
      mn_zakljuceni: entry.mn_zakljuceni || 0,
      pn_odprti: entry.pn_odprti || 0,
      pn_zakljuceni: entry.pn_zakljuceni || 0,
      prevzemnice: entry.prevzemnice || 0,
      reklamacije: entry.reklamacije || 0,
      kooperanti: entry.kooperanti || 0,
      ostalo: entry.ostalo || 0,
      opomba: entry.opomba || '',
    });
    setPendingFile(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.datum) {
      alert('Datum je obvezen.');
      return;
    }
    setSaving(true);

    let priponka_url = null;
    let priponka_name = null;

    if (pendingFile) {
      const path = `${form.datum}-${Date.now()}-${pendingFile.name}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, pendingFile, { upsert: false });
      if (upErr) {
        console.error('upload err:', upErr);
        alert('Napaka pri nalaganju priponke: ' + upErr.message);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      priponka_url = pub?.publicUrl || null;
      priponka_name = pendingFile.name;
    }

    const payload = {
      ...form,
      mn_odprti: Number(form.mn_odprti) || 0,
      mn_zakljuceni: Number(form.mn_zakljuceni) || 0,
      pn_odprti: Number(form.pn_odprti) || 0,
      pn_zakljuceni: Number(form.pn_zakljuceni) || 0,
      prevzemnice: Number(form.prevzemnice) || 0,
      reklamacije: Number(form.reklamacije) || 0,
      kooperanti: Number(form.kooperanti) || 0,
      ostalo: Number(form.ostalo) || 0,
      created_by_email: currentUser?.email || '',
      created_by_name: currentUser?.name || '',
      updated_at: new Date().toISOString(),
    };
    if (priponka_url) {
      payload.priponka_url = priponka_url;
      payload.priponka_name = priponka_name;
    }

    let error;
    if (editingId) {
      const r = await supabase.from(TABLE).update(payload).eq('id', editingId);
      error = r.error;
    } else {
      const r = await supabase.from(TABLE).insert(payload);
      error = r.error;
      if (error && error.code === '23505') {
        // unique violation on datum -> update obstoječi
        const { data: existing } = await supabase
          .from(TABLE).select('id').eq('datum', form.datum).maybeSingle();
        if (existing) {
          const r2 = await supabase.from(TABLE).update(payload).eq('id', existing.id);
          error = r2.error;
        }
      }
    }

    setSaving(false);
    if (error) {
      console.error(error);
      alert('Napaka pri shranjevanju: ' + error.message);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setPendingFile(null);
    await loadEntries();
  }

  async function handleDelete(id) {
    if (!confirm('Res izbrišem ta vnos?')) return;
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) {
      alert('Napaka: ' + error.message);
      return;
    }
    await loadEntries();
  }

  // Mesečni agregat
  const mesecniData = (() => {
    const map = {};
    for (const e of entries) {
      const mk = e.datum.slice(0, 7); // YYYY-MM
      if (!map[mk]) {
        map[mk] = {
          mesec: mk, mn_odprti: 0, mn_zakljuceni: 0, pn_odprti: 0,
          pn_zakljuceni: 0, prevzemnice: 0, reklamacije: 0,
          kooperanti: 0, ostalo: 0, count: 0,
        };
      }
      map[mk].mn_odprti += e.mn_odprti || 0;
      map[mk].mn_zakljuceni += e.mn_zakljuceni || 0;
      map[mk].pn_odprti += e.pn_odprti || 0;
      map[mk].pn_zakljuceni += e.pn_zakljuceni || 0;
      map[mk].prevzemnice += e.prevzemnice || 0;
      map[mk].reklamacije += e.reklamacije || 0;
      map[mk].kooperanti += e.kooperanti || 0;
      map[mk].ostalo += e.ostalo || 0;
      map[mk].count += 1;
    }
    return Object.values(map).sort((a, b) => b.mesec.localeCompare(a.mesec));
  })();

  function NumberField({ label, value, onChange, color = '#1E40AF' }) {
    return (
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
          {label}
        </label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:border-blue-500"
          style={{ color }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
            <Phone className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Komerciala</h1>
            <p className="text-sm text-gray-500">Dnevna evidenca odprtih in zaključenih nalogov</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nov dnevni vnos
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('dnevno')}
          className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${
            view === 'dnevno' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border'
          }`}
        >
          <CalendarIcon className="w-4 h-4" /> Dnevno
        </button>
        <button
          onClick={() => setView('mesecno')}
          className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 ${
            view === 'mesecno' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 border'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Mesečno
        </button>
      </div>

      {/* DNEVNO */}
      {view === 'dnevno' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Nalagam ...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Še ni vnosov. Klikni <strong>Nov dnevni vnos</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold text-gray-600">Datum</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">MN odp.</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">MN zak.</th>
                    <th className="px-3 py-3 text-center font-bold text-amber-700">PN odp.</th>
                    <th className="px-3 py-3 text-center font-bold text-amber-700">PN zak.</th>
                    <th className="px-3 py-3 text-center font-bold text-green-700">Prev.</th>
                    <th className="px-3 py-3 text-center font-bold text-red-700">Rek.</th>
                    <th className="px-3 py-3 text-center font-bold text-purple-700">Koop.</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-700">Ost.</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <>
                      <tr key={e.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 font-bold text-gray-900">{formatDateSlo(e.datum)}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-700">{e.mn_odprti}</td>
                        <td className="px-3 py-3 text-center font-bold text-blue-700">{e.mn_zakljuceni}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-700">{e.pn_odprti}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-700">{e.pn_zakljuceni}</td>
                        <td className="px-3 py-3 text-center font-bold text-green-700">{e.prevzemnice}</td>
                        <td className="px-3 py-3 text-center font-bold text-red-700">{e.reklamacije}</td>
                        <td className="px-3 py-3 text-center font-bold text-purple-700">{e.kooperanti}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-700">{e.ostalo}</td>
                        <td className="px-3 py-3 flex gap-1 justify-end">
                          <button
                            onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="Podrobnosti"
                          >
                            {expandedRow === e.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => openEdit(e)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded"
                            title="Uredi"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded"
                              title="Izbriši"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRow === e.id && (
                        <tr className="bg-gray-50 border-b">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="space-y-2 text-sm">
                              {e.opomba && (
                                <div>
                                  <span className="font-bold text-gray-700">Opomba: </span>
                                  <span className="text-gray-800 whitespace-pre-wrap">{e.opomba}</span>
                                </div>
                              )}
                              {e.priponka_url && (
                                <div>
                                  
                                    href={e.priponka_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                                  >
                                    <Paperclip className="w-4 h-4" />
                                    {e.priponka_name || 'priponka'}
                                  </a>
                                </div>
                              )}
                              {e.created_by_name && (
                                <div className="text-xs text-gray-500">
                                  Vnesel: {e.created_by_name} ({new Date(e.created_at).toLocaleString('sl-SI')})
                                </div>
                              )}
                              {!e.opomba && !e.priponka_url && (
                                <div className="text-gray-400 italic">Brez opombe ali priponke.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MESEČNO */}
      {view === 'mesecno' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {mesecniData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Še ni podatkov.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-bold text-gray-600">Mesec</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-500">Dni</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">MN odp.</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">MN zak.</th>
                    <th className="px-3 py-3 text-center font-bold text-amber-700">PN odp.</th>
                    <th className="px-3 py-3 text-center font-bold text-amber-700">PN zak.</th>
                    <th className="px-3 py-3 text-center font-bold text-green-700">Prev.</th>
                    <th className="px-3 py-3 text-center font-bold text-red-700">Rek.</th>
                    <th className="px-3 py-3 text-center font-bold text-purple-700">Koop.</th>
                    <th className="px-3 py-3 text-center font-bold text-gray-700">Ost.</th>
                  </tr>
                </thead>
                <tbody>
                  {mesecniData.map((m) => (
                    <tr key={m.mesec} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-3 font-bold text-gray-900">{m.mesec}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{m.count}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700">{m.mn_odprti}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-700">{m.mn_zakljuceni}</td>
                      <td className="px-3 py-3 text-center font-bold text-amber-700">{m.pn_odprti}</td>
                      <td className="px-3 py-3 text-center font-bold text-amber-700">{m.pn_zakljuceni}</td>
                      <td className="px-3 py-3 text-center font-bold text-green-700">{m.prevzemnice}</td>
                      <td className="px-3 py-3 text-center font-bold text-red-700">{m.reklamacije}</td>
                      <td className="px-3 py-3 text-center font-bold text-purple-700">{m.kooperanti}</td>
                      <td className="px-3 py-3 text-center font-bold text-gray-700">{m.ostalo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Uredi dnevni vnos' : 'Nov dnevni vnos'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Datum */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                  Datum *
                </label>
                <input
                  type="date"
                  value={form.datum}
                  onChange={(e) => setForm({ ...form, datum: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Če za ta datum že obstaja vnos, ga bo prepisalo.</p>
              </div>

              {/* Montažni nalogi */}
              <div className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-700" />
                  <h3 className="font-bold text-blue-700">Montažni nalogi</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Odprti" value={form.mn_odprti}
                    onChange={(v) => setForm({ ...form, mn_odprti: v })} color="#1E40AF" />
                  <NumberField label="Zaključeni" value={form.mn_zakljuceni}
                    onChange={(v) => setForm({ ...form, mn_zakljuceni: v })} color="#1E40AF" />
                </div>
              </div>

              {/* Proizvodnji nalogi */}
              <div className="border-2 border-amber-200 rounded-lg p-3 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <Cog className="w-5 h-5 text-amber-700" />
                  <h3 className="font-bold text-amber-700">Proizvodnji nalogi</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="Odprti" value={form.pn_odprti}
                    onChange={(v) => setForm({ ...form, pn_odprti: v })} color="#854D0E" />
                  <NumberField label="Zaključeni" value={form.pn_zakljuceni}
                    onChange={(v) => setForm({ ...form, pn_zakljuceni: v })} color="#854D0E" />
                </div>
              </div>

              {/* Ostala polja */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <NumberField label="Prevzemnice" value={form.prevzemnice}
                  onChange={(v) => setForm({ ...form, prevzemnice: v })} color="#065F46" />
                <NumberField label="Reklamacije" value={form.reklamacije}
                  onChange={(v) => setForm({ ...form, reklamacije: v })} color="#B91C1C" />
                <NumberField label="Kooperanti" value={form.kooperanti}
                  onChange={(v) => setForm({ ...form, kooperanti: v })} color="#5B21B6" />
                <NumberField label="Ostalo" value={form.ostalo}
                  onChange={(v) => setForm({ ...form, ostalo: v })} color="#374151" />
              </div>

              {/* Opomba */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                  Opomba
                </label>
                <textarea
                  value={form.opomba}
                  onChange={(e) => setForm({ ...form, opomba: e.target.value })}
                  rows={3}
                  placeholder="Opombe ..."
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Priponka */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">
                  Priponka (neobvezno)
                </label>
                <input
                  type="file"
                  onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                {pendingFile && (
                  <p className="text-xs text-gray-600 mt-1">
                    📎 {pendingFile.name} ({Math.round(pendingFile.size / 1024)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg"
              >
                Prekliči
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Shranjujem ...' : 'Shrani'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
