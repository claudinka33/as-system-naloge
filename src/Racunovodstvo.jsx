// =====================================
// RAČUNOVODSTVO - Modul za Saro Jagodič
// Vodenje stroškov, plač, kompenzacij, opominov, intrastat-a, ...
// =====================================

import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit2, X, Wallet, FileText, Calendar, 
  ChevronDown, ChevronRight, Search, Filter, AlertCircle,
  CheckCircle2, Circle, Loader2, Receipt, Users, Package,
  TrendingDown, Bell, Award, Briefcase, Building2, Truck,
  RefreshCw, Megaphone, Settings, ShieldAlert, Flame, Recycle, Globe,
  User
} from 'lucide-react';
import { supabase } from './supabase.js';

export const RACUNOVODSTVO_KATEGORIJE = {
  prejeti_racuni: {
    name: 'Prejeti računi - stroški',
    icon: Receipt,
    color: '#854D0E',
    bgColor: '#FEF3C7',
    desc: 'Potrošni material, ogrevanje, elektrika, komunala, Vasco, pisarniški/sanitarni material, poraba (BOS, skladišče, montaža)',
    subKategorije: [
      'Potrošni material', 'Ogrevanje', 'Elektrika', 'Komunala',
      'Vasco', 'Pisarniški material', 'Sanitarni material',
      'Računovodstvo', 'Hauc', 'Poraba BOS', 'Poraba skladišče',
      'Poraba montaža', 'Drugo'
    ],
    showEmployee: false,
  },
  place: {
    name: 'Plače',
    icon: Users,
    color: '#1E40AF',
    bgColor: '#BFDBFE',
    desc: 'Mesečno, bolniške (refundirane / strošek podjetja), dopusti',
    subKategorije: [
      'Mesečna plača', 'Bolniška - refundirana',
      'Bolniška - strošek podjetja', 'Dopust', 'Drugo'
    ],
    showEmployee: true,
  },
  stimulacije: {
    name: 'Stimulacije / destimulacije',
    icon: Award,
    color: '#065F46',
    bgColor: '#A7F3D0',
    desc: 'Nagrade in destimulacije zaposlenim',
    subKategorije: ['Stimulacija (nagrada)', 'Destimulacija'],
    showEmployee: true,
  },
  kompenzacije: {
    name: 'Kompenzacije',
    icon: RefreshCw,
    color: '#5B21B6',
    bgColor: '#DDD6FE',
    desc: 'Medsebojne, verižne, e-kompenzacije, AJPES',
    subKategorije: ['Medsebojna', 'Verižna', 'E-kompenzacija (AJPES)', 'Drugo'],
    showEmployee: false,
  },
  predcasna_placila: {
    name: 'Predčasna plačila / cassasconto',
    icon: TrendingDown,
    color: '#0E7490',
    bgColor: '#CFFAFE',
    desc: 'Predčasna plačila s popustom (cassasconto)',
    subKategorije: ['Predčasno plačilo', 'Cassasconto popust'],
    showEmployee: false,
  },
  zamudna_placila: {
    name: 'Zamudna plačila / klici',
    icon: AlertCircle,
    color: '#B91C1C',
    bgColor: '#FEE2E2',
    desc: 'Zamudna plačila in klici dolžnikom',
    subKategorije: ['Zamuda - prejeti', 'Zamuda - izdani', 'Klic dolžniku'],
    showEmployee: false,
  },
  opomini: {
    name: 'Opomini',
    icon: Bell,
    color: '#9D174D',
    bgColor: '#FCE7F3',
    desc: 'Tedensko izstavljanje opominov',
    subKategorije: ['1. opomin', '2. opomin', '3. opomin / izvršba'],
    showEmployee: false,
  },
  marketing_stroski: {
    name: 'Marketinški stroški (letni)',
    icon: Megaphone,
    color: '#7C2D12',
    bgColor: '#FED7AA',
    desc: 'Letni marketing stroški (Jager, Inpos, Merkur, ...)',
    subKategorije: ['Jager', 'Inpos', 'Merkur', 'Spletno oglaševanje', 'Drugo'],
    showEmployee: false,
  },
  vasco: {
    name: 'Vasco - novosti / nadgradnje',
    icon: Settings,
    color: '#374151',
    bgColor: '#E5E7EB',
    desc: 'Spremembe in nadgradnje v Vasco programu',
    subKategorije: ['Novost', 'Nadgradnja', 'Konfiguracija', 'Težava'],
    showEmployee: false,
  },
  reklamacije: {
    name: 'Reklamacije',
    icon: ShieldAlert,
    color: '#9F1239',
    bgColor: '#FFE4E6',
    desc: 'Reklamacije od strank ali do dobaviteljev',
    subKategorije: ['Od stranke', 'Do dobavitelja', 'Notranja'],
    showEmployee: true,
  },
  intrastat: {
    name: 'Intrastat',
    icon: Globe,
    color: '#1D4ED8',
    bgColor: '#DBEAFE',
    desc: 'Statistično poročanje za EU trgovino',
    subKategorije: ['Vstopno (Arrival)', 'Izstopno (Dispatch)'],
    showEmployee: false,
  },
  invalidi: {
    name: 'Invalidi',
    icon: Briefcase,
    color: '#3F6212',
    bgColor: '#D9F99D',
    desc: 'Evidence in obveznosti za invalide',
    subKategorije: ['Evidenca', 'Obveznost', 'Refundacija'],
    showEmployee: true,
  },
  odpadki: {
    name: 'Odpadki - poročilo, račun',
    icon: Recycle,
    color: '#15803D',
    bgColor: '#BBF7D0',
    desc: 'Poročilo o odpadkih in pripadajoči računi',
    subKategorije: ['Poročilo', 'Račun', 'Prevzem'],
    showEmployee: false,
  },
  cbam: {
    name: 'CBAM (kvartalno)',
    icon: Flame,
    color: '#C2410C',
    bgColor: '#FFEDD5',
    desc: 'Carbon Border Adjustment Mechanism - kvartalno poročilo',
    subKategorije: ['Q1', 'Q2', 'Q3', 'Q4'],
    showEmployee: false,
  },
};

const STATUSI = [
  { key: 'open', label: 'Odprto', color: '#D97706', bgColor: '#FEF3C7' },
  { key: 'in_progress', label: 'V teku', color: '#1E40AF', bgColor: '#BFDBFE' },
  { key: 'completed', label: 'Zaključeno', color: '#065F46', bgColor: '#D1FAE5' },
  { key: 'overdue', label: 'Zamuda', color: '#B91C1C', bgColor: '#FEE2E2' },
];

export default function Racunovodstvo({ currentUser, isAdmin, employees = [] }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('racunovodstvo_entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      console.error('Error loading entries:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry(entry) {
    try {
      if (entry.id) {
        const { error } = await supabase
          .from('racunovodstvo_entries')
          .update({
            category: entry.category, sub_category: entry.sub_category,
            title: entry.title, description: entry.description,
            amount: entry.amount, counterparty: entry.counterparty,
            employee_email: entry.employee_email, employee_name: entry.employee_name,
            due_date: entry.due_date, payment_date: entry.payment_date,
            status: entry.status, notes: entry.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('racunovodstvo_entries')
          .insert([{
            category: entry.category, sub_category: entry.sub_category,
            title: entry.title, description: entry.description,
            amount: entry.amount, counterparty: entry.counterparty,
            employee_email: entry.employee_email, employee_name: entry.employee_name,
            due_date: entry.due_date, payment_date: entry.payment_date,
            status: entry.status, notes: entry.notes,
            created_by_email: currentUser.email,
            created_by_name: currentUser.name,
          }]);
        if (error) throw error;
      }
      await loadEntries();
      setShowNewModal(false);
      setEditingEntry(null);
    } catch (e) {
      alert('Napaka pri shranjevanju: ' + e.message);
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Si prepričana, da želiš izbrisati ta vnos?')) return;
    try {
      const { error } = await supabase
        .from('racunovodstvo_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadEntries();
    } catch (e) {
      alert('Napaka pri brisanju: ' + e.message);
    }
  }

  const stats = {
    total: entries.length,
    open: entries.filter(e => e.status === 'open').length,
    in_progress: entries.filter(e => e.status === 'in_progress').length,
    completed: entries.filter(e => e.status === 'completed').length,
    overdue: entries.filter(e => e.status === 'overdue').length,
  };

  const filteredEntries = entries.filter(e => {
    if (selectedCategory && e.category !== selectedCategory) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.counterparty || '').toLowerCase().includes(q) ||
        (e.employee_name || '').toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countByCategory = (catKey) => entries.filter(e => e.category === catKey).length;
  const canEdit = isAdmin;

  if (!isAdmin) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <Wallet className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
        <p className="text-as-gray-600 font-semibold">Modul Računovodstvo je dostopen samo administratorjem</p>
        <p className="text-as-gray-400 text-sm mt-1">Za dostop kontaktiraj Saro ali Aleša.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: '#FEF3C7'}}>
              <Wallet className="w-6 h-6" style={{color: '#854D0E'}} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-as-gray-700">Računovodstvo</h1>
              <p className="text-xs text-as-gray-500">Sproten pregled stroškov, plač, kompenzacij, opominov ...</p>
            </div>
          </div>
          <button onClick={() => setShowNewModal(true)} className="px-4 py-2 text-white rounded-lg flex items-center gap-2 font-semibold hover:shadow-md transition" style={{backgroundColor: '#C8102E'}}>
            <Plus className="w-4 h-4" /> Nov vnos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <button onClick={() => setStatusFilter('all')} className={`bg-white border rounded-xl p-3 text-left transition hover:shadow-md ${statusFilter === 'all' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}>
          <div className="text-2xl font-bold text-as-gray-700">{stats.total}</div>
          <div className="text-xs text-as-gray-500 mt-0.5 font-medium">Skupaj</div>
        </button>
        {STATUSI.map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)} className={`bg-white border rounded-xl p-3 text-left transition hover:shadow-md ${statusFilter === s.key ? 'ring-2 ring-as-red-100 border-as-red-400' : 'border-as-gray-200'}`}>
            <div className="text-2xl font-bold" style={{color: s.color}}>{stats[s.key]}</div>
            <div className="text-xs text-as-gray-500 mt-0.5 font-medium">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-as-gray-200 rounded-xl p-3 mb-4 shadow-sm flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-as-gray-400" />
          <input type="text" placeholder="Išči po naslovu, opisu, partnerju, delavcu ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
        </div>
        {selectedCategory && (
          <button onClick={() => setSelectedCategory(null)} className="px-3 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold flex items-center gap-1">
            <X className="w-4 h-4" /> Vse kategorije
          </button>
        )}
      </div>

      {!selectedCategory && !searchQuery && statusFilter === 'all' ? (
        <KategorijeGrid countByCategory={countByCategory} onSelect={setSelectedCategory} />
      ) : (
        <EntriesList entries={filteredEntries} loading={loading} onEdit={(e) => setEditingEntry(e)} onDelete={deleteEntry} selectedCategory={selectedCategory} canEdit={canEdit} />
      )}

      {(showNewModal || editingEntry) && (
        <EntryModal entry={editingEntry} defaultCategory={selectedCategory} employees={employees} onSave={saveEntry} onClose={() => { setShowNewModal(false); setEditingEntry(null); }} />
      )}
    </div>
  );
}

function KategorijeGrid({ countByCategory, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(RACUNOVODSTVO_KATEGORIJE).map(([key, cat]) => {
        const Icon = cat.icon;
        const count = countByCategory(key);
        return (
          <button key={key} onClick={() => onSelect(key)} className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-lg hover:border-as-gray-300 transition group flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat.bgColor}}>
              <Icon className="w-5 h-5" style={{color: cat.color}} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-bold text-as-gray-700 text-sm leading-tight">{cat.name}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{backgroundColor: cat.bgColor, color: cat.color}}>{count}</span>
              </div>
              <p className="text-xs text-as-gray-500 leading-snug">{cat.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EntriesList({ entries, loading, onEdit, onDelete, selectedCategory, canEdit }) {
  if (loading) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <Loader2 className="w-8 h-8 text-as-gray-400 mx-auto animate-spin mb-2" />
        <p className="text-as-gray-500 text-sm">Nalagam vnose ...</p>
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <FileText className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
        <p className="text-as-gray-600 font-semibold">Ni vnosov</p>
        <p className="text-as-gray-400 text-sm mt-1">Klikni "Nov vnos" za dodajanje prvega vnosa.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {selectedCategory && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-3">
            {(() => {
              const cat = RACUNOVODSTVO_KATEGORIJE[selectedCategory];
              const Icon = cat.icon;
              return (
                <>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: cat.bgColor}}>
                    <Icon className="w-5 h-5" style={{color: cat.color}} />
                  </div>
                  <div>
                    <h3 className="font-bold text-as-gray-700">{cat.name}</h3>
                    <p className="text-xs text-as-gray-500">{cat.desc}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {entries.map(entry => (
        <EntryRow key={entry.id} entry={entry} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} canEdit={canEdit} />
      ))}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  const cat = RACUNOVODSTVO_KATEGORIJE[entry.category];
  const status = STATUSI.find(s => s.key === entry.status) || STATUSI[0];
  const Icon = cat?.icon || FileText;

  const formatAmount = (amt) => {
    if (amt === null || amt === undefined || amt === '') return null;
    return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(amt);
  };
  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('sl-SI');
  };

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-3 hover:bg-as-gray-50 cursor-pointer transition" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor: cat?.bgColor || '#F3F4F6'}}>
            <Icon className="w-4 h-4" style={{color: cat?.color || '#6B7280'}} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-bold text-as-gray-700 text-sm">{entry.title}</h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{backgroundColor: status.bgColor, color: status.color}}>{status.label}</span>
              {entry.sub_category && (
                <span className="text-xs text-as-gray-500 bg-as-gray-100 px-2 py-0.5 rounded">{entry.sub_category}</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-as-gray-500">
              {entry.employee_name && (
                <span className="flex items-center gap-1 font-semibold" style={{color: '#1E40AF'}}>
                  <User className="w-3 h-3" /> {entry.employee_name}
                </span>
              )}
              {entry.counterparty && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {entry.counterparty}
                </span>
              )}
              {entry.amount && (
                <span className="font-semibold text-as-gray-700">{formatAmount(entry.amount)}</span>
              )}
              {entry.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Rok: {formatDate(entry.due_date)}
                </span>
              )}
              {entry.payment_date && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Plačano: {formatDate(entry.payment_date)}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-as-gray-400 flex-shrink-0 mt-1 transition ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-as-gray-100 bg-as-gray-50/50 p-3 space-y-2">
          {entry.description && (
            <div>
              <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</div>
              <p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.description}</p>
            </div>
          )}
          {entry.notes && (
            <div>
              <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</div>
              <p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
          <div className="text-xs text-as-gray-400 pt-1">Ustvarjeno: {entry.created_by_name} · {formatDate(entry.created_at)}</div>
          {canEdit && (
            <div className="flex items-center gap-2 pt-2 border-t border-as-gray-200">
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="px-3 py-1.5 bg-white border border-as-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-as-gray-50">
                <Edit2 className="w-3 h-3" /> Uredi
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-red-50">
                <Trash2 className="w-3 h-3" /> Izbriši
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryModal({ entry, defaultCategory, employees = [], onSave, onClose }) {
  const [form, setForm] = useState({
    id: entry?.id || null,
    category: entry?.category || defaultCategory || 'prejeti_racuni',
    sub_category: entry?.sub_category || '',
    title: entry?.title || '',
    description: entry?.description || '',
    amount: entry?.amount || '',
    counterparty: entry?.counterparty || '',
    employee_email: entry?.employee_email || '',
    employee_name: entry?.employee_name || '',
    due_date: entry?.due_date || '',
    payment_date: entry?.payment_date || '',
    status: entry?.status || 'open',
    notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const cat = RACUNOVODSTVO_KATEGORIJE[form.category];

  const handleEmployeeChange = (email) => {
    if (!email) {
      setForm({...form, employee_email: '', employee_name: ''});
      return;
    }
    const emp = employees.find(e => e.email === email);
    setForm({ ...form, employee_email: email, employee_name: emp ? emp.name : '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Naslov je obvezen.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, amount: form.amount === '' ? null : parseFloat(form.amount) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-as-gray-700">{entry?.id ? 'Uredi vnos' : 'Nov vnos'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Kategorija *</label>
            <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value, sub_category: ''})} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
              {Object.entries(RACUNOVODSTVO_KATEGORIJE).map(([key, c]) => (
                <option key={key} value={key}>{c.name}</option>
              ))}
            </select>
          </div>
          {cat?.subKategorije && cat.subKategorije.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Podkategorija</label>
              <select value={form.sub_category} onChange={(e) => setForm({...form, sub_category: e.target.value})} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
                <option value="">— izberi —</option>
                {cat.subKategorije.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Naslov *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="npr. Račun Elektro Maribor 11/2025" required className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5">
                <User className="w-3 h-3" />
                Delavec / zaposleni {cat?.showEmployee && '*'}
              </span>
            </label>
            <select value={form.employee_email} onChange={(e) => handleEmployeeChange(e.target.value)} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
              <option value="">— ni vezano na delavca —</option>
              {employees.map(emp => (
                <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
              ))}
            </select>
            {cat?.showEmployee && (
              <p className="text-xs text-as-gray-400 mt-1">Za to kategorijo je smiselno izbrati delavca (plača, stimulacija, reklamacija ...)</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Partner / dobavitelj / kupec</label>
            <input type="text" value={form.counterparty} onChange={(e) => setForm({...form, counterparty: e.target.value})} placeholder="npr. Elektro Maribor d.d." className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Znesek (€)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} placeholder="0.00" className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
                {STATUSI.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Datum zapadlosti</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Datum plačila</label>
              <input type="date" value={form.payment_date} onChange={(e) => setForm({...form, payment_date: e.target.value})} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</label>
            <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Dodaten opis ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</label>
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Opombe ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 rounded-lg font-semibold text-sm">Prekliči</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-white rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50" style={{backgroundColor: '#C8102E'}}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {entry?.id ? 'Shrani spremembe' : 'Shrani vnos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
