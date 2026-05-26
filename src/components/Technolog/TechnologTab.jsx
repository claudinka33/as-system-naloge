// TechnologTab.jsx — Glavni zavihek "Tehnolog"
// Dizajn usklajen z ProductionV2Tab style
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BarChart3, Loader2, Download, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, FileText, Edit2 } from 'lucide-react';
import { supabase } from '../../supabase';

const AS_RED = '#C8102E';
const TECH_COLOR = '#1E40AF';
const TECH_BG = '#BFDBFE';

const SLOVENIAN_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

const FIELDS = [
  { key: 'new_developments', label: 'Število novih razvojev / projektov', placeholder: 'Kateri projekti potekajo, status...' },
  { key: 'optimizations', label: 'Optimizacije obstoječih procesov', placeholder: 'Kaj ste izboljšali, prihranki časa/materiala...' },
  { key: 'technical_issues', label: 'Tehnične težave / izzivi tega dne', placeholder: 'Opišite tehnične izzive in rešitve...' },
  { key: 'collaboration', label: 'Sodelovanje z drugimi oddelki', placeholder: 'S kom ste sodelovali, kakšen je bil rezultat...' },
  { key: 'machine_proposals', label: 'Predlogi za nove stroje / orodja', placeholder: 'Kaj potrebujemo, koliko stane, zakaj...' },
  { key: 'tooling_status', label: 'Status orodjarne (skladnost, vzdrževanje)', placeholder: 'Stanje orodij, potrebno vzdrževanje...' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI');
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// 7-dnevni zaklep
function isLocked(entryDate, createdBy, currentUserEmail, isAdmin) {
  if (isAdmin) return false;
  if (createdBy !== currentUserEmail) return true;
  const d = new Date(entryDate);
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

export default function TechnologTab({ currentUser, isAdmin }) {
  const [view, setView] = useState('monthly');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('technolog_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
            <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
            <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
            <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
          </div>
        </div>
        <div id="technolog-controls-slot" className="flex flex-wrap items-center gap-3 ml-auto"></div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {view === 'entry' && <EntryView currentUser={currentUser} entries={entries} isAdmin={isAdmin} onSaved={loadAll} setError={setError} />}
      {view === 'daily' && <DailyView entries={entries} isAdmin={isAdmin} currentUser={currentUser} onReload={loadAll} loading={loading} />}
      {view === 'monthly' && <MonthlyView entries={entries} loading={loading} />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: AS_RED } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── ENTRY VIEW ───
function EntryView({ currentUser, entries, isAdmin, onSaved, setError }) {
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formOperater, setFormOperater] = useState(currentUser?.name || '');
  const [content, setContent] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Najdi obstoječi vnos za izbrani datum + uporabnika
  const existingEntry = useMemo(() => {
    if (editingId) return entries.find((e) => e.id === editingId);
    return entries.find(
      (e) => e.entry_date === formDate && e.created_by === currentUser?.email
    );
  }, [formDate, entries, editingId, currentUser]);

  useEffect(() => {
    if (existingEntry) {
      setContent({
        new_developments: existingEntry.new_developments || '',
        optimizations: existingEntry.optimizations || '',
        technical_issues: existingEntry.technical_issues || '',
        collaboration: existingEntry.collaboration || '',
        machine_proposals: existingEntry.machine_proposals || '',
        tooling_status: existingEntry.tooling_status || '',
      });
      setFormOperater(existingEntry.operater || currentUser?.name || '');
    } else {
      setContent({});
      setFormOperater(currentUser?.name || '');
    }
  }, [existingEntry, currentUser]);

  function updateField(key, value) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setContent({});
    setEditingId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formOperater) {
      setError('Vnesi ime delavca.');
      return;
    }
    const hasContent = Object.values(content).some((v) => v && v.trim() !== '');
    if (!hasContent) {
      setError('Izpolni vsaj eno polje.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        entry_date: formDate,
        new_developments: content.new_developments || null,
        optimizations: content.optimizations || null,
        technical_issues: content.technical_issues || null,
        collaboration: content.collaboration || null,
        machine_proposals: content.machine_proposals || null,
        tooling_status: content.tooling_status || null,
        operater: formOperater,
        created_by: currentUser?.email || null,
      };

      if (existingEntry) {
        const { error } = await supabase
          .from('technolog_entries')
          .update(payload)
          .eq('id', existingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('technolog_entries').insert([payload]);
        if (error) throw error;
      }

      reset();
      onSaved();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  const locked = existingEntry ? isLocked(existingEntry.entry_date, existingEntry.created_by, currentUser?.email, isAdmin) : false;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm space-y-4 max-w-4xl mx-auto">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: TECH_BG, color: TECH_COLOR }}>⚙️</span>
        {existingEntry ? 'Uredi vnos tehnologa' : 'Nov dnevni vnos tehnologa'}
      </h3>

      {existingEntry && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>Za ta dan že obstaja vnos — urejaš ga.</span>
        </div>
      )}

      {locked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Vnos je starejši od 7 dni — samo admin lahko ureja.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required disabled={locked} className={inputCls} />
        </FormField>
        <FormField label="Tehnolog / Delavec *">
          <input type="text" value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required disabled={locked} className={inputCls} placeholder="Ime in priimek" />
        </FormField>
      </div>

      <p className="text-xs text-as-gray-500 italic">
        💡 Vnesi samo to, kar je relevantno za ta dan. Prazna polja se ne shranjujejo.
      </p>

      {FIELDS.map((f) => (
        <FormField key={f.key} label={f.label}>
          <textarea
            value={content[f.key] || ''}
            onChange={(e) => updateField(f.key, e.target.value)}
            disabled={locked}
            placeholder={f.placeholder}
            rows={2}
            className={inputCls + ' resize-none'}
          />
        </FormField>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || locked}
          className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50"
          style={{ background: TECH_COLOR }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {existingEntry ? 'Posodobi vnos' : 'Shrani vnos'}
        </button>
        {existingEntry && (
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2.5 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 font-semibold rounded-lg transition"
          >
            Nov vnos
          </button>
        )}
      </div>
    </form>
  );
}

// ─── DAILY VIEW ───
function DailyView({ entries, isAdmin, currentUser, onReload, loading }) {
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotEl, setSlotEl] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('technolog-controls-slot'));
  }, []);

  const dayEntries = entries.filter((e) => e.entry_date === filterDate);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm"
        />
        <span className="text-sm text-as-gray-500 hidden sm:inline">{formatDate(filterDate)}</span>
      </div>
      <button
        onClick={() => exportDailyCSV(filterDate, dayEntries)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> Izvoz v Excel
      </button>
    </>
  );

  async function handleDelete(id) {
    if (!confirm('Izbrišem ta vnos tehnologa?')) return;
    await supabase.from('technolog_entries').delete().eq('id', id);
    onReload();
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-1">⚙️ Tehnolog — {formatLongDate(filterDate)}</h3>
            <p className="text-xs text-as-gray-500">Število vnosov: {dayEntries.length}</p>
          </div>

          {dayEntries.length === 0 ? (
            <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
              <p className="text-as-gray-500">Ni vnosov za ta dan.</p>
            </div>
          ) : (
            dayEntries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                isAdmin={isAdmin}
                currentUser={currentUser}
                onDelete={() => handleDelete(e.id)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

function EntryCard({ entry, isAdmin, currentUser, onDelete }) {
  const [open, setOpen] = useState(true);
  const canDelete = isAdmin || (entry.created_by === currentUser?.email && !isLocked(entry.entry_date, entry.created_by, currentUser?.email, isAdmin));

  const filledFields = FIELDS.filter((f) => entry[f.key] && entry[f.key].trim() !== '');

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-as-gray-100 flex items-center justify-between" style={{ background: TECH_BG + '40' }}>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 font-bold text-as-gray-700">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span>{entry.operater}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-as-gray-500">
            {filledFields.length} polj
          </span>
        </button>
        {canDelete && (
          <button onClick={onDelete} className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="p-5 space-y-4">
          {filledFields.length === 0 ? (
            <p className="text-sm text-as-gray-400 italic">Ni izpolnjenih polj.</p>
          ) : (
            filledFields.map((f) => (
              <div key={f.key}>
                <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">{f.label}</div>
                <div className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry[f.key]}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── MONTHLY VIEW ───
function MonthlyView({ entries, loading }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('technolog-controls-slot'));
  }, []);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.entry_date?.startsWith(monthStr));

  // Statistika
  const totalEntries = monthEntries.length;
  const uniqueDays = new Set(monthEntries.map((e) => e.entry_date)).size;
  const uniqueAuthors = new Set(monthEntries.map((e) => e.operater)).size;

  // Po dnevih
  const byDay = useMemo(() => {
    const map = {};
    for (const e of monthEntries) {
      if (!map[e.entry_date]) map[e.entry_date] = { date: e.entry_date, entries: [], filledCount: 0 };
      map[e.entry_date].entries.push(e);
      map[e.entry_date].filledCount += FIELDS.filter((f) => e[f.key] && e[f.key].trim() !== '').length;
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthEntries]);

  // Po polju (koliko je izpolnjenih)
  const byField = useMemo(() => {
    return FIELDS.map((f) => {
      const filled = monthEntries.filter((e) => e[f.key] && e[f.key].trim() !== '').length;
      return { ...f, filled };
    });
  }, [monthEntries]);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm">
          {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button
        onClick={() => exportMonthlyCSV(year, month, monthEntries)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> Izvoz v Excel
      </button>
    </>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <BigStat icon="📝" label="Skupaj vnosov" value={totalEntries} unit="" color={TECH_COLOR} bgColor={TECH_BG} />
            <BigStat icon="📅" label="Aktivnih dni" value={uniqueDays} unit="dni" color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="👤" label="Tehnologov" value={uniqueAuthors} unit="" color="#7C2D12" bgColor="#FED7AA" />
          </div>

          {/* Po polju */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">📊 Pokritost polj — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {monthEntries.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {byField.map((f) => {
                  const max = Math.max(...byField.map((x) => x.filled), 1);
                  const pct = (f.filled / max) * 100;
                  return (
                    <div key={f.key} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-5 text-as-gray-700 text-xs">{f.label}</div>
                      <div className="col-span-5 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: TECH_COLOR }} />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-as-gray-700">{f.filled}× izpolnjeno</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Po dnevih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">📅 Po dnevih</h3>
            {byDay.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-left p-2">Tehnologi</th>
                      <th className="text-right p-2">Vnosov</th>
                      <th className="text-right p-2">Izpolnjenih polj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((d) => (
                      <tr key={d.date} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                        <td className="p-2 font-semibold">{formatDate(d.date)}</td>
                        <td className="p-2 text-as-gray-700">{[...new Set(d.entries.map((e) => e.operater))].join(', ')}</td>
                        <td className="p-2 text-right font-semibold">{d.entries.length}</td>
                        <td className="p-2 text-right">{d.filledCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BUILDING BLOCKS ───
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div>
        <span className="text-3xl font-bold text-as-gray-700">{value}</span>
        {unit && <span className="text-sm text-as-gray-400 ml-2">{unit}</span>}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>;
}

function LoadingBox() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
      <span className="ml-2 text-as-gray-500">Nalagam...</span>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-as-red-600 disabled:bg-as-gray-50 disabled:text-as-gray-400";

// ─── CSV EXPORT ───
function exportDailyCSV(date, entries) {
  const lines = [];
  lines.push(`Dnevno poročilo TEHNOLOG - ${date}`);
  lines.push('');
  lines.push('Tehnolog;' + FIELDS.map((f) => f.label).join(';'));
  entries.forEach((e) => {
    const row = [e.operater, ...FIELDS.map((f) => (e[f.key] || '').replace(/[\r\n;]/g, ' '))];
    lines.push(row.join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tehnolog-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMonthlyCSV(year, month, entries) {
  const lines = [];
  lines.push(`Mesečno poročilo TEHNOLOG - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');
  lines.push('Datum;Tehnolog;' + FIELDS.map((f) => f.label).join(';'));

  const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  sorted.forEach((e) => {
    const row = [e.entry_date, e.operater, ...FIELDS.map((f) => (e[f.key] || '').replace(/[\r\n;]/g, ' '))];
    lines.push(row.join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tehnolog-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
