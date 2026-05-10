// =====================================
// ODDELEK MODULE - generični modul za posamezne oddelke
// Uporabljen za: Nabavo, Prodajo, Tehnolog, Komercialo, Kakovost
// Vsak oddelek je v svoji Supabase tabeli, ima svoje kategorije, dostope.
// =====================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Edit2, X, FileText, Calendar,
  ChevronDown, Search, AlertCircle,
  CheckCircle2, Circle, Loader2,
  User, Download, Paperclip, MessageSquare, Send,
  Building2, Filter
} from 'lucide-react';
import { supabase } from './supabase.js';

const STATUSI = [
  { key: 'open', label: 'Odprto', color: '#D97706', bgColor: '#FEF3C7' },
  { key: 'in_progress', label: 'V teku', color: '#1E40AF', bgColor: '#BFDBFE' },
  { key: 'completed', label: 'Zaključeno', color: '#065F46', bgColor: '#D1FAE5' },
  { key: 'overdue', label: 'Zamuda', color: '#B91C1C', bgColor: '#FEE2E2' },
];

function computeAutoStatus(entry) {
  if (entry.status === 'completed') return 'completed';
  if (entry.due_date && !entry.payment_date && entry.status !== 'completed') {
    const due = new Date(entry.due_date);
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) return 'overdue';
  }
  return entry.status || 'open';
}

const formatDateSL = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('sl-SI');
};

export default function OddelekModule({
  config,
  currentUser,
  isAdmin,
  employees = [],
  selectedCategoryFromHeader = null,
  onCategoryHandled = null
}) {
  const [entries, setEntries] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const HeaderIcon = config.icon;

  useEffect(() => {
    if (selectedCategoryFromHeader !== null && selectedCategoryFromHeader !== undefined) {
      setSelectedCategory(selectedCategoryFromHeader || null);
      if (onCategoryHandled) onCategoryHandled();
    }
  }, [selectedCategoryFromHeader]);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel(`${config.tableName}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: config.tableName }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: `${config.tableName}_comments` }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [config.tableName]);

  async function loadAll() {
    setLoading(true);
    try {
      const [entriesRes, commentsRes] = await Promise.all([
        supabase.from(config.tableName).select('*').order('created_at', { ascending: false }),
        supabase.from(`${config.tableName}_comments`).select('*').order('created_at', { ascending: true }),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      setEntries(entriesRes.data || []);
      setComments(commentsRes.data || []);
    } catch (e) {
      console.error(`Error loading ${config.tableName}:`, e);
      setEntries([]); setComments([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry(entry) {
    try {
      const payload = {
        category: entry.category, sub_category: entry.sub_category || null,
        title: entry.title, description: entry.description || null,
        counterparty: entry.counterparty || null,
        employee_email: entry.employee_email || null, employee_name: entry.employee_name || null,
        due_date: entry.due_date || null, status: entry.status || 'open',
        notes: entry.notes || null, priority: entry.priority || 'medium',
      };
      if (entry.id) {
        const { error } = await supabase.from(config.tableName).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(config.tableName).insert([{ ...payload, created_by_email: currentUser.email, created_by_name: currentUser.name }]);
        if (error) throw error;
      }
      await loadAll();
      setShowNewModal(false); setEditingEntry(null);
    } catch (e) { alert('Napaka pri shranjevanju: ' + e.message); }
  }

  async function deleteEntry(id) {
    if (!confirm('Si prepričan/a, da želiš izbrisati ta vnos?')) return;
    try {
      const { error } = await supabase.from(config.tableName).delete().eq('id', id);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert('Napaka pri brisanju: ' + e.message); }
  }

  async function addComment(entryId, text) {
    if (!text.trim()) return;
    try {
      const { error } = await supabase.from(`${config.tableName}_comments`).insert([{
        entry_id: entryId, text: text.trim(),
        author_email: currentUser.email, author_name: currentUser.name,
      }]);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert('Napaka pri komentarju: ' + e.message); }
  }

  const enrichedEntries = useMemo(() => entries.map(e => ({
    ...e, _status: computeAutoStatus(e),
    _comments: comments.filter(c => c.entry_id === e.id),
  })), [entries, comments]);

  const stats = useMemo(() => ({
    total: enrichedEntries.length,
    open: enrichedEntries.filter(e => e._status === 'open').length,
    in_progress: enrichedEntries.filter(e => e._status === 'in_progress').length,
    completed: enrichedEntries.filter(e => e._status === 'completed').length,
    overdue: enrichedEntries.filter(e => e._status === 'overdue').length,
  }), [enrichedEntries]);

  const filteredEntries = useMemo(() => enrichedEntries.filter(e => {
    if (selectedCategory && e.category !== selectedCategory) return false;
    if (statusFilter !== 'all' && e._status !== statusFilter) return false;
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
  }), [enrichedEntries, selectedCategory, statusFilter, searchQuery]);

  const countByCategory = (k) => enrichedEntries.filter(e => e.category === k).length;
  const overdueByCategory = (k) => enrichedEntries.filter(e => e.category === k && e._status === 'overdue').length;

  const canAccess = isAdmin || (config.allowedEmails ? config.allowedEmails.includes(currentUser?.email) : true);
  const canEdit = canAccess;

  if (!canAccess) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <HeaderIcon className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
        <p className="text-as-gray-600 font-semibold">Modul "{config.name}" je omejen na določene zaposlene.</p>
        <p className="text-as-gray-400 text-sm mt-1">Za dostop kontaktiraj administratorja.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: config.accentBg}}>
              <HeaderIcon className="w-6 h-6" style={{color: config.accentColor}} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-as-gray-700">
                {config.name}
                {selectedCategory && config.categories[selectedCategory] && (
                  <span className="ml-2 text-sm font-semibold" style={{color: config.categories[selectedCategory].color}}>
                    › {config.categories[selectedCategory].name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-as-gray-500">{config.desc}</p>
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

      <div className="bg-white border border-as-gray-200 rounded-xl p-3 mb-3 shadow-sm flex items-center gap-2 flex-wrap">
        {selectedCategory && (
          <button onClick={() => setSelectedCategory(null)} className="px-3 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold flex items-center gap-1">
            <X className="w-4 h-4" /> Vse kategorije
          </button>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-as-gray-400" />
          <input type="text" placeholder="Išči po naslovu, opisu, partnerju, delavcu ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
        </div>
      </div>

      {!selectedCategory && !searchQuery && statusFilter === 'all' ? (
        <KategorijeGrid categories={config.categories} countByCategory={countByCategory} overdueByCategory={overdueByCategory} onSelect={setSelectedCategory} />
      ) : (
        <EntriesList entries={filteredEntries} categories={config.categories} loading={loading} onEdit={(e) => setEditingEntry(e)} onDelete={deleteEntry} selectedCategory={selectedCategory} canEdit={canEdit} onAddComment={addComment} currentUser={currentUser} />
      )}

      {(showNewModal || editingEntry) && (
        <EntryModal entry={editingEntry} defaultCategory={selectedCategory} categories={config.categories} employees={employees} onSave={saveEntry} onClose={() => { setShowNewModal(false); setEditingEntry(null); }} />
      )}
    </div>
  );
}

function KategorijeGrid({ categories, countByCategory, overdueByCategory, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(categories).map(([key, cat]) => {
        const Icon = cat.icon;
        const count = countByCategory(key);
        const overdueCount = overdueByCategory(key);
        return (
          <button key={key} onClick={() => onSelect(key)} className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-lg hover:border-as-gray-300 transition group flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat.bgColor}}>
              <Icon className="w-5 h-5" style={{color: cat.color}} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-bold text-as-gray-700 text-sm leading-tight">{cat.name}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {overdueCount > 0 && (<span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white" title="Zamude">⚠ {overdueCount}</span>)}
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{backgroundColor: cat.bgColor, color: cat.color}}>{count}</span>
                </div>
              </div>
              <p className="text-xs text-as-gray-500 leading-snug">{cat.desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EntriesList({ entries, categories, loading, onEdit, onDelete, selectedCategory, canEdit, onAddComment, currentUser }) {
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
      {selectedCategory && categories[selectedCategory] && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-3">
            {(() => {
              const cat = categories[selectedCategory];
              const Icon = cat.icon;
              return (<><div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: cat.bgColor}}><Icon className="w-5 h-5" style={{color: cat.color}} /></div><div><h3 className="font-bold text-as-gray-700">{cat.name}</h3><p className="text-xs text-as-gray-500">{cat.desc}</p></div></>);
            })()}
          </div>
        </div>
      )}
      {entries.map(entry => (
        <EntryRow key={entry.id} entry={entry} categories={categories} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} canEdit={canEdit} onAddComment={onAddComment} currentUser={currentUser} />
      ))}
    </div>
  );
}

function EntryRow({ entry, categories, onEdit, onDelete, canEdit, onAddComment, currentUser }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const cat = categories[entry.category];
  const status = STATUSI.find(s => s.key === entry._status) || STATUSI[0];
  const Icon = cat?.icon || FileText;
  const isOverdue = entry._status === 'overdue';

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    onAddComment(entry.id, commentText);
    setCommentText('');
  };

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${isOverdue ? 'border-red-300 ring-1 ring-red-100' : 'border-as-gray-200'}`}>
      <div className="p-3 hover:bg-as-gray-50 cursor-pointer transition" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor: cat?.bgColor || '#F3F4F6'}}>
            <Icon className="w-4 h-4" style={{color: cat?.color || '#6B7280'}} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="font-bold text-as-gray-700 text-sm">{entry.title}</h4>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{backgroundColor: status.bgColor, color: status.color}}>
                {isOverdue && <AlertCircle className="w-3 h-3 inline -mt-0.5 mr-0.5" />}
                {status.label}
              </span>
              {entry.sub_category && (<span className="text-xs text-as-gray-500 bg-as-gray-100 px-2 py-0.5 rounded">{entry.sub_category}</span>)}
              {entry._comments && entry._comments.length > 0 && (<span className="text-xs text-as-gray-500 flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {entry._comments.length}</span>)}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-as-gray-500">
              {entry.employee_name && (<span className="flex items-center gap-1 font-semibold" style={{color: '#1E40AF'}}><User className="w-3 h-3" /> {entry.employee_name}</span>)}
              {entry.counterparty && (<span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {entry.counterparty}</span>)}
              {entry.due_date && (<span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Rok: {formatDateSL(entry.due_date)}</span>)}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-as-gray-400 flex-shrink-0 mt-1 transition ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-as-gray-100 bg-as-gray-50/50 p-3 space-y-3">
          {entry.description && (<div><div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</div><p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.description}</p></div>)}
          {entry.notes && (<div><div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</div><p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.notes}</p></div>)}

          <div>
            <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Klepet ({entry._comments?.length || 0})</div>
            {entry._comments && entry._comments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {entry._comments.map(c => (
                  <div key={c.id} className="bg-white rounded-lg p-2 border border-as-gray-100">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-as-gray-700">{c.author_name}</span>
                      <span className="text-[10px] text-as-gray-400">{new Date(c.created_at).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-as-gray-700 whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(); }} placeholder="Dodaj komentar ..." className="flex-1 px-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white" />
              <button onClick={handleSendComment} className="px-3 py-1.5 text-white text-sm rounded-lg font-semibold flex items-center gap-1" style={{backgroundColor: '#C8102E'}}><Send className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className="text-xs text-as-gray-400 pt-1">Ustvarjeno: {entry.created_by_name} · {formatDateSL(entry.created_at)}</div>

          {canEdit && (
            <div className="flex items-center gap-2 pt-2 border-t border-as-gray-200">
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="px-3 py-1.5 bg-white border border-as-gray-200 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-as-gray-50"><Edit2 className="w-3 h-3" /> Uredi</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-red-50"><Trash2 className="w-3 h-3" /> Izbriši</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryModal({ entry, defaultCategory, categories, employees = [], onSave, onClose }) {
  const firstKey = Object.keys(categories)[0];
  const [form, setForm] = useState({
    id: entry?.id || null,
    category: entry?.category || defaultCategory || firstKey,
    sub_category: entry?.sub_category || '',
    title: entry?.title || '',
    description: entry?.description || '',
    counterparty: entry?.counterparty || '',
    employee_email: entry?.employee_email || '',
    employee_name: entry?.employee_name || '',
    due_date: entry?.due_date || '',
    status: entry?.status || 'open',
    priority: entry?.priority || 'medium',
    notes: entry?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const cat = categories[form.category];

  const handleEmployeeChange = (email) => {
    if (!email) { setForm({ ...form, employee_email: '', employee_name: '' }); return; }
    const emp = employees.find(e => e.email === email);
    setForm({ ...form, employee_email: email, employee_name: emp ? emp.name : '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { alert('Naslov je obvezen.'); return; }
    setSaving(true);
    try { await onSave({ ...form }); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-5 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-as-gray-700">{entry?.id ? 'Uredi vnos' : 'Nov vnos'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-lg border-2" style={{ borderColor: cat?.color || '#E5E7EB', backgroundColor: cat?.bgColor || '#F9FAFB' }}>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: cat?.color || '#6B7280' }}>Kategorija *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, sub_category: '' })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white font-semibold">
              {Object.entries(categories).map(([key, c]) => (<option key={key} value={key}>{c.name}</option>))}
            </select>
            {cat?.desc && (<p className="text-xs mt-1 italic" style={{ color: cat.color }}>{cat.desc}</p>)}
          </div>

          {cat?.subKategorije && cat.subKategorije.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Podkategorija</label>
              <select value={form.sub_category} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
                <option value="">— izberi —</option>
                {cat.subKategorije.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Naslov *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="npr. Naročilo materiala MUNGO" required className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>

          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1"><span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Delavec / zaposleni</span></label>
            <select value={form.employee_email} onChange={(e) => handleEmployeeChange(e.target.value)} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
              <option value="">— ni vezano na delavca —</option>
              {employees.map(emp => (<option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Partner / dobavitelj / kupec</label>
            <input type="text" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="npr. MUNGO, JAGER, PROFIX ..." className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Rok / zapadlost</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
                {STATUSI.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Dodaten opis ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>

          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opombe ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-as-gray-100">
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
