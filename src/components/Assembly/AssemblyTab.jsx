// AssemblyTab.jsx — Glavni zavihek "Montaža" (struktura kot Proizvodnja)
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, BarChart3, Settings, Wrench } from 'lucide-react';
import MontazaWorkerEntry from './MontazaWorkerEntry.jsx';
import AssemblyWorkAnalysis from './AssemblyWorkAnalysis.jsx';
import AssemblyAdmin from './AssemblyAdmin.jsx';
import { ADMIN_EMAILS } from '../../constants.js';
import { supabase } from '../../supabase.js';

// Dostop: vsi admini (is_admin v bazi ali ADMIN_EMAILS) + Milena
const ASSEMBLY_USERS = [
  'milena.jancic@as-system.si',
];

export function canAccessAssembly(email, isAdmin = false) {
  return isAdmin === true || ADMIN_EMAILS.includes(email) || ASSEMBLY_USERS.includes(email);
}

export default function AssemblyTab({ currentUser }) {
  const [view, setView] = useState('vnos');

  // Legacy dostop (admini + Milena)
  const legacyAllowed = canAccessAssembly(currentUser?.email, currentUser?.is_admin);

  // Dostop iz UserAdmin (tabela module_access) — null = se še nalaga
  const [dbAllowed, setDbAllowed] = useState(legacyAllowed ? true : null);

  useEffect(() => {
    let cancelled = false;
    if (legacyAllowed) { setDbAllowed(true); return; }
    const email = currentUser?.email;
    if (!email) { setDbAllowed(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('module_access')
          .select('modules')
          .eq('user_email', email)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) { setDbAllowed(false); return; }
        setDbAllowed(Array.isArray(data.modules) && data.modules.includes('assembly'));
      } catch (e) {
        if (!cancelled) setDbAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.email, legacyAllowed]);

  if (dbAllowed === null) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center">
        <p className="text-sm text-as-gray-500">Preverjam dostop…</p>
      </div>
    );
  }

  if (dbAllowed !== true) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-bold text-as-gray-700 mb-2">Ni dostopa</h3>
        <p className="text-sm text-as-gray-500">
          Do modula Montaža imajo dostop administratorji in uporabniki z dodeljenim dovoljenjem.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
        <div className="flex flex-wrap gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
          <SubTab active={view === 'vnos'} onClick={() => setView('vnos')}
            icon={<Plus className="w-4 h-4" />} label="Vnos" />
          <SubTab active={view === 'day'} onClick={() => setView('day')}
            icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
          <SubTab active={view === 'month'} onClick={() => setView('month')}
            icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
          <SubTab active={view === 'admin'} onClick={() => setView('admin')}
            icon={<Settings className="w-4 h-4" />} label="Urejanje" />
        </div>
        <div id="assembly-controls-slot" className="flex flex-wrap items-center gap-3 ml-auto"></div>
      </div>

      {view === 'vnos' && <MontazaWorkerEntry currentUser={currentUser} />}
      {view === 'day' && <AssemblyWorkAnalysis lockMode="day" />}
      {view === 'month' && <AssemblyWorkAnalysis lockMode="month" />}
      {view === 'admin' && <AssemblyAdmin />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: '#C8102E' } : {}}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
