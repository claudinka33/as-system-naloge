// AssemblyEntry.jsx — Vnos za montažo (1 delavec = 1 dnevni vnos)
import React, { useState, useEffect } from 'react';
import { Calendar, User, CheckCircle2, Loader2, Save, AlertCircle } from 'lucide-react';
import {
  loadAssemblyWorkers, loadAssemblyMachines, loadAssemblyActivities,
  upsertAssemblyEntry, getAssemblyEntry, WORK_TYPE_LABELS
} from '../../lib/assemblyApi.js';

const AS_RED = '#C8102E';

export default function AssemblyEntry({ currentUser }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
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
        if (v && Number(v) > 0) cleanMachineQty[k] = Number(v);
      });
      const cleanActivityData = {};
      Object.entries(activityData).forEach(([k, v]) => {
        if (v && String(v).trim() !== '') cleanActivityData[k] = String(v).trim();
      });

      await upsertAssemblyEntry({
        date,
        worker_id: Number(selectedWorkerId),
        machine_quantities: cleanMachineQty,
        activity_data: cleanActivityData,
        normativ: normativ ? Number(normativ) : null,
        total_hours: totalHours ? Number(totalHours) : null,
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
            🤖 Avtomati (kosov na stroj)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {machines.map(m => (
              <div key={m.id}>
                <label className="block text-sm font-semibold text-as-gray-600 mb-1">{m.name}</label>
                <input type="number" inputMode="numeric" placeholder="0"
                  value={machineQty[m.name] || ''}
                  onChange={e => setMachineQty({ ...machineQty, [m.name]: e.target.value })}
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROČNA */}
      {showManual && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-as-gray-700 mb-3 flex items-center gap-2">
            👐 Ročna montaža
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activities.map(a => (
              <div key={a.id}>
                <label className="block text-sm font-semibold text-as-gray-600 mb-1">
                  {a.name} <span className="text-as-gray-400 font-normal">({a.unit})</span>
                </label>
                <input type="text" inputMode="decimal" placeholder={a.unit === 'h' ? 'npr. 2.5' : a.unit === 'kos' ? 'npr. 1500' : 'opis'}
                  value={activityData[a.code] || ''}
                  onChange={e => setActivityData({ ...activityData, [a.code]: e.target.value })}
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skupno: normativ, ure, zastoji, opombe */}
      {selectedWorker && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-as-gray-700 mb-3">📊 Povzetek dneva</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1">Normativ (kos)</label>
              <input type="number" inputMode="numeric" placeholder="npr. 1350"
                value={normativ} onChange={e => setNormativ(e.target.value)}
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1">Skupne ure</label>
              <input type="number" step="0.25" placeholder="npr. 7.5"
                value={totalHours} onChange={e => setTotalHours(e.target.value)}
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
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
