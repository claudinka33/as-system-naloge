// AssemblyDailyReport.jsx — Dnevno poročilo montaže
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Loader2, Download, Edit2, Trash2, Lock } from 'lucide-react';
import {
  getDailyAssembly, loadAssemblyMachines, loadAssemblyActivities, deleteAssemblyEntry,
  formatNumber, formatDate, WORK_TYPE_LABELS, canEditEntry, EDIT_LOCK_DAYS
} from '../../lib/assemblyApi.js';

const MANUAL_COUNT_CODES = ['vij_pak', 'pakiranje', 'vrecke', 'titus'];

function parseBreakdowns(raw) {
  if (!raw) return null;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      return {
        zastoj: obj.zastoj || '',
        vzrok: obj.vzrok || '',
        cas: obj.cas || '',
      };
    } catch (e) {}
  }
  return { zastoj: String(raw), vzrok: '', cas: '' };
}

function formatBreakdowns(raw) {
  const b = parseBreakdowns(raw);
  if (!b) return '';
  const parts = [];
  if (b.zastoj) parts.push(b.zastoj);
  if (b.vzrok) parts.push(b.vzrok);
  if (b.cas) parts.push(b.cas);
  return parts.join(' — ');
}

export default function AssemblyDailyReport({ onEditEntry }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('assembly-controls-slot'));
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, m, a] = await Promise.all([
        getDailyAssembly(date), loadAssemblyMachines(), loadAssemblyActivities()
      ]);
      setEntries(e);
      setMachines(m);
      setActivities(a);
    } catch (err) {
      console.error(err);
      alert('Napaka pri nalaganju: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [date]);

  const handleDelete = async (entry) => {
    if (!canEditEntry(entry.date)) {
      alert(`Vnos je starejši od ${EDIT_LOCK_DAYS} dni in je zaklenjen za brisanje.`);
      return;
    }
    if (!confirm(`Izbriši vnos za ${entry.assembly_workers?.name} (${formatDate(entry.date)})?`)) return;
    try {
      await deleteAssemblyEntry(entry.id);
      await reload();
    } catch (err) {
      alert('Napaka pri brisanju: ' + err.message);
    }
  };

  const mqKos = v => (v && typeof v === 'object') ? Number(v.kos || 0) : Number(v || 0);
  const mqNormativ = v => (v && typeof v === 'object') ? Number(v.normativ || 0) : 0;

  const totalAutomatKos = entries.reduce((sum, e) => {
    return sum + Object.values(e.machine_quantities || {}).reduce((s, v) => s + mqKos(v), 0);
  }, 0);
  const totalAutomatNormativ = entries.reduce((sum, e) => {
    return sum + Object.values(e.machine_quantities || {}).reduce((s, v) => s + mqNormativ(v), 0);
  }, 0);

  const totalManualKos = entries.reduce((sum, e) => {
    let s = 0;
    Object.entries(e.activity_data || {}).forEach(([code, val]) => {
      if (!MANUAL_COUNT_CODES.includes(code)) return;
      if (val && typeof val === 'object' && val.kos) s += Number(val.kos);
    });
    return sum + s;
  }, 0);
  const totalManualNormativ = entries.reduce((sum, e) => {
    let s = 0;
    Object.entries(e.activity_data || {}).forEach(([code, val]) => {
      if (!MANUAL_COUNT_CODES.includes(code)) return;
      if (val && typeof val === 'object' && val.normativ) s += Number(val.normativ);
    });
    return sum + s;
  }, 0);

  const totalHours = entries.reduce((s, e) => s + Number(e.total_hours || 0), 0);
  const totalRelevantNormativ = totalAutomatNormativ + totalManualNormativ;

  const byMachine = {};
  machines.forEach(m => byMachine[m.name] = 0);
  entries.forEach(e => {
    Object.entries(e.machine_quantities || {}).forEach(([machineName, qty]) => {
      byMachine[machineName] = (byMachine[machineName] || 0) + mqKos(qty);
    });
  });

  const byActivity = {};
  activities.forEach(a => byActivity[a.code] = 0);
  entries.forEach(e => {
    Object.entries(e.activity_data || {}).forEach(([code, val]) => {
      if (val && typeof val === 'object' && val.kos) {
        byActivity[code] = (byActivity[code] || 0) + Number(val.kos);
      }
    });
  });

  // Kontrole, ki gredo v portal (datum + Excel gumb)
  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white" />
        <span className="text-sm text-as-gray-500 hidden sm:inline">{formatDate(date)}</span>
      </div>
      <button
        onClick={() => exportToCSV(date, entries, machines, activities)}
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
          <span className="ml-2 text-as-gray-500">Nalagam...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="🤖" label="Avtomati skupaj" value={formatNumber(totalAutomatKos)} unit="kos"
              color="#0E7490" bgColor="#CFFAFE" />
            <StatCard icon="👐" label="Ročno skupaj" value={formatNumber(totalManualKos)} unit="kos"
              color="#7E22CE" bgColor="#E9D5FF" />
            <StatCard icon="⏱️" label="Skupne ure" value={totalHours.toFixed(1)} unit="h"
              color="#7C2D12" bgColor="#FED7AA" />
            <StatCard icon="🎯" label="Normativ" value={formatNumber(totalRelevantNormativ)} unit="kos"
              color="#065F46" bgColor="#A7F3D0" />
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🤖 Avtomati po strojih</h3>
            {Object.values(byMachine).every(v => v === 0) ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov za avtomate.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {machines.map(m => (
                  <div key={m.id} className="border border-as-gray-100 rounded-lg p-3">
                    <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{m.name}</div>
                    <div className="text-2xl font-bold text-as-gray-700 mt-1">
                      {formatNumber(byMachine[m.name] || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">👐 Ročna montaža po aktivnostih</h3>
            {Object.values(byActivity).every(v => v === 0) ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni ročnih vnosov.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activities.filter(a => a.unit !== 'opis').map(a => {
                  const isExcluded = !MANUAL_COUNT_CODES.includes(a.code);
                  return (
                    <div key={a.id} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">
                        {a.name}
                        {isExcluded && <span className="text-as-gray-400 ml-1 normal-case">(ni v skupaj)</span>}
                      </div>
                      <div className="text-2xl font-bold text-as-gray-700 mt-1">
                        {formatNumber(byActivity[a.code] || 0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">👷 Delavke</h3>
            {entries.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov za izbrani datum.</div>
            ) : (
              <div className="space-y-3">
                {entries.map(e => {
                  const automateSum = Object.values(e.machine_quantities || {}).reduce((s, v) => s + mqKos(v), 0);
                  const activitySummary = Object.entries(e.activity_data || {})
                    .map(([code, val]) => {
                      const act = activities.find(a => a.code === code);
                      if (!act) return null;
                      if (val && typeof val === 'object') {
                        const parts = [];
                        if (val.kos != null) parts.push(`${formatNumber(val.kos)} kos`);
                        if (val.cas != null) parts.push(`${val.cas} h`);
                        if (val.normativ != null) parts.push(`norm. ${formatNumber(val.normativ)}`);
                        return `${act.name}: ${parts.join(', ')}`;
                      }
                      return `${act.name}: ${val}`;
                    })
                    .filter(Boolean)
                    .join(' · ');
                  const editable = canEditEntry(e.date);
                  const breakdownText = formatBreakdowns(e.breakdowns);
                  return (
                    <div key={e.id} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-as-gray-700">{e.assembly_workers?.name}</span>
                          <span className="text-xs text-as-gray-400">{WORK_TYPE_LABELS[e.assembly_workers?.work_type]}</span>
                          {editable ? (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={() => onEditEntry && onEditEntry(e.date, e.worker_id)}
                                title="Uredi vnos"
                                className="p-1 text-as-gray-400 hover:text-as-red-600 hover:bg-as-red-50 rounded transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(e)}
                                title="Izbriši vnos"
                                className="p-1 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span title={`Zaklenjeno (starejše od ${EDIT_LOCK_DAYS} dni)`} className="ml-1 text-as-gray-300">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-as-gray-500">
                          {e.total_kos != null ? <span>📦 {formatNumber(e.total_kos)} kos </span> : automateSum > 0 && <span>🤖 {formatNumber(automateSum)} kos </span>}
                          {e.total_hours && <span>· ⏱️ {e.total_hours} h </span>}
                          {e.normativ && <span>· 🎯 {formatNumber(e.normativ)} norm.</span>}
                          {e.normativ > 0 && e.total_kos > 0 && <span>· 📈 {((e.total_kos / e.normativ) * 100).toFixed(0)}%</span>}
                        </div>
                      </div>
                      {Object.keys(e.machine_quantities || {}).length > 0 && (
                        <div className="text-xs text-as-gray-500 mb-1">
                          <strong>Avtomati:</strong> {Object.entries(e.machine_quantities).map(([k, v]) => {
                            if (v && typeof v === 'object') {
                              const parts = [];
                              if (v.kos != null) parts.push(`${formatNumber(v.kos)} kos`);
                              if (v.cas != null) parts.push(`${v.cas} h`);
                              if (v.normativ != null) parts.push(`norm. ${formatNumber(v.normativ)}`);
                              return `${k}: ${parts.join(', ')}`;
                            }
                            return `${k} ${formatNumber(v)}`;
                          }).join(' · ')}
                        </div>
                      )}
                      {activitySummary && (
                        <div className="text-xs text-as-gray-500 mb-1">
                          <strong>Ročna:</strong> {activitySummary}
                        </div>
                      )}
                      {breakdownText && (
                        <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">
                          🛑 {breakdownText}
                        </div>
                      )}
                      {e.notes && (
                        <div className="text-xs text-as-gray-500 italic mt-1">{e.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div>
        <span className="text-2xl font-bold text-as-gray-700">{value}</span>
        <span className="text-sm text-as-gray-400 ml-2">{unit}</span>
      </div>
    </div>
  );
}

function exportToCSV(date, entries, machines, activities) {
  const lines = [];
  lines.push(`Dnevno poročilo MONTAŽA - ${date}`);
  lines.push('');

  const machineCols = machines.map(m => m.name);
  const activityCols = activities.map(a => a.name);
  lines.push(['DELAVKA', ...machineCols, ...activityCols, 'NORMATIV', 'URE', 'ZASTOJ', 'VZROK', 'ČAS ZASTOJA', 'OPOMBE'].join(';'));

  entries.forEach(e => {
    const row = [e.assembly_workers?.name || ''];
    machines.forEach(m => {
      const val = e.machine_quantities?.[m.name];
      if (val && typeof val === 'object') {
        const parts = [];
        if (val.kos != null) parts.push(`${val.kos} kos`);
        if (val.cas != null) parts.push(`${val.cas}h`);
        if (val.normativ != null) parts.push(`norm.${val.normativ}`);
        row.push(parts.join(' / '));
      } else {
        row.push(val || '');
      }
    });
    activities.forEach(a => {
      const val = e.activity_data?.[a.code];
      if (val && typeof val === 'object') {
        const parts = [];
        if (val.kos != null) parts.push(`${val.kos} kos`);
        if (val.cas != null) parts.push(`${val.cas}h`);
        if (val.normativ != null) parts.push(`norm.${val.normativ}`);
        row.push(parts.join(' / '));
      } else {
        row.push(val || '');
      }
    });
    const b = (function() {
      const raw = e.breakdowns;
      if (!raw) return { zastoj: '', vzrok: '', cas: '' };
      if (typeof raw === 'string' && raw.trim().startsWith('{')) {
        try { const o = JSON.parse(raw); return { zastoj: o.zastoj || '', vzrok: o.vzrok || '', cas: o.cas || '' }; } catch {}
      }
      return { zastoj: String(raw), vzrok: '', cas: '' };
    })();
    row.push(e.normativ || '', e.total_hours || '', b.zastoj, b.vzrok, b.cas, e.notes || '');
    lines.push(row.join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `montaza-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
