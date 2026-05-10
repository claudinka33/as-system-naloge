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

function DashboardView({ mode, enrichedEntries, categories, onExport, onJumpToEntry, moduleName }) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const periodEntries = useMemo(() => {
    if (mode === 'daily') {
      return enrichedEntries.filter(e => {
        const d = e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
        return d === selectedDate;
      });
    } else {
      return enrichedEntries.filter(e => {
        const d = e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
        return d && d.startsWith(selectedMonth);
      });
    }
  }, [mode, enrichedEntries, selectedDate, selectedMonth]);

  const kpi = useMemo(() => ({
    count: periodEntries.length,
    open: periodEntries.filter(e => e._status === 'open').length,
    in_progress: periodEntries.filter(e => e._status === 'in_progress').length,
    completed: periodEntries.filter(e => e._status === 'completed').length,
    overdue: periodEntries.filter(e => e._status === 'overdue').length,
  }), [periodEntries]);

  const byCategory = useMemo(() => {
    const map = {};
    Object.keys(categories).forEach(k => { map[k] = { count: 0, completed: 0, overdue: 0 }; });
    periodEntries.forEach(e => {
      if (!map[e.category]) return;
      map[e.category].count += 1;
      if (e._status === 'completed') map[e.category].completed += 1;
      if (e._status === 'overdue') map[e.category].overdue += 1;
    });
    return Object.entries(map).filter(([_, v]) => v.count > 0).sort(([_, a], [__, b]) => b.count - a.count);
  }, [periodEntries, categories]);

  const periodLabel = mode === 'daily' ? formatDateSL(selectedDate) : new Date(selectedMonth + '-01').toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-as-gray-400" />
          {mode === 'daily' ? (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          ) : (
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          )}
          <span className="text-sm text-as-gray-500 capitalize">{periodLabel}</span>
        </div>
        <button onClick={() => onExport(periodEntries, { filename: `${moduleName}_${mode}_${mode === 'daily' ? selectedDate : selectedMonth}` })} disabled={periodEntries.length === 0} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-as-gray-300 text-white rounded-lg flex items-center gap-2 font-semibold text-sm">
          <Download className="w-4 h-4" /> Izvoz v Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Število vnosov" value={kpi.count} icon={<FileText />} bg="#DBEAFE" color="#1D4ED8" />
        <KpiCard label="V teku" value={kpi.in_progress + kpi.open} icon={<Loader2 />} bg="#FEF3C7" color="#854D0E" sub={`${kpi.open} odprtih, ${kpi.in_progress} v teku`} />
        <KpiCard label="Zaključeno" value={kpi.completed} icon={<CheckCircle2 />} bg="#D1FAE5" color="#065F46" />
        <KpiCard label="Zamuda" value={kpi.overdue} icon={<AlertCircle />} bg={kpi.overdue > 0 ? '#FEE2E2' : '#FEF3C7'} color={kpi.overdue > 0 ? '#B91C1C' : '#D97706'} sub={kpi.overdue > 0 ? '⚠ pozor!' : 'brez zamud'} />
      </div>

      {periodEntries.length === 0 ? (
        <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
          <p className="text-as-gray-600 font-semibold">Ni vnosov za to obdobje</p>
          <p className="text-as-gray-400 text-sm mt-1">Izberi drug datum ali dodaj nov vnos.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h3 className="text-sm font-bold text-as-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Razčlenitev po kategorijah
            </h3>
            <div className="space-y-2">
              {byCategory.map(([key, v]) => {
                const cat = categories[key]; const Icon = cat.icon;
                const pct = kpi.count > 0 ? (v.count / kpi.count) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3 p-2 hover:bg-as-gray-50 rounded-lg transition">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat.bgColor}}>
                      <Icon className="w-4 h-4" style={{color: cat.color}} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-as-gray-700">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          {v.overdue > 0 && (<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">⚠ {v.overdue}</span>)}
                          {v.completed > 0 && (<span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ {v.completed}</span>)}
                          <span className="text-sm font-bold text-as-gray-700">{v.count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-as-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-as-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Vnosi v obdobju ({periodEntries.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-as-gray-100 text-xs text-as-gray-500 uppercase tracking-wider">
                    <th className="text-left py-2 px-2 font-bold">Kategorija</th>
                    <th className="text-left py-2 px-2 font-bold">Naslov</th>
                    <th className="text-left py-2 px-2 font-bold">Partner</th>
                    <th className="text-left py-2 px-2 font-bold">Delavec</th>
                    <th className="text-left py-2 px-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periodEntries.slice(0, 50).map(e => {
                    const cat = categories[e.category]; const Icon = cat?.icon || FileText;
                    const status = STATUSI.find(s => s.key === e._status) || STATUSI[0];
                    return (
                      <tr key={e.id} onClick={() => onJumpToEntry(e)} className="border-b border-as-gray-50 hover:bg-as-gray-50 cursor-pointer transition">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat?.bgColor}}><Icon className="w-3 h-3" style={{color: cat?.color}} /></div>
                            <span className="text-xs text-as-gray-600">{cat?.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-semibold text-as-gray-700">{e.title}</td>
                        <td className="py-2 px-2 text-as-gray-500">{e.counterparty || '—'}</td>
                        <td className="py-2 px-2 text-as-gray-500">{e.employee_name || '—'}</td>
                        <td className="py-2 px-2"><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{backgroundColor: status.bgColor, color: status.color}}>{status.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {periodEntries.length > 50 && (<p className="text-xs text-as-gray-400 text-center mt-2 italic">Prikazanih prvih 50 od {periodEntries.length}. Za vse uporabi Excel izvoz.</p>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, bg, color, sub }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: bg}}>
          {React.cloneElement(icon, { className: 'w-5 h-5', style: { color } })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider mb-0.5">{label}</div>
          <div className="text-xl font-bold text-as-gray-700 truncate">{value}</div>
          {sub && <div className="text-xs text-as-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function ExportDialog({ entries, categories, onExport, onClose, moduleName }) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(new Set(Object.keys(categories)));
  const [selectedStatuses, setSelectedStatuses] = useState(new Set(['open', 'in_progress', 'completed', 'overdue']));
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchInDialog, setSearchInDialog] = useState('');

  const filtered = useMemo(() => entries.filter(e => {
    const d = e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
    if (dateFrom && d && d < dateFrom) return false;
    if (dateTo && d && d > dateTo) return false;
    if (!selectedCategories.has(e.category)) return false;
    if (!selectedStatuses.has(e._status)) return false;
    if (searchInDialog) {
      const q = searchInDialog.toLowerCase();
      const match = (e.title || '').toLowerCase().includes(q) || (e.counterparty || '').toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  }), [entries, dateFrom, dateTo, selectedCategories, selectedStatuses, searchInDialog]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id));
  const toggleAllFiltered = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) filtered.forEach(e => next.delete(e.id));
    else filtered.forEach(e => next.add(e.id));
    setSelectedIds(next);
  };
  const toggleEntry = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };
  const toggleCategory = (key) => { const next = new Set(selectedCategories); if (next.has(key)) next.delete(key); else next.add(key); setSelectedCategories(next); };
  const toggleStatus = (key) => { const next = new Set(selectedStatuses); if (next.has(key)) next.delete(key); else next.add(key); setSelectedStatuses(next); };

  const handleExport = () => {
    const useSelected = selectedIds.size > 0;
    const toExport = useSelected ? entries.filter(e => selectedIds.has(e.id)) : filtered;
    if (toExport.length === 0) { alert('Ni vnosov za izvoz. Spremeni filter ali izberi vnose.'); return; }
    let filename = `${moduleName}_izbrani`;
    if (dateFrom && dateTo) filename = `${moduleName}_${dateFrom}_${dateTo}`;
    else if (dateFrom) filename = `${moduleName}_od_${dateFrom}`;
    else if (dateTo) filename = `${moduleName}_do_${dateTo}`;
    onExport(toExport, { filename });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="border-b border-as-gray-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /><h2 className="text-lg font-bold text-as-gray-700">Izvoz v Excel</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Časovno obdobje</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[140px]"><span className="text-xs text-as-gray-500 block mb-0.5">Od datuma</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300" /></div>
              <div className="flex-1 min-w-[140px]"><span className="text-xs text-as-gray-500 block mb-0.5">Do datuma</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300" /></div>
              <div className="flex items-end gap-1">
                <button type="button" onClick={() => { setDateFrom(monthAgoStr); setDateTo(today); }} className="px-2 py-1.5 bg-as-gray-100 hover:bg-as-gray-200 rounded text-xs font-semibold">Zadnji mesec</button>
                <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-2 py-1.5 bg-as-gray-100 hover:bg-as-gray-200 rounded text-xs font-semibold">Reset</button>
              </div>
            </div>
            <p className="text-xs text-as-gray-400 mt-1 italic">Filtrira po datumu zapadlosti / vnosa</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Kategorije ({selectedCategories.size}/{Object.keys(categories).length})</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setSelectedCategories(new Set(Object.keys(categories)))} className="px-2 py-0.5 text-[10px] bg-as-gray-100 hover:bg-as-gray-200 rounded font-semibold normal-case">Vse</button>
                <button type="button" onClick={() => setSelectedCategories(new Set())} className="px-2 py-0.5 text-[10px] bg-as-gray-100 hover:bg-as-gray-200 rounded font-semibold normal-case">Nobena</button>
              </div>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categories).map(([key, cat]) => {
                const Icon = cat.icon; const active = selectedCategories.has(key);
                return (
                  <button key={key} type="button" onClick={() => toggleCategory(key)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5" style={{ backgroundColor: active ? cat.color : '#F3F4F6', color: active ? '#fff' : '#9CA3AF', opacity: active ? 1 : 0.6 }}>
                    {active ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    <Icon className="w-3 h-3" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSI.map(s => {
                const active = selectedStatuses.has(s.key);
                return (
                  <button key={s.key} type="button" onClick={() => toggleStatus(s.key)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5" style={{ backgroundColor: active ? s.color : '#F3F4F6', color: active ? '#fff' : '#9CA3AF', opacity: active ? 1 : 0.6 }}>
                    {active ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="text-xs font-bold text-as-gray-500 uppercase tracking-wider">Posamezni vnosi ({filtered.length} po filtru, izbrano: {selectedIds.size})</label>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-as-gray-400" /><input type="text" value={searchInDialog} onChange={(e) => setSearchInDialog(e.target.value)} placeholder="Išči ..." className="pl-7 pr-2 py-1 border border-as-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-200 w-40" /></div>
                <button type="button" onClick={toggleAllFiltered} className="text-xs font-semibold flex items-center gap-1 px-2 py-1 bg-as-gray-100 hover:bg-as-gray-200 rounded">{allFilteredSelected ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <Square className="w-3 h-3" />}{allFilteredSelected ? 'Odznači filtrirane' : 'Označi filtrirane'}</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold px-2 py-1 bg-as-gray-100 hover:bg-as-gray-200 rounded">Reset izbora</button>
              </div>
            </div>
            <div className="border border-as-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (<p className="text-sm text-as-gray-400 italic p-4 text-center">Ni vnosov za prikazane filtre.</p>) : (
                filtered.map(e => {
                  const cat = categories[e.category]; const status = STATUSI.find(s => s.key === e._status) || STATUSI[0];
                  const isSelected = selectedIds.has(e.id);
                  return (
                    <label key={e.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-as-gray-50 border-b border-as-gray-100 last:border-b-0 ${isSelected ? 'bg-emerald-50' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleEntry(e.id)} className="w-4 h-4 rounded border-as-gray-300 cursor-pointer" style={{accentColor: '#059669'}} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-as-gray-700 truncate">{e.title}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{backgroundColor: cat?.bgColor, color: cat?.color}}>{cat?.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{backgroundColor: status.bgColor, color: status.color}}>{status.label}</span>
                        </div>
                        <div className="text-xs text-as-gray-500 flex items-center gap-2 mt-0.5">
                          {e.counterparty && <span>{e.counterparty}</span>}
                          {(e.due_date || e.created_at) && (<span>{formatDateSL(e.due_date || e.created_at)}</span>)}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-as-gray-400 mt-1 italic">{selectedIds.size > 0 ? `Izvozilo se bo ${selectedIds.size} izbranih vnosov.` : `Ker ni izbran noben vnos posebej, se bo izvozilo vseh ${filtered.length} filtriranih vnosov.`}</p>
          </div>
        </div>
        <div className="border-t border-as-gray-200 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 rounded-lg font-semibold text-sm">Prekliči</button>
          <button onClick={handleExport} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Izvozi v Excel</button>
        </div>
      </div>
    </div>
  );
}

function KategorijeGrid({ categories, countByCategory, overdueByCategory, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(categories).map(([key, cat]) => {
        const Icon = cat.icon; const count = countByCategory(key); const overdueCount = overdueByCategory(key);
        return (
          <button key={key} onClick={() => onSelect(key)} className="bg-white border border-as-gray-200 rounded-xl p-4 text-left hover:shadow-lg hover:border-as-gray-300 transition group flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat.bgColor}}><Icon className="w-5 h-5" style={{color: cat.color}} /></div>
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


// __MARKER_PART3_ENTRIES_AND_MODAL__
