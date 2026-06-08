import React, { useState } from 'react';
import { supabase } from '../supabase.js';
import { X, Loader2, ShieldCheck, Save } from 'lucide-react';

export const ACCESS_MODULES = [
  { key: 'proizvodnja-v2', label: 'Proizvodnja' },
  { key: 'assembly', label: 'Montaža' },
  { key: 'crm', label: 'CRM' },
  { key: 'komerciala', label: 'Komerciala' },
  { key: 'nabava', label: 'Nabava' },
  { key: 'prodaja', label: 'Prodaja' },
  { key: 'tehnolog', label: 'Tehnolog' },
  { key: 'kakovost', label: 'Kakovost' },
  { key: 'racunovodstvo', label: 'Računovodstvo' },
  { key: 'gradiva', label: 'Gradiva' },
];

export default function AccessSettings({ employees, adminEmails, initialAccess, onSaved, onClose }) {
  const buildInitial = () => {
    const m = {};
    employees.forEach(emp => {
      const granted = initialAccess[emp.email] || [];
      const row = {};
      ACCESS_MODULES.forEach(mod => { row[mod.key] = granted.includes(mod.key); });
      m[emp.email] = row;
    });
    return m;
  };
  const [matrix, setMatrix] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const isAdminEmail = (email) => adminEmails.includes(email);

  const toggle = (email, key) => {
    if (isAdminEmail(email)) return;
    setMatrix(prev => ({ ...prev, [email]: { ...prev[email], [key]: !prev[email][key] } }));
  };
  const toggleAllForUser = (email, value) => {
    if (isAdminEmail(email)) return;
    setMatrix(prev => {
      const row = {};
      ACCESS_MODULES.forEach(mod => { row[mod.key] = value; });
      return { ...prev, [email]: row };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');
    try {
      const rows = employees
        .filter(emp => !isAdminEmail(emp.email))
        .map(emp => ({
          email: emp.email,
          modules: ACCESS_MODULES.filter(mod => matrix[emp.email][mod.key]).map(mod => mod.key),
          updated_at: new Date().toISOString(),
        }));
      const { error } = await supabase.from('user_access').upsert(rows, { onConflict: 'email' });
      if (error) throw error;
      setSavedMsg('Shranjeno ✓');
      if (onSaved) onSaved();
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (e) {
      setSavedMsg('Napaka: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-as-gray-700 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: '#C8102E' }} />
            Nastavitve dostopov
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-auto">
          <p className="text-xs text-as-gray-500 mb-3">
            Pokljukaj, kateri modul vidi posamezni uporabnik. Admini (Aleš, Claudia, Sara) vedno vidijo vse. Naloge in Domov sta vidna vsem.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-white font-semibold text-as-gray-600">Uporabnik</th>
                  {ACCESS_MODULES.map(mod => (
                    <th key={mod.key} className="p-2 text-xs font-semibold text-as-gray-500 whitespace-nowrap">{mod.label}</th>
                  ))}
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const locked = isAdminEmail(emp.email);
                  const row = matrix[emp.email] || {};
                  return (
                    <tr key={emp.email} className="border-t border-as-gray-100">
                      <td className="p-2 sticky left-0 bg-white">
                        <div className="font-semibold text-as-gray-700">{emp.name}</div>
                        <div className="text-xs text-as-gray-400">{emp.department}{locked ? ' • admin' : ''}</div>
                      </td>
                      {ACCESS_MODULES.map(mod => (
                        <td key={mod.key} className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={locked ? true : !!row[mod.key]}
                            disabled={locked}
                            onChange={() => toggle(emp.email, mod.key)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: '#C8102E' }}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center whitespace-nowrap">
                        {!locked && (
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => toggleAllForUser(emp.email, true)} className="text-xs text-as-red-600 hover:underline">vse</button>
                            <span className="text-as-gray-300">/</span>
                            <button onClick={() => toggleAllForUser(emp.email, false)} className="text-xs text-as-gray-400 hover:underline">nič</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          {savedMsg && <span className="text-sm font-semibold text-as-gray-600">{savedMsg}</span>}
          <button onClick={onClose} className="px-4 py-2 text-as-gray-500 hover:bg-as-gray-100 rounded-lg text-sm font-semibold">Zapri</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-60" style={{ backgroundColor: '#C8102E' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Shrani
          </button>
        </div>
      </div>
    </div>
  );
}
