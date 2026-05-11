// AssemblyMonthlyReport.jsx — Mesečno poročilo montaže
import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, Download } from 'lucide-react';
import {
  getMonthlyAssembly, loadAssemblyMachines, loadAssemblyActivities, loadAssemblyWorkers,
  formatNumber, SLOVENIAN_MONTHS, WORK_TYPE_LABELS
} from '../../lib/assemblyApi.js';

export default function AssemblyMonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
    })();
  }, [year, month]);

  // Helper: iz vrednosti machine_quantities[name] vrne število kosov (kompat. star/nov format)
  const mqKos = v => (v && typeof v === 'object') ? Number(v.kos || 0) : Number(v || 0);

  // Skupne vsote
  const totalAutomatKos = entries.reduce((sum, e) => {
    return sum + Object.values(e.machine_quantities || {}).reduce((s, v) => s + mqKos(v), 0);
  }, 0);
  const totalHours = entries.reduce((s, e) => s + Number(e.total_hours || 0), 0);
  const totalNormativ = entries.reduce((s, e) => s + Number(e.normativ || 0), 0);

  // Po stroju
  const byMachine = {};
  machines.forEach(m => byMachine[m.name] = 0);
  entries.forEach(e => {
    Object.entries(e.machine_quantities || {}).forEach(([n, q]) => {
      byMachine[n] = (byMachine[n] || 0) + mqKos(q);
    });
  });

  // Po delavki: skupna proizvodnja + ure + doseganje
  const byWorker = {};
  workers.forEach(w => {
    byWorker[w.id] = {
      worker: w,
      automatKos: 0,
      hours: 0,
      normativ: 0,
      days: 0
    };
  });
  entries.forEach(e => {
    const wid = e.worker_id;
    if (!byWorker[wid]) return;
    byWorker[wid].automatKos += Object.values(e.machine_quantities || {}).reduce((s, v) => s + mqKos(v), 0);
    byWorker[wid].hours += Number(e.total_hours || 0);
    byWorker[wid].normativ += Number(e.normativ || 0);
    byWorker[wid].days += 1;
  });
  const workerRows = Object.values(byWorker).filter(r => r.days > 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Izbira meseca */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-as-gray-400" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-as-gray-200 rounded-lg">
            {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-as-gray-200 rounded-lg">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => exportMonthlyToCSV(year, month, workerRows, byMachine)}
          className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
        >
          <Download className="w-4 h-4" /> Izvoz v Excel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
          <span className="ml-2 text-as-gray-500">Nalagam...</span>
        </div>
      ) : (
        <>
          {/* Skupne stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BigStat icon="🤖" label="Avtomati skupaj" value={formatNumber(totalAutomatKos)} unit="kos"
              color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="⏱️" label="Skupne ure" value={totalHours.toFixed(1)} unit="h"
              color="#7C2D12" bgColor="#FED7AA" />
            <BigStat icon="🎯" label="Normativ" value={formatNumber(totalNormativ)} unit="kos"
              color="#065F46" bgColor="#A7F3D0" />
          </div>

          {/* Po delavkah */}
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
                      <th className="text-right p-2">Normativ</th>
                      <th className="text-right p-2">Doseganje</th>
                      <th className="text-right p-2">Ure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerRows.map(r => {
                      const pct = r.normativ > 0 ? (r.automatKos / r.normativ) * 100 : 0;
                      const color = pct >= 100 ? '#16A34A' : pct >= 75 ? '#0E7490' : pct >= 50 ? '#D97706' : '#DC2626';
                      return (
                        <tr key={r.worker.id} className="border-t border-as-gray-100">
                          <td className="p-2 font-semibold">{r.worker.name}</td>
                          <td className="p-2 text-xs text-as-gray-500">{WORK_TYPE_LABELS[r.worker.work_type]}</td>
                          <td className="p-2 text-right">{r.days}</td>
                          <td className="p-2 text-right font-semibold">{formatNumber(r.automatKos)}</td>
                          <td className="p-2 text-right">{formatNumber(r.normativ)}</td>
                          <td className="p-2 text-right font-bold" style={{ color: r.normativ > 0 ? color : '#9CA3AF' }}>
                            {r.normativ > 0 ? `${pct.toFixed(0)}%` : '—'}
                          </td>
                          <td className="p-2 text-right">{r.hours.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Po strojih (avtomati) */}
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

function exportMonthlyToCSV(year, month, workerRows, byMachine) {
  const lines = [];
  lines.push(`Mesečno poročilo MONTAŽA - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PO DELAVKAH');
  lines.push('Delavka;Tip;Dni;Avtomati (kos);Normativ;Doseganje (%);Ure');
  workerRows.forEach(r => {
    const pct = r.normativ > 0 ? ((r.automatKos / r.normativ) * 100).toFixed(1) : '';
    lines.push([r.worker.name, WORK_TYPE_LABELS[r.worker.work_type], r.days, r.automatKos, r.normativ, pct, r.hours.toFixed(1)].join(';'));
  });
  lines.push('');

  lines.push('AVTOMATI PO STROJIH');
  lines.push('Stroj;Količina');
  Object.entries(byMachine).forEach(([n, v]) => {
    lines.push(`${n};${v}`);
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
