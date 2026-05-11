// ProductionTab.jsx — Glavni zavihek "Proizvodnja" z 3 podzavihki
import React, { useState } from 'react';
import { Plus, Calendar, BarChart3 } from 'lucide-react';
import EntryForm from './EntryForm.jsx';
import DailyReport from './DailyReport.jsx';
import MonthlyReport from './MonthlyReport.jsx';

// Dovoljeni emaili (mora se ujemati z Supabase RLS funkcijo)
const PRODUCTION_USERS = [
  'boris.cernelc@as-system.si',
  'gregor.koritnik@as-system.si',
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
];

export function canAccessProduction(email) {
  return PRODUCTION_USERS.includes(email);
}

export default function ProductionTab({ currentUser }) {
  const [view, setView] = useState('entry'); // 'entry' | 'daily' | 'monthly'

  if (!canAccessProduction(currentUser?.email)) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-bold text-as-gray-700 mb-2">Ni dostopa</h3>
        <p className="text-sm text-as-gray-500">
          Do modula Proizvodnja imajo dostop samo:<br />
          Boris Černelč, Gregor Koritnik, Aleš Seidl, Claudia Seidl, Sara Jagodič.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Podzavihki */}
      <div className="flex gap-1 mb-6 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 max-w-md">
        <SubTab
          active={view === 'entry'}
          onClick={() => setView('entry')}
          icon={<Plus className="w-4 h-4" />}
          label="Vnos"
        />
        <SubTab
          active={view === 'daily'}
          onClick={() => setView('daily')}
          icon={<Calendar className="w-4 h-4" />}
          label="Dnevno"
        />
        <SubTab
          active={view === 'monthly'}
          onClick={() => setView('monthly')}
          icon={<BarChart3 className="w-4 h-4" />}
          label="Mesečno"
        />
      </div>

      {view === 'entry' && <EntryForm currentUser={currentUser} />}
      {view === 'daily' && <DailyReport />}
      {view === 'monthly' && <MonthlyReport />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: '#C8102E' } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
