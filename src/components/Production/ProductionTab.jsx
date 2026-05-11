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
  'sara.jagodic@as-system.si'
];

export function canAccessProduction(currentUser) {
  if (!currentUser) return false;
  return PRODUCTION_USERS.includes(currentUser.email);
}

export default function ProductionTab({ currentUser }) {
  const [activeTab, setActiveTab] = useState('entry');

  const tabs = [
    { id: 'entry',   label: 'Vnos',             icon: Plus },
    { id: 'daily',   label: 'Dnevno poročilo',  icon: Calendar },
    { id: 'monthly', label: 'Mesečno poročilo', icon: BarChart3 }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* TAB NAVIGATION */}
      <div className="flex gap-1 sm:gap-2 mb-6 border-b border-as-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
                active
                  ? 'border-cyan-700 text-cyan-700'
                  : 'border-transparent text-as-gray-500 hover:text-as-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'entry'   && <EntryForm currentUser={currentUser} />}
      {activeTab === 'daily'   && <DailyReport currentUser={currentUser} />}
      {activeTab === 'monthly' && <MonthlyReport currentUser={currentUser} />}
    </div>
  );
}
