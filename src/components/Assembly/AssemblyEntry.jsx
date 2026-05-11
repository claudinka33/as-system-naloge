// AssemblyEntry.jsx — Vnos za montažo (1 delavec = 1 dnevni vnos)
import React, { useState, useEffect } from 'react';
import { Calendar, User, CheckCircle2, Loader2, Save, AlertCircle } from 'lucide-react';
import {
  loadAssemblyWorkers, loadAssemblyMachines, loadAssemblyActivities,
  upsertAssemblyEntry, getAssemblyEntry, WORK_TYPE_LABELS
} from '../../lib/assemblyApi.js';

const AS_RED = '#C8102E';

export default function AssemblyEntry({ currentUser, initialDate, initialWorkerId, onConsumed }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(initialDate || today);
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId ? String(initialWorkerId) : '');
  const [loading, setLoading] = useState(true);

  // Form state
  const [machineQty, setMachineQty] = useState({});  // { "HORMEC": 5000, ... }
  const [activityData, setActivityData] = useState({});  // { "stiskanje": "2.5", "pakiranje": "1500", ... }
  const [normativ, setNormativ] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [breakdowns, setBreakdowns] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingId, setExistingId] = useState(null);

  // Ko spremenimo prikaz iz poročila (preusmeritev), uporabi tiste vrednosti
  useEffect(() => {
    if (initialDate) setDate(initialDate);
    if (initialWorkerId) setSelectedWorkerId(String(initialWorkerId));
    if ((initialDate || initialWorkerId) && onConsumed) onConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate, initialWorkerId]);

  // Load šifranti
  useEffect(() => {
    (async () => {
      try {
        const [w, m, a] = await Promise.all([
          loadAssemblyWorkers(), loadAssemblyMachines(), loadAssemblyActivities()
        ]);
        setWorkers(w);
        setMachines(m);
        setActivities(a);
      } catch (e) {
        console.error(e);
        alert('Napaka pri nalaganju šifrantov: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Ko izbereš delavca + datum, naloži obstoječi vnos (če obstaja)
  useEffect(() => {
    if (!selectedWorkerId || !date) return;
    (async () => {
      try {
        const entry = await getAssemblyEntry(date, Number(selectedWorkerId));
        if (entry) {
          setExistingId(entry.id);
          setMachineQty(entry.machine_quantities || {});
          setActivityData(entry.activity_data || {});
          setNormativ(entry.normativ || '');
          setTotalHours(entry.total_hours || '');
          setBreakdowns(entry.breakdowns || '');
          setNotes(entry.notes || '');
        } else {
          setExistingId(null);
          setMachineQty({});
          setActivityData({});
          setNormativ('');
          setTotalHours('');
          setBreakdowns('');
          setNotes('');
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [date, selectedWorkerId]);

  const selectedWorker = workers.find(w => w.id === Number(selectedWorkerId));

  const handleSubmit = async () => {
    if (!selectedWorkerId) {
      alert('Izberi delavko.');
      return;
    }
    setSaving(true);
    try {
      // Filter prazne vrednosti
      const cleanMachineQty = {};
      Object.entries(machineQty).forEach(([k, v]) => {
        // Nov format: { kos, cas, normativ }
        if (v && typeof v === 'object') {
          const obj = {};
          if (v.kos && Number(v.kos) > 0) obj.kos = Number(v.kos);
          if (v.cas && Number(v.cas) > 0) obj.cas = Number(v.cas);
          if (v.normativ && Number(v.normativ) > 0) obj.normativ = Number(v.normativ);
          if (Object.keys(obj).length > 0) cleanMachineQty[k] = obj;
        } else if (v && Number(v) > 0) {
          // Backward compat: star format (samo število)
          cleanMachineQty[k] = Number(v);
        }
      });
      const cleanActivityData = {};
      Object.entries(activityData).forEach(([k, v]) => {
        // Nov format: { kos, cas, normativ } za aktivnosti z enotami; string za 'opis'
        if (v && typeof v === 'object') {
          const obj = {};
          if (v.kos && String(v.kos).trim() !== '') obj.kos = Number(v.kos);
          if (v.cas && String(v.cas).trim() !== '') obj.cas = Number(v.cas);
          if (v.normativ && String(v.normativ).trim() !== '') obj.normativ = Number(v.normativ);
          if (Object.keys(obj).length > 0) cleanActivityData[k] = obj;
        } else if (v && String(v).trim() !== '') {
          cleanActivityData[k] = String(v).trim();
        }
      });

      await upsertAssemblyEntry({
        date,
        worker_id: Number(selectedWorkerId),
        machine_quantities: cleanMachineQty,
        activity_data: cleanActivityData,
        normativ: (() => {
          const sumA = Object.values(activityData).reduce((s, v) => {
            if (v && typeof v === 'object' && v.normativ) return s + Number(v.normativ);
            return s;
          }, 0);
          const sumM = Object.values(machineQty).reduce((s, v) => {
            if (v && typeof v === 'object' && v.normativ) return s + Number(v.normativ);
            return s;
          }, 0);
          const total = sumA + sumM;
          return total > 0 ? total : null;
        })(),
        total_kos: (() => {
          const sumA = Object.values(activityData).reduce((s, v) => {
            if (v && typeof v === 'object' && v.kos) return s + Number(v.kos);
            return s;
          }, 0);
          const sumM = Object.values(machineQty).reduce((s, v) => {
            if (v && typeof v === 'object' && v.kos) return s + Number(v.kos);
            return s;
          }, 0);
          const total = sumA + sumM;
          return total > 0 ? total : null;
        })(),
        total_hours: (() => {
          const sumActivity = Object.values(activityData).reduce((s, v) => {
            if (v && typeof v === 'object' && v.cas) return s + Number(v.cas);
            return s;
          }, 0);
          const sumMachines = Object.values(machineQty).reduce((s, v) => {
            if (v && typeof v === 'object' && v.cas) return s + Number(v.cas);
            return s;
          }, 0);
          const total = sumActivity + sumMachines;
          return total > 0 ? total : null;
        })(),
        breakdowns: breakdowns || null,
        notes: notes || null,
        entered_by_email: currentUser.email,
        entered_by_name: currentUser.name,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Napaka pri shranjevanju: ' + e.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
        <span className="ml-2 text-as-gray-500">Nalagam...</span>
      </div>
    );
  }

  // Ali delavec dela z avtomati / ročno / oboje
  const showAutomats = selectedWorker && (selectedWorker.work_type === 'avtomat' || selectedWorker.work_type === 'oba');
  const showManual = selectedWorker && (selectedWorker.work_type === 'rocna' || selectedWorker.work_type === 'oba');

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header: datum + delavec */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              Datum *
            </label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">
              <User className="inline w-4 h-4 mr-1" />
              Delavka *
            </label>
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
              <option value="">— Izberi —</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({WORK_TYPE_LABELS[w.work_type]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {existingId && (
          <div className="mt-3 flex items-center gap-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" />
            Vnos za ta dan že obstaja. Spremembe bodo zamenjale obstoječi vnos.
          </div>
        )}
      </div>

      {/* Če ni izbran delavec - end */}
      {!selectedWorker && (
        <div className="bg-white border-2 border-dashed border-as-gray-200 rounded-xl p-12 text-center">
          <User className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
          <p className="text-as-gray-500">Izberi delavko za začetek vnosa.</p>
        </div>
      )}

      {/* AVTOMATI - NAIDE stroji */}
      {showAutomats && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-as-gray-700 mb-3 flex items-center gap-2">
            🤖 Avtomati
          </h3>
          <div className="space-y-4">
            {machines.map(m => {
              // Backward-compat: če je star format (število), ga obravnavaj kot kos
              let cur = machineQty[m.name];
              if (typeof cur === 'number' || (typeof cur === 'string' && cur !== '')) {
                cur = { kos: cur };
              }
              cur = cur || {};
              const setField = (field, val) => {
                setMachineQty({
                  ...machineQty,
                  [m.name]: { ...cur, [field]: val }
                });
              };
              return (
                <div key={m.id} className="border border-as-gray-100 rounded-lg p-3 bg-as-gray-50">
                  <div className="font-semibold text-as-gray-700 mb-2">{m.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">KOS</label>
                      <input type="number" inputMode="numeric" placeholder="0"
                        value={cur.kos || ''}
                        onChange={e => setField('kos', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">ČAS (h)</label>
                      <input type="number" inputMode="decimal" step="0.25" placeholder="npr. 7.5"
                        value={cur.cas || ''}
                        onChange={e => setField('cas', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">NORMATIV</label>
                      <input type="number" inputMode="numeric" placeholder="npr. 4500"
                        value={cur.normativ || ''}
                        onChange={e => setField('normativ', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ROČNA */}
      {showManual && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-as-gray-700 mb-3 flex items-center gap-2">
            👐 Ročna montaža
          </h3>
          <div className="space-y-4">
            {activities.map(a => {
              // 'opis' aktivnost (npr. Ostalo) – samo 1 input
              if (a.unit === 'opis') {
                return (
                  <div key={a.id}>
                    <label className="block text-sm font-semibold text-as-gray-600 mb-1">
                      {a.name} <span className="text-as-gray-400 font-normal">(opis)</span>
                    </label>
                    <input type="text" placeholder="opis"
                      value={typeof activityData[a.code] === 'string' ? activityData[a.code] : ''}
                      onChange={e => setActivityData({ ...activityData, [a.code]: e.target.value })}
                      className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                  </div>
                );
              }
              // Ostale aktivnosti: 3 inputi KOS + ČAS + NORMATIV
              // Backward-compat: če je string (star format), ga obravnavaj kot kos ali cas glede na unit
              let cur = activityData[a.code];
              if (typeof cur === 'string') {
                cur = a.unit === 'h' ? { cas: cur } : { kos: cur };
              }
              cur = cur || {};
              const setField = (field, val) => {
                setActivityData({
                  ...activityData,
                  [a.code]: { ...cur, [field]: val }
                });
              };
              return (
                <div key={a.id} className="border border-as-gray-100 rounded-lg p-3 bg-as-gray-50">
                  <div className="font-semibold text-as-gray-700 mb-2">{a.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">KOS</label>
                      <input type="number" inputMode="numeric" placeholder="npr. 1500"
                        value={cur.kos || ''}
                        onChange={e => setField('kos', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">ČAS (h)</label>
                      <input type="number" inputMode="decimal" step="0.25" placeholder="npr. 2.5"
                        value={cur.cas || ''}
                        onChange={e => setField('cas', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                    <div>
                      <label className="block text-xs text-as-gray-500 mb-1">NORMATIV</label>
                      <input type="number" inputMode="numeric" placeholder="npr. 1350"
                        value={cur.normativ || ''}
                        onChange={e => setField('normativ', e.target.value)}
                        className="w-full px-2 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skupno: normativ, ure, zastoji, opombe */}
      {selectedWorker && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-as-gray-700 mb-3">📊 Povzetek dneva</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1">Skupaj KOS <span className="text-as-gray-400 font-normal text-xs">(avto)</span></label>
              <input type="text" readOnly
                value={(() => {
                  const sumA = Object.values(activityData).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.kos) return s + Number(v.kos);
                    return s;
                  }, 0);
                  const sumM = Object.values(machineQty).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.kos) return s + Number(v.kos);
                    return s;
                  }, 0);
                  const total = sumA + sumM;
                  return total > 0 ? total.toLocaleString('sl-SI') : '';
                })()}
                placeholder="se izračuna iz KOS polj"
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-as-gray-50 text-as-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1">Skupaj normativ <span className="text-as-gray-400 font-normal text-xs">(avto)</span></label>
              <input type="text" readOnly
                value={(() => {
                  const sumA = Object.values(activityData).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.normativ) return s + Number(v.normativ);
                    return s;
                  }, 0);
                  const sumM = Object.values(machineQty).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.normativ) return s + Number(v.normativ);
                    return s;
                  }, 0);
                  const total = sumA + sumM;
                  return total > 0 ? total.toLocaleString('sl-SI') : '';
                })()}
                placeholder="se izračuna iz NORMATIV polj"
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-as-gray-50 text-as-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1">Skupne ure <span className="text-as-gray-400 font-normal text-xs">(avto)</span></label>
              <input type="text" readOnly
                value={(() => {
                  const sumActivity = Object.values(activityData).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.cas) return s + Number(v.cas);
                    return s;
                  }, 0);
                  const sumMachines = Object.values(machineQty).reduce((s, v) => {
                    if (v && typeof v === 'object' && v.cas) return s + Number(v.cas);
                    return s;
                  }, 0);
                  const total = sumActivity + sumMachines;
                  return total > 0 ? total.toFixed(2) : '';
                })()}
                placeholder="se izračuna iz ČAS polj"
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-as-gray-50 text-as-gray-700" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">Zastoji + vzrok</label>
            <textarea rows={2} placeholder="npr. Zastoj NAIDE 12 - menjava orodja, 30 min"
              value={breakdowns} onChange={e => setBreakdowns(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">Opombe</label>
            <textarea rows={2} placeholder="Karkoli vredno omeniti..."
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
          </div>
        </div>
      )}

      {/* Submit */}
      {selectedWorker && (
        <button
          onClick={handleSubmit}
          disabled={saving || success}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-semibold transition shadow-md disabled:opacity-60"
          style={{ backgroundColor: success ? '#16A34A' : AS_RED }}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Shranjujem...</>
          ) : success ? (
            <><CheckCircle2 className="w-5 h-5" /> Shranjeno!</>
          ) : (
            <><Save className="w-4 h-4" /> {existingId ? 'Posodobi vnos' : 'Shrani vnos'}</>
          )}
        </button>
      )}
    </div>
  );
}
