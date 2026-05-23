// AssemblyMonthlyReport.jsx — Mesečno poročilo montaže
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Loader2, Download, Edit2, Trash2, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getMonthlyAssembly, loadAssemblyMachines, loadAssemblyActivities, loadAssemblyWorkers, deleteAssemblyEntry,
  formatNumber, formatDate, SLOVENIAN_MONTHS, WORK_TYPE_LABELS, canEditEntry, EDIT_LOCK_DAYS
} from '../../lib/assemblyApi.js';

// Ročno skupaj: vij_pak + pakiranje + vrecke + titus (stiskanje + ostalo NE)
const MANUAL_COUNT_CODES = ['vij_pak', 'pakiranje', 'vrecke', 'titus'];

export default function AssemblyMonthlyReport({ onEditEntry }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkerId, setExpandedWorkerId] = useState(null);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('assembly-controls-slot'));
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const [e, m, a, w] = await Promise.all([
        getMonthlyAssembly(year, month),
        loadAssemblyMachines(),
        loadAssemblyActivities(),
        loadAssemblyWorkers(),
      ]);
      setEntries(e);
      setMachines(m);
      setActivities(a);
      setWorkers(w);
    } catch (err) {
      console.error(err);
      alert('Napaka pri nalaganju: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [year, month]);

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

  // Skupne vsote
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
    Object.entries(e.machine_quantities || {}).forEach(([n, q]) => {
      byMachine[n] = (byMachine[n] || 0) + mqKos(q);
    });
  });

  const byActivity = {};
  activities.filter(a => a.unit !== 'opis').forEach(a => byActivity[a.code] = 0);
  entries.forEach(e => {
    Object.entries(e.activity_data || {}).forEach(([code, val]) => {
      if (val && typeof val === 'object' && val.kos) {
        byActivity[code] = (byActivity[code] || 0) + Number(val.kos);
      }
    });
  });

  const byWorker = {};
  workers.forEach(w => {
    byWorker[w.id] = {
      worker: w,
      automatKos: 0,
      automatNormativ: 0,
      manualKos: 0,
      manualNormativ: 0,
      hours: 0,
      days: 0
    };
  });
  entries.forEach(e => {
    const wid = e.worker_id;
    if (!byWorker[wid]) return;
    Object.values(e.machine_quantities || {}).forEach(v => {
      byWorker[wid].automatKos += mqKos(v);
      byWorker[wid].automatNormativ += mqNormativ(v);
    });
    Object.entries(e.activity_data || {}).forEach(([code, val]) => {
      if (!MANUAL_COUNT_CODES.includes(code)) return;
      if (val && typeof val === 'object') {
        if (val.kos) byWorker[wid].manualKos += Number(val.kos);
        if (val.normativ) byWorker[wid].manualNormativ += Number(val.normativ);
      }
    });
    byWorker[wid].hours += Number(e.total_hours || 0);
    byWorker[wid].days += 1;
  });
  const workerRows = Object.values(byWorker).filter(r => r.days > 0);

  // Kontrole, ki gredo v portal (mesec/leto + Excel gumb)
  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white">
          {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button
        onClick={() => exportMonthlyToCSV(year, month, workerRows, byMachine, byActivity, activities)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> Izvoz v Excel
      </button>
    </>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Kontrole se prikažejo v glavni vrstici (poleg sub-tabov) */}
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
          <span className="ml-2 text-as-gray-500">Nalagam...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon="🤖" label="Avtomati skupaj" value={formatNumber(totalAutomatKos)} unit="kos"
              color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="👐" label="Ročno skupaj" value={formatNumber(totalManualKos)} unit="kos"
              color="#7E22CE" bgColor="#E9D5FF" />
            <BigStat icon="⏱️" label="Skupne ure" value={totalHours.toFixed(1)} unit="h"
              color="#7C2D12" bgColor="#FED7AA" />
            <BigStat icon="🎯" label="Normativ" value={formatNumber(totalRelevantNormativ)} unit="kos"
              color="#065F46" bgColor="#A7F3D0" />
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">👷 Po delavkah — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {workerRows.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Delavka</th>
                      <th className="text-left p-2">Tip</th>
                      <th className="text-right p-2">Dni</th>
                      <th className="text-right p-2">Avtomati (kos)</th>
                      <th className="text-right p-2">Ročno (kos)</th>
                      <th className="text-right p-2">Normativ</th>
                      <th className="text-right p-2">Doseganje</th>
                      <th className="text-right p-2">Ure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerRows.map(r => {
                      const totalKos = r.automatKos + r.manualKos;
                      const totalNormativ = r.automatNormativ + r.manualNormativ;
                      const pct = totalNormativ > 0 ? (totalKos / totalNormativ) * 100 : 0;
                      const color = pct >= 100 ? '#16A34A' : pct >= 75 ? '#0E7490' : pct >= 50 ? '#D97706' : '#DC2626';
                      const isExpanded = expandedWorkerId === r.worker.id;
                      const workerEntries = entries.filter(e => e.worker_id === r.worker.id).sort((a, b) => a.date.localeCompare(b.date));
                      return (
                        <React.Fragment key={r.worker.id}>
                          <tr
                            className="border-t border-as-gray-100 cursor-pointer hover:bg-as-gray-50"
                            onClick={() => setExpandedWorkerId(isExpanded ? null : r.worker.id)}
                          >
                            <td className="p-2 font-semibold">
                              <span className="inline-flex items-center gap-1">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-as-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-as-gray-400" />}
                                {r.worker.name}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-as-gray-500">{WORK_TYPE_LABELS[r.worker.work_type]}</td>
                            <td className="p-2 text-right">{r.days}</td>
                            <td className="p-2 text-right font-semibold">{formatNumber(r.automatKos)}</td>
                            <td className="p-2 text-right font-semibold">{formatNumber(r.manualKos)}</td>
                            <td className="p-2 text-right">{formatNumber(totalNormativ)}</td>
                            <td className="p-2 text-right font-bold" style={{ color: totalNormativ > 0 ? color : '#9CA3AF' }}>
                              {totalNormativ > 0 ? `${pct.toFixed(0)}%` : '—'}
                            </td>
                            <td className="p-2 text-right">{r.hours.toFixed(1)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-as-gray-50">
                              <td colSpan={8} className="p-3">
                                <div className="space-y-2">
                                  <div className="text-xs uppercase font-semibold text-as-gray-500 tracking-wider mb-2">Dnevni vnosi</div>
                                  {workerEntries.length === 0 ? (
                                    <div className="text-xs text-as-gray-400">Ni vnosov.</div>
                                  ) : (
                                    workerEntries.map(en => {
                                      const editable = canEditEntry(en.date);
                                      const enKos = Number(en.total_kos || 0);
                                      return (
                                        <div key={en.id} className="flex items-center justify-between bg-white border border-as-gray-200 rounded-lg px-3 py-2 text-sm">
                                          <div className="flex items-center gap-3">
                                            <span className="font-semibold text-as-gray-700 w-28">{formatDate(en.date)}</span>
                                            <span className="text-as-gray-500 text-xs">
                                              {enKos > 0 && <>📦 {formatNumber(enKos)} kos </>}
                                              {en.total_hours && <>· ⏱️ {en.total_hours} h </>}
                                              {en.normativ > 0 && <>· 🎯 {formatNumber(en.normativ)}</>}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {editable ? (
                                              <>
                                                <button
                                                  onClick={(ev) => { ev.stopPropagation(); onEditEntry && onEditEntry(en.date, en.worker_id); }}
                                                  title="Uredi vnos"
                                                  className="p-1.5 text-as-gray-400 hover:text-as-red-600 hover:bg-as-red-50 rounded transition"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={(ev) => { ev.stopPropagation(); handleDelete(en); }}
                                                  title="Izbriši vnos"
                                                  className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </>
                                            ) : (
                                              <span title={`Zaklenjeno (starejše od ${EDIT_LOCK_DAYS} dni)`} className="p-1.5 text-as-gray-300">
                                                <Lock className="w-4 h-4" />
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">🤖 Avtomati po strojih</h3>
            {Object.values(byMachine).every(v => v === 0) ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>
            ) : (
              <div className="space-y-2">
                {machines.map(m => {
                  const v = byMachine[m.name] || 0;
                  const max = Math.max(...Object.values(byMachine));
                  const pct = max > 0 ? (v / max) * 100 : 0;
                  return (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-3 text-as-gray-700">{m.name}</div>
                      <div className="col-span-7 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: '#0E7490' }} />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-as-gray-700">{formatNumber(v)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">👐 Ročna montaža po aktivnostih</h3>
            {Object.values(byActivity).every(v => v === 0) ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni ročnih vnosov.</div>
            ) : (
              <div className="space-y-2">
                {activities.filter(a => a.unit !== 'opis').map(a => {
                  const v = byActivity[a.code] || 0;
                  const max = Math.max(...Object.values(byActivity), 1);
                  const pct = max > 0 ? (v / max) * 100 : 0;
                  const isExcluded = !MANUAL_COUNT_CODES.includes(a.code);
                  return (
                    <div key={a.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-3 text-as-gray-700">
                        {a.name}
                        {isExcluded && <span className="text-xs text-as-gray-400 ml-1">(ni v skupaj)</span>}
                      </div>
                      <div className="col-span-7 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: isExcluded ? '#9CA3AF' : '#7E22CE' }} />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-as-gray-700">{formatNumber(v)}</div>
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

function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div>
        <span className="text-3xl font-bold text-as-gray-700">{value}</span>
        <span className="text-sm text-as-gray-400 ml-2">{unit}</span>
      </div>
    </div>
  );
}

function exportMonthlyToCSV(year, month, workerRows, byMachine, byActivity, activities) {
  const lines = [];
  lines.push(`Mesečno poročilo MONTAŽA - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PO DELAVKAH');
  lines.push('Delavka;Tip;Dni;Avtomati (kos);Ročno (kos);Normativ;Doseganje (%);Ure');
  workerRows.forEach(r => {
    const totalKos = r.automatKos + r.manualKos;
    const totalNormativ = r.automatNormativ + r.manualNormativ;
    const pct = totalNormativ > 0 ? ((totalKos / totalNormativ) * 100).toFixed(1) : '';
    lines.push([r.worker.name, WORK_TYPE_LABELS[r.worker.work_type], r.days, r.automatKos, r.manualKos, totalNormativ, pct, r.hours.toFixed(1)].join(';'));
  });
  lines.push('');

  lines.push('AVTOMATI PO STROJIH');
  lines.push('Stroj;Količina');
  Object.entries(byMachine).forEach(([n, v]) => {
    lines.push(`${n};${v}`);
  });
  lines.push('');

  lines.push('ROČNA MONTAŽA PO AKTIVNOSTIH');
  lines.push('Aktivnost;Količina');
  activities.filter(a => a.unit !== 'opis').forEach(a => {
    lines.push(`${a.name};${byActivity[a.code] || 0}`);
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `montaza-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
