// =====================================
// ODDELEK MODULE V2 - generični modul s polno funkcionalnostjo kot Računovodstvo
// Uporabljen za: Nabavo, Prodajo, Tehnolog, Komercialo, Kakovost
// V2: Dnevno/Mesečno dashboard + Excel dialog z multi-select + priponke
// =====================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Edit2, X, FileText, Calendar,
  ChevronDown, Search, AlertCircle,
  CheckCircle2, Circle, Loader2,
  User, Download, Paperclip, MessageSquare, Send,
  Building2, Filter, FileSpreadsheet, BarChart3,
  CheckSquare, Square, Wallet
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
  if (entry.due_date && entry.status !== 'completed') {
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

const formatBytes = (b) => {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
};

export default function OddelekModule({
  config,
  currentUser,
  isAdmin,
  employees = [],
  selectedCategoryFromHeader = null,
  onCategoryHandled = null,
  resetSignal = 0
}) {
  const [entries, setEntries] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('entry'); // 'entry' | 'daily' | 'monthly'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const HeaderIcon = config.icon;
  const tableName = config.tableName;
  const commentsTable = `${tableName}_comments`;
  const attachmentsTable = `${tableName}_attachments`;
  const storageBucket = config.storageBucket || `${tableName.replace('_entries', '')}-attachments`;

  useEffect(() => {
    if (selectedCategoryFromHeader !== null && selectedCategoryFromHeader !== undefined) {
      setSelectedCategory(selectedCategoryFromHeader || null);
      setView('entry');
      if (onCategoryHandled) onCategoryHandled();
    }
  }, [selectedCategoryFromHeader]);

  useEffect(() => {
    if (resetSignal > 0) {
      setSelectedCategory(null);
      setView('entry');
      setSearchQuery('');
      setStatusFilter('all');
    }
  }, [resetSignal]);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel(`${tableName}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: commentsTable }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: attachmentsTable }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tableName]);

  async function loadAll() {
    setLoading(true);
    try {
      const [entriesRes, commentsRes, attachRes] = await Promise.all([
        supabase.from(tableName).select('*').order('created_at', { ascending: false }),
        supabase.from(commentsTable).select('*').order('created_at', { ascending: true }),
        supabase.from(attachmentsTable).select('*').order('created_at', { ascending: true }),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      setEntries(entriesRes.data || []);
      setComments(commentsRes.data || []);
      setAttachments(attachRes.data || []);
    } catch (e) {
      console.error(`Error loading ${tableName}:`, e);
      setEntries([]); setComments([]); setAttachments([]);
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
      let savedId = entry.id;
      if (entry.id) {
        const { error } = await supabase.from(tableName).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from(tableName).insert([{ ...payload, created_by_email: currentUser.email, created_by_name: currentUser.name }]).select().single();
        if (error) throw error;
        savedId = data?.id;
      }
      if (entry.pendingFiles && entry.pendingFiles.length > 0 && savedId) {
        for (const file of entry.pendingFiles) { await uploadAttachment(savedId, file); }
      }
      await loadAll();
      setShowNewModal(false); setEditingEntry(null);
    } catch (e) { alert('Napaka pri shranjevanju: ' + e.message); }
  }

  async function deleteEntry(id) {
    if (!confirm('Si prepričan/a, da želiš izbrisati ta vnos? (Komentarji in priponke se bodo tudi izbrisali.)')) return;
    try {
      const entryAttachments = attachments.filter(a => a.entry_id === id);
      if (entryAttachments.length > 0) {
        const paths = entryAttachments.map(a => a.storage_path);
        await supabase.storage.from(storageBucket).remove(paths);
      }
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert('Napaka pri brisanju: ' + e.message); }
  }

  async function addComment(entryId, text) {
    if (!text.trim()) return;
    try {
      const { error } = await supabase.from(commentsTable).insert([{
        entry_id: entryId, text: text.trim(),
        author_email: currentUser.email, author_name: currentUser.name,
      }]);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert('Napaka pri komentarju: ' + e.message); }
  }

  async function uploadAttachment(entryId, file) {
    if (file.size > 50 * 1024 * 1024) {
      alert(`Datoteka "${file.name}" je prevelika. Maksimalno 50MB.`);
      return;
    }
    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `entry_${entryId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from(storageBucket).upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: metaError } = await supabase.from(attachmentsTable).insert([{
        entry_id: entryId, file_name: file.name, file_type: file.type, file_size: file.size,
        storage_path: filePath, uploaded_by_email: currentUser.email, uploaded_by_name: currentUser.name,
      }]);
      if (metaError) throw metaError;
      await loadAll();
    } catch (e) { alert(`Napaka pri nalaganju "${file.name}": ${e.message}`); }
  }

  async function downloadAttachment(att) {
    try {
      const { data, error } = await supabase.storage.from(storageBucket).download(att.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = att.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Napaka pri prenosu: ' + e.message); }
  }

  async function deleteAttachment(att) {
    if (!confirm(`Izbriši priponko "${att.file_name}"?`)) return;
    try {
      await supabase.storage.from(storageBucket).remove([att.storage_path]);
      await supabase.from(attachmentsTable).delete().eq('id', att.id);
      await loadAll();
    } catch (e) { alert('Napaka pri brisanju priponke: ' + e.message); }
  }

  function exportEntriesToExcel(selectedEntries, options = {}) {
    if (!selectedEntries || selectedEntries.length === 0) {
      alert('Ni vnosov za izvoz.'); return;
    }
    const rows = selectedEntries.map(entry => {
      const cat = config.categories[entry.category];
      const status = STATUSI.find(s => s.key === computeAutoStatus(entry)) || STATUSI[0];
      const entryComments = comments.filter(c => c.entry_id === entry.id);
      const entryAttach = attachments.filter(a => a.entry_id === entry.id);
      return {
        'Kategorija': cat?.name || entry.category,
        'Podkategorija': entry.sub_category || '',
        'Naslov': entry.title || '',
        'Opis': entry.description || '',
        'Partner': entry.counterparty || '',
        'Delavec': entry.employee_name || '',
        'Status': status.label,
        'Rok': entry.due_date || '',
        'Opombe': entry.notes || '',
        'Št. komentarjev': entryComments.length,
        'Št. priponk': entryAttach.length,
        'Ustvaril': entry.created_by_name || '',
        'Datum vnosa': entry.created_at ? new Date(entry.created_at).toLocaleDateString('sl-SI') : '',
      };
    });
    const wb = XLSX.utils.book_new();
    const allWs = XLSX.utils.json_to_sheet(rows);
    const allCols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2 }));
    allWs['!cols'] = allCols;
    XLSX.utils.book_append_sheet(wb, allWs, 'Izbrani');
    Object.entries(config.categories).forEach(([key, cat]) => {
      const catRows = rows.filter(r => r['Kategorija'] === cat.name);
      if (catRows.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(catRows);
      const cols = Object.keys(catRows[0]).map(k => ({ wch: Math.max(k.length, ...catRows.map(r => String(r[k] ?? '').length)) + 2 }));
      ws['!cols'] = cols;
      XLSX.utils.book_append_sheet(wb, ws, cat.name.substring(0, 31));
    });
    const today = new Date().toISOString().split('T')[0];
    const baseName = options.filename || `${config.name}_${today}`;
    XLSX.writeFile(wb, baseName.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.xlsx');
  }

  const enrichedEntries = useMemo(() => entries.map(e => ({
    ...e, _status: computeAutoStatus(e),
    _comments: comments.filter(c => c.entry_id === e.id),
    _attachments: attachments.filter(a => a.entry_id === e.id),
  })), [entries, comments, attachments]);

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
          <div className="flex items-center gap-2">
            <button onClick={() => setShowExportDialog(true)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 font-semibold text-sm shadow-sm">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Izvoz v Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <button onClick={() => setShowNewModal(true)} className="px-4 py-2 text-white rounded-lg flex items-center gap-2 font-semibold hover:shadow-md transition" style={{backgroundColor: '#C8102E'}}>
              <Plus className="w-4 h-4" /> Nov vnos
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200 max-w-md">
        <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
        <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
        <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
      </div>

      {view === 'entry' && (
        <EntryView enrichedEntries={enrichedEntries} filteredEntries={filteredEntries} stats={stats} loading={loading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} categories={config.categories} countByCategory={countByCategory} overdueByCategory={overdueByCategory} onEditEntry={(e) => setEditingEntry(e)} onDeleteEntry={deleteEntry} canEdit={canEdit} onAddComment={addComment} onUploadAttachment={uploadAttachment} onDownloadAttachment={downloadAttachment} onDeleteAttachment={deleteAttachment} currentUser={currentUser} />
      )}

      {view === 'daily' && (
        <DashboardView mode="daily" enrichedEntries={enrichedEntries} categories={config.categories} onExport={(entries, opts) => exportEntriesToExcel(entries, opts)} onJumpToEntry={(entry) => { setSelectedCategory(entry.category); setView('entry'); }} moduleName={config.name} />
      )}

      {view === 'monthly' && (
        <DashboardView mode="monthly" enrichedEntries={enrichedEntries} categories={config.categories} onExport={(entries, opts) => exportEntriesToExcel(entries, opts)} onJumpToEntry={(entry) => { setSelectedCategory(entry.category); setView('entry'); }} moduleName={config.name} />
      )}

      {(showNewModal || editingEntry) && (
        <EntryModal entry={editingEntry} defaultCategory={selectedCategory} categories={config.categories} employees={employees} onSave={saveEntry} onClose={() => { setShowNewModal(false); setEditingEntry(null); }} />
      )}

      {showExportDialog && (
        <ExportDialog entries={enrichedEntries} categories={config.categories} onExport={(selected, opts) => { exportEntriesToExcel(selected, opts); setShowExportDialog(false); }} onClose={() => setShowExportDialog(false)} moduleName={config.name} />
      )}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded transition ${active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`} style={active ? { backgroundColor: '#C8102E' } : {}}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function EntryView({ enrichedEntries, filteredEntries, stats, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, selectedCategory, setSelectedCategory, categories, countByCategory, overdueByCategory, onEditEntry, onDeleteEntry, canEdit, onAddComment, onUploadAttachment, onDownloadAttachment, onDeleteAttachment, currentUser }) {
  return (
    <>
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
        <KategorijeGrid categories={categories} countByCategory={countByCategory} overdueByCategory={overdueByCategory} onSelect={setSelectedCategory} />
      ) : (
        <EntriesList entries={filteredEntries} categories={categories} loading={loading} onEdit={onEditEntry} onDelete={onDeleteEntry} selectedCategory={selectedCategory} canEdit={canEdit} onAddComment={onAddComment} onUploadAttachment={onUploadAttachment} onDownloadAttachment={onDownloadAttachment} onDeleteAttachment={onDeleteAttachment} currentUser={currentUser} />
      )}
    </>
  );
}

// __MARKER_PART2_DASHBOARD__

// __MARKER_PART3_ENTRIES_AND_MODAL__
