// =====================================
// HOME PAGE - Pristajalna stran aplikacije
// Prikaže se ob kliku na logo
// =====================================

import React, { useEffect, useState } from 'react';
import { 
  ClipboardList, CalendarCheck, BarChart3, Sparkles, X,
  CheckCircle2, AlertCircle, Calendar, TrendingUp, Users,
  Wallet, ArrowRight, Factory, Wrench,
  ShoppingCart, Cog, Phone, ShieldCheck, TrendingUp as TrendingUpIcon
} from 'lucide-react';

// === dostopni e-maili (drzano sinhrono z App.jsx) ===
const ODDELEK_ALLOWED = {
  nabava: ['alen.drofenik@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'],
  prodaja: ['tjasa.mihevc@as-system.si', 'zan.seidl@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'],
  tehnolog: ['gregor.koritnik@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'],
  komerciala: ['mitja.marguc@as-system.si', 'zan.seidl@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'],
  kakovost: ['kakovost@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'],
};
import { supabase } from './supabase.js';
import { getTodayQuote } from './quotes.js';
import { canAccessProduction } from './components/Production/ProductionTab.jsx';
import { canAccessAssembly } from './components/Assembly/AssemblyTab.jsx';
import MonthlyDepartmentAnalysis from './components/MonthlyDepartmentAnalysis.jsx';

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
      desc: 'Mesečni pregled nalog: dodeljene, opravljene, zamujene',
      icon: ClipboardList,
      color: '#C8102E',
      bgColor: '#FEE2E2',
    },
    {
      key: 'reports',
      title: 'Tedenska poročila',
      desc: 'Mesečni pregled oddanih tedenskih poročil',
      icon: BarChart3,
      color: '#7C2D12',
      bgColor: '#FED7AA',
    },
    {
      key: 'production',
      title: 'Proizvodnja',
      desc: 'Mesečno poročilo: proizvedeno, zastoji, odpadki, plan',
      icon: Factory,
      color: '#1E40AF',
      bgColor: '#DBEAFE',
      access: (u) => canAccessProduction(u?.email),
    },
    {
      key: 'assembly',
      title: 'Montaža',
      desc: 'Mesečno poročilo montaže za izbrani mesec',
      icon: Wrench,
      color: '#166534',
      bgColor: '#DCFCE7',
      access: (u) => canAccessAssembly(u?.email),
    },
    {
      key: 'racunovodstvo',
      title: 'Računovodstvo',
      desc: 'Mesečni pregled stroškov, plač, kompenzacij, opominov',
      icon: Wallet,
      color: '#854D0E',
      bgColor: '#FEF3C7',
      adminOnly: true, // samo admin/Sara
    },
    {
      key: 'nabava',
      title: 'Nabava',
      desc: 'Mesečno poročilo naročil, dobaviteljev in zalog',
      icon: ShoppingCart,
      color: '#854D0E',
      bgColor: '#FEF3C7',
      access: (u) => ODDELEK_ALLOWED.nabava.includes(u?.email),
    },
    {
      key: 'prodaja',
      title: 'Prodaja',
      desc: 'Mesečno poročilo ponudb, naročil in kupcev',
      icon: TrendingUpIcon,
      color: '#065F46',
      bgColor: '#A7F3D0',
      access: (u) => ODDELEK_ALLOWED.prodaja.includes(u?.email),
    },
    {
      key: 'tehnolog',
      title: 'Tehnolog',
      desc: 'Mesečni pregled risb, postopkov, meritev in orodij',
      icon: Cog,
      color: '#1E40AF',
      bgColor: '#DBEAFE',
      access: (u) => ODDELEK_ALLOWED.tehnolog.includes(u?.email),
    },
    {
      key: 'komerciala',
      title: 'Komerciala',
      desc: 'Mesečno poročilo kontaktov, pogajanj in obiskov',
      icon: Phone,
      color: '#5B21B6',
      bgColor: '#DDD6FE',
      access: (u) => ODDELEK_ALLOWED.komerciala.includes(u?.email),
    },
    {
      key: 'kakovost',
      title: 'Kakovost',
      desc: 'Mesečno poročilo vhodne, procesne in končne kontrole',
      icon: ShieldCheck,
      color: '#9F1239',
      bgColor: '#FFE4E6',
      access: (u) => ODDELEK_ALLOWED.kakovost.includes(u?.email),
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
      {/* HERO - pozdrav + misel dneva + oddelek (3 stolpci) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Levo: pozdrav + datum */}
        <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
          <h1 className="text-xl md:text-2xl font-bold text-as-gray-700">
            {greeting}, {firstName}! 👋
          </h1>
          <p className="text-sm text-as-gray-500 mt-1">
            {new Date().toLocaleDateString('sl-SI', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </p>
          {currentUser?.department && (
            <div className="mt-3 inline-flex items-center gap-2">
              <span className="text-[10px] text-as-gray-400 font-semibold uppercase tracking-wider">Oddelek:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-700">{currentUser.department}</span>
            </div>
          )}
        </div>

        {/* Sredina + desno: misel dneva (2 col span) */}
        <div className="lg:col-span-2">
          <HomeQuote />
        </div>
      </div>

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

      {/* MESEČNA ANALIZA - grafi in KPI iz vnosov */}
      <MonthlyDepartmentAnalysis currentUser={currentUser} />

      {/* GLAVNE SEKCIJE - mesečna poročila po področjih */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-as-gray-500 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Mesečna poročila po področjih
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleCards.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => onNavigate(card.key)}
                className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-lg transition group relative overflow-hidden"
                style={{borderLeft: `4px solid ${card.color}`}}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{backgroundColor: card.bgColor}}
                  >
                    <Icon className="w-5 h-5" style={{color: card.color}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{color: card.color}}>
                      Mesečno poročilo
                    </div>
                    <h3 className="text-base font-bold text-as-gray-700 leading-tight">{card.title}</h3>
                  </div>
                </div>
                <p className="text-xs text-as-gray-500 leading-relaxed mb-3">{card.desc}</p>
                <div className="flex items-center gap-1 text-xs font-bold pt-2 border-t border-as-gray-100" style={{color: card.color}}>
                  Odpri poročilo
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
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
