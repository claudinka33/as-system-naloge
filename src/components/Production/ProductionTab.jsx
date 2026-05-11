import React, { useState, useEffect } from 'react';
import { Factory, Plus, Trash2, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

const PRODUCT_TYPES = [
  { key: 'vijaki',   label: 'Vijaki' },
  { key: 'pini',     label: 'PINI' },
  { key: 'sidra',    label: 'Sidra' },
  { key: 'struzena', label: 'Stružena sidra' },
  { key: 'ostalo',   label: 'Ostalo' }
];

export function canAccessProduction(currentUser) {
  if (!currentUser) return false;
  const ADMIN_EMAILS = ['ales.seidl@as-system.si', 'claudia.seidl@as-system.si', 'sara.jagodic@as-system.si'];
  const PROD_EMAILS = ['boris.cernelc@as-system.si'];
  return ADMIN_EMAILS.includes(currentUser.email) || PROD_EMAILS.includes(currentUser.email);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDateSL(iso) {
  const d = new Date(iso);
  const days = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];
  return `${days[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export default function ProductionTab({ currentUser }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [form, setForm] = useState({
    product_type: 'vijaki',
    quantity: '',
    normativ: '',
    time_hours: '',
    description: ''
  });

  const isAdmin = ['ales.seidl@as-system.si', 'claudia.seidl@as-system.si', 'sara.jagodic@as-system.si'].includes(currentUser.email);

  useEffect(() => {
    loadEntries();
    const channel = supabase
      .channel('production-log-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_log' }, () => loadEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('production_log')
        .select('*')
        .eq('entry_date', selectedDate)
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
        query = query.eq('employee_email', currentUser.email);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      console.error('Napaka pri nalaganju:', e);
    }
    setLoading(false);
  };

  const addEntry = async () => {
    if (!form.quantity || parseFloat(form.quantity) <= 0) {
      alert('Vnesi količino (KOS).');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('production_log').insert({
        entry_date: selectedDate,
        employee_email: currentUser.email,
        employee_name: currentUser.name,
        product_type: form.product_type,
        quantity: parseFloat(form.quantity) || 0,
        normativ: parseFloat(form.normativ) || 0,
        time_hours: parseFloat(form.time_hours) || 0,
        description: form.description.trim() || null
      });
      if (error) throw error;
      setForm({ product_type: 'vijaki', quantity: '', normativ: '', time_hours: '', description: '' });
      loadEntries();
    } catch (e) {
      console.error('Napaka:', e);
      alert(`Napaka: ${e.message}`);
    }
    setSaving(false);
  };

  const deleteEntry = async (id) => {
    if (!confirm('Izbrišem vnos?')) return;
    try {
      const { error } = await supabase.from('production_log').delete().eq('id', id);
      if (error) throw error;
      loadEntries();
    } catch (e) {
      alert(`Napaka: ${e.message}`);
    }
  };

  const navigateDate = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Povzetek dneva
  const summary = entries.reduce((acc, e) => {
    acc.totalQty += parseFloat(e.quantity) || 0;
    acc.totalTime += parseFloat(e.time_hours) || 0;
    acc.totalNormativ += (parseFloat(e.normativ) || 0) * (parseFloat(e.time_hours) || 0);
    return acc;
  }, { totalQty: 0, totalTime: 0, totalNormativ: 0 });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center">
          <Factory className="w-6 h-6 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-as-gray-700">Proizvodnja</h1>
          <p className="text-sm text-as-gray-500">Dnevni vnos proizvodnje — avto se prelije v dnevno opravilo</p>
        </div>
      </div>

      {/* DATUM NAVIGATOR */}
      <div className="bg-white rounded-2xl border border-as-gray-200 p-4 mb-4 flex items-center justify-between">
        <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-as-gray-100 rounded-lg">
          <ChevronLeft className="w-5 h-5 text-as-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-700" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="font-semibold text-as-gray-700 bg-transparent border-none focus:outline-none cursor-pointer"
          />
          <span className="text-sm text-as-gray-500 hidden sm:inline">• {formatDateSL(selectedDate)}</span>
        </div>
        <button onClick={() => navigateDate(1)} className="p-2 hover:bg-as-gray-100 rounded-lg">
          <ChevronRight className="w-5 h-5 text-as-gray-600" />
        </button>
      </div>

      {/* FORM ZA NOV VNOS */}
      <div className="bg-white rounded-2xl border border-as-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-as-gray-700 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-cyan-700" /> Nov vnos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 mb-1">Vrsta</label>
            <select
              value={form.product_type}
              onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              {PRODUCT_TYPES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 mb-1">Količina (KOS) *</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 mb-1">Normativ (KOS/uro)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.normativ}
              onChange={(e) => setForm({ ...form, normativ: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 mb-1">Čas (ure)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.time_hours}
              onChange={(e) => setForm({ ...form, time_hours: e.target.value })}
              placeholder="0"
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-as-gray-600 mb-1">Opomba (neobvezno)</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="npr. šarza, stroj, kupec..."
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        <button
          onClick={addEntry}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Shrani vnos
        </button>
      </div>

      {/* POVZETEK DNEVA */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
            <div className="text-xs text-cyan-700 font-semibold uppercase">Skupaj KOS</div>
            <div className="text-2xl font-bold text-cyan-900">{summary.totalQty.toLocaleString('sl-SI')}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
            <div className="text-xs text-cyan-700 font-semibold uppercase">Skupaj čas (ur)</div>
            <div className="text-2xl font-bold text-cyan-900">{summary.totalTime.toLocaleString('sl-SI', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
            <div className="text-xs text-cyan-700 font-semibold uppercase">Po normativu (KOS)</div>
            <div className="text-2xl font-bold text-cyan-900">{summary.totalNormativ.toLocaleString('sl-SI', { maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      )}

      {/* SEZNAM VNOSOV */}
      <div className="bg-white rounded-2xl border border-as-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-as-gray-200 bg-as-gray-50">
          <h2 className="text-sm font-bold text-as-gray-700">Vnosi za {formatDateSL(selectedDate)} • {entries.length}</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-as-gray-400">
            <Loader2 className="w-6 h-6 animate-spin inline" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-as-gray-400 text-sm">
            Ni vnosov za ta dan.
          </div>
        ) : (
          <div className="divide-y divide-as-gray-100">
            {entries.map(e => {
              const typeLabel = PRODUCT_TYPES.find(p => p.key === e.product_type)?.label || e.product_type;
              return (
                <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-as-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs font-bold rounded">{typeLabel}</span>
                      <span className="text-base font-bold text-as-gray-700">{parseFloat(e.quantity).toLocaleString('sl-SI')} KOS</span>
                      {e.normativ > 0 && <span className="text-xs text-as-gray-500">• normativ {e.normativ} KOS/h</span>}
                      {e.time_hours > 0 && <span className="text-xs text-as-gray-500">• {e.time_hours}h</span>}
                    </div>
                    {e.description && <div className="text-sm text-as-gray-500 truncate">{e.description}</div>}
                    {isAdmin && <div className="text-xs text-as-gray-400 mt-1">{e.employee_name}</div>}
                  </div>
                  {(e.employee_email === currentUser.email || isAdmin) && (
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="p-2 hover:bg-red-50 text-red-500 rounded-lg flex-shrink-0"
                      title="Izbriši"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-as-gray-400 text-center mt-4">
        💡 Vsak vnos se avtomatsko sešteje v <strong>Dnevno opravilo • Proizvodnja</strong>. V petek ob 15:00 sistem generira tedensko poročilo.
      </p>
    </div>
  );
}
