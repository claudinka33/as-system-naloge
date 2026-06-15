// AssemblyTab.jsx — Glavni zavihek "Montaža"
import React, { useState } from 'react';
import { Plus, Calendar, BarChart3, ClipboardList, Settings, Archive } from 'lucide-react';
import AssemblyEntry from './AssemblyEntry.jsx';
import AssemblyDailyReport from './AssemblyDailyReport.jsx';
import AssemblyMonthlyReport from './AssemblyMonthlyReport.jsx';
import AssemblyWorkAnalysis from './AssemblyWorkAnalysis.jsx';
import AssemblyAdmin from './AssemblyAdmin.jsx';

// Dovoljeni emaili: Milena + admini (Aleš, Claudia, Sara)
const ASSEMBLY_USERS = [
  'milena.jancic@as-system.si',
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
];

export function canAccessAssembly(email) {
  return ASSEMBLY_USERS.includes(email);
}

export default function AssemblyTab({ currentUser }) {
  const [view, setView] = useState('work');
  const [initialDate, setInitialDate] = useState(null);
  const [initialWorkerId, setInitialWorkerId] = useState(null);
  const [legacyView, setLegacyView] = useState('daily');

  const handleEditEntry = (date, workerId) => {
    setInitialDate(date);
    setInitialWorkerId(workerId);
    setView('legacy'); setLegacyView('entry');
  };

  if (!canAccessAssembly(currentUser?.email)) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-bold text-as-gray-700 mb-2">Ni dostopa</h3>
        <p className="text-sm text-as-gray-500">
          Do modula Montaža imajo dostop samo:<br />
          Milena Jančič, Aleš Seidl, Claudia Seidl, Sara Jagodič.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Glavna vrstica: tabe levo, kontrole (mesec/dan + Excel) desno preko portala */}
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
        <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
          <SubTab active={view === 'work'} onClick={() => setView('work')}
            icon={<ClipboardList className="w-4 h-4" />} label="Nalogi" />
          <SubTab active={view === 'legacy'} onClick={() => setView('legacy')}
            icon={<Archive className="w-4 h-4" />} label="Stara analiza" />
          <SubTab active={view === 'admin'} onClick={() => setView('admin')}
            icon={<Settings className="w-4 h-4" />} label="Urejanje" />
        </div>
        {/* Portal slot za kontrole iz otroških komponent */}
        <div id="assembly-controls-slot" className="flex flex-wrap items-center gap-3 ml-auto"></div>
      </div>

      {view === 'work' && <AssemblyWorkAnalysis />}
      {view === 'admin' && <AssemblyAdmin />}
      {view === 'legacy' && (
        <div>
          <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 mb-4 w-fit">
            <SubTab active={legacyView === 'entry'} onClick={() => setLegacyView('entry')}
              icon={<Plus className="w-4 h-4" />} label="Vnos" />
            <SubTab active={legacyView === 'daily'} onClick={() => setLegacyView('daily')}
              icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
            <SubTab active={legacyView === 'monthly'} onClick={() => setLegacyView('monthly')}
              icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
          </div>
          {legacyView === 'entry' && <AssemblyEntry currentUser={currentUser} initialDate={initialDate} initialWorkerId={initialWorkerId} onConsumed={() => { setInitialDate(null); setInitialWorkerId(null); }} />}
          {legacyView === 'daily' && <AssemblyDailyReport onEditEntry={handleEditEntry} />}
          {legacyView === 'monthly' && <AssemblyMonthlyReport onEditEntry={handleEditEntry} />}
        </div>
      )}
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
