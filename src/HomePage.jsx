// =====================================
// HOME PAGE - Pristajalna stran aplikacije
// Prikaže se ob kliku na logo
// =====================================

import React, { useEffect, useState } from 'react';
import { 
  ClipboardList, CalendarCheck, BarChart3, Sparkles, X,
  CheckCircle2, AlertCircle, Calendar, TrendingUp, Users,
  Wallet, ArrowRight, Factory, Wrench
} from 'lucide-react';
import { supabase } from './supabase.js';
import { getTodayQuote } from './quotes.js';
import { canAccessProduction } from './components/Production/ProductionTab.jsx';
import { canAccessAssembly } from './components/Assembly/AssemblyTab.jsx';

// =====================================
// Pozdrav po času dneva
// =====================================
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Dobro jutro';
  if (hour < 12) return 'Dobro jutro';
  if (hour < 18) return 'Dober dan';
  return 'Dober večer';
}

// =====================================
// Misel dneva (večja, lepša verzija za home)
// =====================================
function HomeQuote() {
  const [quote] = useState(getTodayQuote());

  return (
    <div className="bg-gradient-to-br from-as-red-50 via-amber-50 to-rose-50 border border-as-red-100 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
      <div className="absolute -top-8 -right-8 text-9xl opacity-10 select-none">
        {quote.emoji}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-as-gray-500">
            Misel dneva
          </span>
        </div>
        <p className="text-lg md:text-xl text-as-gray-700 italic leading-relaxed font-medium mb-3">
          "{quote.text}"
        </p>
        {quote.author && (
          <p className="text-sm text-as-gray-500 font-semibold">
            — {quote.author}
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================
// Glavna komponenta HomePage
// =====================================
export default function HomePage({ currentUser, isAdmin, onNavigate }) {
  const [stats, setStats] = useState({
    myTasks: 0,
    myCompletedToday: 0,
    pendingTotal: 0,
    overdueMine: 0,
    dueToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  async function loadStats() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, status, due_date, assigned_to_emails, completed_at');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const myTasks = (tasks || []).filter(t => 
        (t.assigned_to_emails || []).includes(currentUser.email)
      );

      const myCompletedToday = myTasks.filter(t => {
        if (t.status !== 'completed' || !t.completed_at) return false;
        const c = new Date(t.completed_at);
        return c >= today && c < tomorrow;
      }).length;

      const pendingTotal = (tasks || []).filter(t => t.status !== 'completed').length;

      const overdueMine = myTasks.filter(t => {
        if (t.status === 'completed' || !t.due_date) return false;
        return new Date(t.due_date) < today;
      }).length;

      const dueToday = myTasks.filter(t => {
        if (t.status === 'completed' || !t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= today && d < tomorrow;
      }).length;

      setStats({
        myTasks: myTasks.filter(t => t.status !== 'completed').length,
        myCompletedToday,
        pendingTotal,
        overdueMine,
        dueToday,
      });
    } catch (e) {
      console.error('Error loading home stats:', e);
    } finally {
      setLoading(false);
    }
  }

  const greeting = getGreeting();
  const firstName = currentUser?.name?.split(' ')[0] || '';

  // Hitre kartice za navigacijo
  const navCards = [
    {
      key: 'tasks',
      title: 'Naloge',
      desc: 'Pregled, ustvarjanje in dodeljevanje nalog',
      icon: ClipboardList,
      color: '#C8102E',
      bgColor: '#FEE2E2',
    },
    {
      key: 'daily',
      title: 'Dnevna opravila',
      desc: 'Tedenski grid — vnos po dnevih za tvoj oddelek',
      icon: CalendarCheck,
      color: '#0E7490',
      bgColor: '#CFFAFE',
    },
    {
      key: 'reports',
      title: 'Tedenska poročila',
      desc: 'Pregled in oddaja tedenskih poročil',
      icon: BarChart3,
      color: '#7C2D12',
      bgColor: '#FED7AA',
    },
    {
      key: 'production',
      title: 'Proizvodnja',
      desc: 'Vnos in pregled dnevne ter mesečne proizvodnje',
      icon: Factory,
      color: '#1E40AF',
      bgColor: '#DBEAFE',
      access: (u) => canAccessProduction(u?.email),
    },
    {
      key: 'assembly',
      title: 'Montaža',
      desc: 'Vnos in pregled dela montaže',
      icon: Wrench,
      color: '#166534',
      bgColor: '#DCFCE7',
      access: (u) => canAccessAssembly(u?.email),
    },
    {
      key: 'racunovodstvo',
      title: 'Računovodstvo',
      desc: 'Stroški, plače, kompenzacije, opomini, intrastat',
      icon: Wallet,
      color: '#854D0E',
      bgColor: '#FEF3C7',
      adminOnly: true, // samo admin/Sara
    },
  ];

  // Filtriraj kartice glede na pravice
  // - adminOnly: vidi samo admin
  // - access(user): vidi, če funkcija vrne true
  // - sicer: vidijo vsi
  const visibleCards = navCards.filter(c => {
    if (c.adminOnly) return isAdmin;
    if (typeof c.access === 'function') return c.access(currentUser);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* POZDRAV */}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-as-gray-700">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="text-as-gray-500 mt-1">
              {new Date().toLocaleDateString('sl-SI', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
          {currentUser?.department && (
            <div className="bg-as-gray-100 px-4 py-2 rounded-lg">
              <div className="text-xs text-as-gray-500 font-medium uppercase tracking-wider">Oddelek</div>
              <div className="text-sm font-bold text-as-gray-700">{currentUser.department}</div>
            </div>
          )}
        </div>
      </div>

      {/* MISEL DNEVA */}
      <HomeQuote />

      {/* HITRI PREGLED - statistike */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-as-gray-500 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Hitri pregled
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('tasks', { filter: 'mine' })}
            className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-md hover:border-as-red-300 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <ClipboardList className="w-5 h-5 text-as-red-500" />
              <ArrowRight className="w-4 h-4 text-as-gray-300 group-hover:text-as-red-500 transition" />
            </div>
            <div className="text-3xl font-bold" style={{color: '#C8102E'}}>
              {loading ? '–' : stats.myTasks}
            </div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">
              Moje aktivne naloge
            </div>
          </button>

          <button
            onClick={() => onNavigate('tasks', { filter: 'mine' })}
            className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-md hover:border-amber-300 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <ArrowRight className="w-4 h-4 text-as-gray-300 group-hover:text-amber-500 transition" />
            </div>
            <div className="text-3xl font-bold text-amber-600">
              {loading ? '–' : stats.dueToday}
            </div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">
              Zapadejo danes
            </div>
          </button>

          <button
            onClick={() => onNavigate('tasks', { filter: 'mine' })}
            className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-md hover:border-red-400 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <ArrowRight className="w-4 h-4 text-as-gray-300 group-hover:text-red-500 transition" />
            </div>
            <div className="text-3xl font-bold text-red-600">
              {loading ? '–' : stats.overdueMine}
            </div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">
              Zamujene
            </div>
          </button>

          <button
            onClick={() => onNavigate('tasks', { filter: 'completed' })}
            className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-md hover:border-emerald-300 transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <ArrowRight className="w-4 h-4 text-as-gray-300 group-hover:text-emerald-500 transition" />
            </div>
            <div className="text-3xl font-bold text-emerald-600">
              {loading ? '–' : stats.myCompletedToday}
            </div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">
              Zaključene danes
            </div>
          </button>
        </div>
      </div>

      {/* GLAVNE SEKCIJE - kartice */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-as-gray-500 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Kaj želiš narediti?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => onNavigate(card.key)}
                className="bg-white border border-as-gray-200 rounded-xl p-5 text-left hover:shadow-lg hover:border-as-gray-300 transition group flex items-start gap-4"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{backgroundColor: card.bgColor}}
                >
                  <Icon className="w-6 h-6" style={{color: card.color}} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-lg font-bold text-as-gray-700">{card.title}</h3>
                    <ArrowRight className="w-5 h-5 text-as-gray-300 group-hover:text-as-gray-600 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-sm text-as-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AS SYSTEM INFO */}
      <div className="bg-gradient-to-br from-as-gray-50 to-white border border-as-gray-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-as-gray-500">
          <span className="font-bold text-as-gray-700">AS system d.o.o.</span> · Interno orodje · 
          <span className="ml-2">{new Date().getFullYear() - 1993} let tradicije</span>
        </p>
      </div>
    </div>
  );
}
