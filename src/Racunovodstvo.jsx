// =====================================
// RAČUNOVODSTVO - Modul za Saro Jagodič
// V3: Vnos / Dnevno / Mesečno (nadzorna plošča kot Proizvodnja)
//     + Excel dialog z multi-select + datum filter
//     + Dropdown kategorij iz App.jsx headerja
// =====================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Edit2, X, Wallet, FileText, Calendar,
  ChevronDown, ChevronRight, Search, Filter, AlertCircle,
  CheckCircle2, Circle, Loader2, Receipt, Users, Package,
  TrendingDown, Bell, Award, Briefcase, Building2, Truck,
  RefreshCw, Megaphone, Settings, ShieldAlert, Flame, Recycle, Globe,
  User, Download, Paperclip, MessageSquare, Send, FileSpreadsheet,
  FileImage, Calculator, BarChart3, Wallet as WalletIcon, TrendingUp,
  ArrowUpRight, ArrowDownRight, CheckSquare, Square
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
    showDocumentDates: true,
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
    showPromiseDate: true,
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
  ddv: {
    name: 'DDV',
    icon: Calculator,
    color: '#0F766E',
    bgColor: '#CCFBF1',
    desc: 'DDV obračun, akontacije, refundacije, poročanje (DDV-O, DDV-P)',
    subKategorije: ['DDV-O obračun', 'Akontacija DDV', 'Refundacija DDV', 'DDV-P obrazec', 'Rekapitulacijsko poročilo', 'Drugo'],
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

function computeAutoStatus(entry) {
  if (entry.status === 'completed') return 'completed';
  if (entry.next_promise_date && !entry.payment_date) {
    const promise = new Date(entry.next_promise_date);
    promise.setHours(23, 59, 59, 999);
    if (promise < new Date()) return 'overdue';
  }
  if (entry.due_date && !entry.payment_date) {
    const due = new Date(entry.due_date);
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) return 'overdue';
  }
  return entry.status || 'open';
}

const formatEUR = (amt) => {
  if (amt === null || amt === undefined || amt === '' || isNaN(amt)) return '0 €';
  return new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amt);
};

const formatDateSL = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('sl-SI');
};

export default function Racunovodstvo({ currentUser, isAdmin, employees = [], selectedCategoryFromHeader = null, onCategoryHandled = null, resetSignal = 0 }) {
  const [entries, setEntries] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('entry');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (selectedCategoryFromHeader !== null && selectedCategoryFromHeader !== undefined) {
      setSelectedCategory(selectedCategoryFromHeader || null);
      setView('entry');
      if (onCategoryHandled) onCategoryHandled();
    }
  }, [selectedCategoryFromHeader]);

  // Reset signal: ko klikneš že-aktiven gumb v headerju (App.jsx triggerModuleReset),
  // se modul vrne na home (vse kategorije, brez filtra, view=entry)
  useEffect(() => {
    if (resetSignal > 0) {
      setSelectedCategory(null);
      setSearchQuery('');
      setStatusFilter('all');
      setView('entry');
      setShowNewModal(false);
      setEditingEntry(null);
      setShowExportDialog(false);
    }
  }, [resetSignal]);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel('racunovodstvo-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racunovodstvo_entries' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racunovodstvo_comments' }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'racunovodstvo_attachments' }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [entriesRes, commentsRes, attachRes] = await Promise.all([
        supabase.from('racunovodstvo_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('racunovodstvo_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('racunovodstvo_attachments').select('*').order('created_at', { ascending: true }),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      setEntries(entriesRes.data || []);
      setComments(commentsRes.data || []);
      setAttachments(attachRes.data || []);
    } catch (e) {
      console.error('Error loading racunovodstvo:', e);
      setEntries([]); setComments([]); setAttachments([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry(entry) {
    try {
      let savedId = entry.id;
      if (entry.id) {
        const { error } = await supabase.from('racunovodstvo_entries').update({
          category: entry.category, sub_category: entry.sub_category,
          title: entry.title, description: entry.description,
          amount: entry.amount, counterparty: entry.counterparty,
          employee_email: entry.employee_email, employee_name: entry.employee_name,
          due_date: entry.due_date || null, payment_date: entry.payment_date || null,
          document_date: entry.document_date || null, service_date: entry.service_date || null,
          next_promise_date: entry.next_promise_date || null,
          status: entry.status, notes: entry.notes,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('racunovodstvo_entries').insert([{
          category: entry.category, sub_category: entry.sub_category,
          title: entry.title, description: entry.description,
          amount: entry.amount, counterparty: entry.counterparty,
          employee_email: entry.employee_email, employee_name: entry.employee_name,
          due_date: entry.due_date || null, payment_date: entry.payment_date || null,
          document_date: entry.document_date || null, service_date: entry.service_date || null,
          next_promise_date: entry.next_promise_date || null,
          status: entry.status, notes: entry.notes,
          created_by_email: currentUser.email, created_by_name: currentUser.name,
        }]).select().single();
        if (error) throw error;
        savedId = data?.id;
      }
      if (entry.pendingFiles && entry.pendingFiles.length > 0 && savedId) {
        for (const file of entry.pendingFiles) { await uploadAttachment(savedId, file); }
      }
      await loadAll();
      setShowNewModal(false); setEditingEntry(null);
    } catch (e) {
      alert('Napaka pri shranjevanju: ' + e.message);
    }
  }

  async function deleteEntry(id) {
    if (!confirm('Si prepričana, da želiš izbrisati ta vnos? (Komentarji in priponke se bodo tudi izbrisali.)')) return;
    try {
      const entryAttachments = attachments.filter(a => a.entry_id === id);
      if (entryAttachments.length > 0) {
        const paths = entryAttachments.map(a => a.storage_path);
        await supabase.storage.from('racunovodstvo-attachments').remove(paths);
      }
      const { error } = await supabase.from('racunovodstvo_entries').delete().eq('id', id);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert('Napaka pri brisanju: ' + e.message); }
  }

  async function addComment(entryId, text) {
    if (!text.trim()) return;
    try {
      const { error } = await supabase.from('racunovodstvo_comments').insert([{
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
      const { error: uploadError } = await supabase.storage.from('racunovodstvo-attachments').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: metaError } = await supabase.from('racunovodstvo_attachments').insert([{
        entry_id: entryId, file_name: file.name, file_type: file.type, file_size: file.size,
        storage_path: filePath, uploaded_by_email: currentUser.email, uploaded_by_name: currentUser.name,
      }]);
      if (metaError) throw metaError;
      await loadAll();
    } catch (e) { alert(`Napaka pri nalaganju "${file.name}": ${e.message}`); }
  }

  async function downloadAttachment(att) {
    try {
      const { data, error } = await supabase.storage.from('racunovodstvo-attachments').download(att.storage_path);
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
      await supabase.storage.from('racunovodstvo-attachments').remove([att.storage_path]);
      await supabase.from('racunovodstvo_attachments').delete().eq('id', att.id);
      await loadAll();
    } catch (e) { alert('Napaka pri brisanju priponke: ' + e.message); }
  }

  function exportEntriesToExcel(selectedEntries, options = {}) {
    if (!selectedEntries || selectedEntries.length === 0) {
      alert('Ni vnosov za izvoz.');
      return;
    }
    const rows = selectedEntries.map(entry => {
      const cat = RACUNOVODSTVO_KATEGORIJE[entry.category];
      const status = STATUSI.find(s => s.key === computeAutoStatus(entry)) || STATUSI[0];
      const entryComments = comments.filter(c => c.entry_id === entry.id);
      const entryAttach = attachments.filter(a => a.entry_id === entry.id);
      return {
        'Kategorija': cat?.name || entry.category,
        'Podkategorija': entry.sub_category || '',
        'Naslov': entry.title || '',
        'Opis': entry.description || '',
        'Partner / dobavitelj': entry.counterparty || '',
        'Delavec': entry.employee_name || '',
        'Znesek (€)': entry.amount ?? '',
        'Status': status.label,
        'Datum dokumentacije': entry.document_date || '',
        'Datum opravljene storitve': entry.service_date || '',
        'Datum zapadlosti': entry.due_date || '',
        'Datum plačila': entry.payment_date || '',
        'Obljubljeno plačilo': entry.next_promise_date || '',
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
    Object.entries(RACUNOVODSTVO_KATEGORIJE).forEach(([key, cat]) => {
      const catRows = rows.filter(r => r['Kategorija'] === cat.name);
      if (catRows.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(catRows);
      const cols = Object.keys(catRows[0]).map(k => ({ wch: Math.max(k.length, ...catRows.map(r => String(r[k] ?? '').length)) + 2 }));
      ws['!cols'] = cols;
      XLSX.utils.book_append_sheet(wb, ws, cat.name.substring(0, 31));
    });
    const today = new Date().toISOString().split('T')[0];
    const baseName = options.filename || `Racunovodstvo_${today}`;
    XLSX.writeFile(wb, baseName.replace(/[^a-zA-Z0-9_.-]/g, '_') + '.xlsx');
  }

  const enrichedEntries = useMemo(() => entries.map(e => ({
    ...e,
    _status: computeAutoStatus(e),
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
              <h1 className="text-xl font-bold text-as-gray-700">
                Računovodstvo
                {selectedCategory && (
                  <span className="ml-2 text-sm font-semibold" style={{color: RACUNOVODSTVO_KATEGORIJE[selectedCategory]?.color}}>
                    › {RACUNOVODSTVO_KATEGORIJE[selectedCategory]?.name}
                  </span>
                )}
              </h1>
              <p className="text-xs text-as-gray-500">Sproten pregled stroškov, plač, kompenzacij, opominov, DDV ...</p>
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
        <EntryView
          enrichedEntries={enrichedEntries}
          filteredEntries={filteredEntries}
          stats={stats}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          onEditEntry={(e) => setEditingEntry(e)}
          onDeleteEntry={deleteEntry}
          canEdit={canEdit}
          onAddComment={addComment}
          onUploadAttachment={uploadAttachment}
          onDownloadAttachment={downloadAttachment}
          onDeleteAttachment={deleteAttachment}
          currentUser={currentUser}
        />
      )}

      {view === 'daily' && (
        <DashboardView mode="daily" enrichedEntries={enrichedEntries} comments={comments} attachments={attachments} onExport={(entries, opts) => exportEntriesToExcel(entries, opts)} onJumpToEntry={(entry) => { setSelectedCategory(entry.category); setView('entry'); }} />
      )}

      {view === 'monthly' && (
        <DashboardView mode="monthly" enrichedEntries={enrichedEntries} comments={comments} attachments={attachments} onExport={(entries, opts) => exportEntriesToExcel(entries, opts)} onJumpToEntry={(entry) => { setSelectedCategory(entry.category); setView('entry'); }} />
      )}

      {(showNewModal || editingEntry) && (
        <EntryModal entry={editingEntry} defaultCategory={selectedCategory} employees={employees} onSave={saveEntry} onClose={() => { setShowNewModal(false); setEditingEntry(null); }} />
      )}

      {showExportDialog && (
        <ExportDialog entries={enrichedEntries} onExport={(selected, opts) => { exportEntriesToExcel(selected, opts); setShowExportDialog(false); }} onClose={() => setShowExportDialog(false)} />
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

function EntryView({ enrichedEntries, filteredEntries, stats, loading, searchQuery, setSearchQuery, statusFilter, setStatusFilter, selectedCategory, setSelectedCategory, onEditEntry, onDeleteEntry, canEdit, onAddComment, onUploadAttachment, onDownloadAttachment, onDeleteAttachment, currentUser }) {
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
        <KategorijeGrid countByCategory={(k) => enrichedEntries.filter(e => e.category === k).length} overdueByCategory={(k) => enrichedEntries.filter(e => e.category === k && e._status === 'overdue').length} onSelect={setSelectedCategory} />
      ) : (
        <EntriesList entries={filteredEntries} loading={loading} onEdit={onEditEntry} onDelete={onDeleteEntry} selectedCategory={selectedCategory} canEdit={canEdit} onAddComment={onAddComment} onUploadAttachment={onUploadAttachment} onDownloadAttachment={onDownloadAttachment} onDeleteAttachment={onDeleteAttachment} currentUser={currentUser} />
      )}
    </>
  );
}

function DashboardView({ mode, enrichedEntries, comments, attachments, onExport, onJumpToEntry }) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const periodEntries = useMemo(() => {
    if (mode === 'daily') {
      const target = selectedDate;
      return enrichedEntries.filter(e => {
        const d = e.document_date || e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
        return d === target;
      });
    } else {
      return enrichedEntries.filter(e => {
        const d = e.document_date || e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
        return d && d.startsWith(selectedMonth);
      });
    }
  }, [mode, enrichedEntries, selectedDate, selectedMonth]);

  const kpi = useMemo(() => {
    const totalAmount = periodEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const paidAmount = periodEntries.filter(e => e.payment_date).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const openAmount = periodEntries.filter(e => !e.payment_date && e._status !== 'completed').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const overdueCount = periodEntries.filter(e => e._status === 'overdue').length;
    const overdueAmount = periodEntries.filter(e => e._status === 'overdue').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return { totalAmount, paidAmount, openAmount, overdueCount, overdueAmount, count: periodEntries.length };
  }, [periodEntries]);

  const byCategory = useMemo(() => {
    const map = {};
    Object.keys(RACUNOVODSTVO_KATEGORIJE).forEach(k => { map[k] = { count: 0, amount: 0, overdue: 0 }; });
    periodEntries.forEach(e => {
      if (!map[e.category]) return;
      map[e.category].count += 1;
      map[e.category].amount += parseFloat(e.amount) || 0;
      if (e._status === 'overdue') map[e.category].overdue += 1;
    });
    return Object.entries(map).filter(([_, v]) => v.count > 0).sort(([_, a], [__, b]) => b.amount - a.amount);
  }, [periodEntries]);

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
        <button onClick={() => onExport(periodEntries, { filename: `Racunovodstvo_${mode}_${mode === 'daily' ? selectedDate : selectedMonth}` })} disabled={periodEntries.length === 0} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-as-gray-300 text-white rounded-lg flex items-center gap-2 font-semibold text-sm">
          <Download className="w-4 h-4" /> Izvoz v Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Število vnosov" value={kpi.count} icon={<FileText />} bg="#DBEAFE" color="#1D4ED8" />
        <KpiCard label="Skupaj zneski" value={formatEUR(kpi.totalAmount)} icon={<WalletIcon />} bg="#FEF3C7" color="#854D0E" sub={`${kpi.count} vnosov`} />
        <KpiCard label="Plačano" value={formatEUR(kpi.paidAmount)} icon={<CheckCircle2 />} bg="#D1FAE5" color="#065F46" />
        <KpiCard label="Odprto / Zamuda" value={formatEUR(kpi.openAmount)} icon={<AlertCircle />} bg={kpi.overdueCount > 0 ? '#FEE2E2' : '#FEF3C7'} color={kpi.overdueCount > 0 ? '#B91C1C' : '#D97706'} sub={kpi.overdueCount > 0 ? `⚠ ${kpi.overdueCount} v zamudi (${formatEUR(kpi.overdueAmount)})` : 'brez zamud'} />
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
                const cat = RACUNOVODSTVO_KATEGORIJE[key];
                const Icon = cat.icon;
                const pct = kpi.totalAmount > 0 ? (v.amount / kpi.totalAmount) * 100 : 0;
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
                          <span className="text-xs text-as-gray-500">{v.count} vnosov</span>
                          <span className="text-sm font-bold text-as-gray-700">{formatEUR(v.amount)}</span>
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
                    <th className="text-right py-2 px-2 font-bold">Znesek</th>
                    <th className="text-left py-2 px-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periodEntries.slice(0, 50).map(e => {
                    const cat = RACUNOVODSTVO_KATEGORIJE[e.category];
                    const Icon = cat?.icon || FileText;
                    const status = STATUSI.find(s => s.key === e._status) || STATUSI[0];
                    return (
                      <tr key={e.id} onClick={() => onJumpToEntry(e)} className="border-b border-as-gray-50 hover:bg-as-gray-50 cursor-pointer transition">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat?.bgColor}}>
                              <Icon className="w-3 h-3" style={{color: cat?.color}} />
                            </div>
                            <span className="text-xs text-as-gray-600">{cat?.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 font-semibold text-as-gray-700">{e.title}</td>
                        <td className="py-2 px-2 text-as-gray-500">{e.counterparty || '—'}</td>
                        <td className="py-2 px-2 text-right font-bold text-as-gray-700">{e.amount ? formatEUR(e.amount) : '—'}</td>
                        <td className="py-2 px-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{backgroundColor: status.bgColor, color: status.color}}>{status.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {periodEntries.length > 50 && (<p className="text-xs text-as-gray-400 text-center mt-2 italic">Prikazanih prvih 50 od {periodEntries.length} vnosov. Za vse uporabi Excel izvoz.</p>)}
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

function ExportDialog({ entries, onExport, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(new Set(Object.keys(RACUNOVODSTVO_KATEGORIJE)));
  const [selectedStatuses, setSelectedStatuses] = useState(new Set(['open', 'in_progress', 'completed', 'overdue']));
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchInDialog, setSearchInDialog] = useState('');

  const filtered = useMemo(() => entries.filter(e => {
    const d = e.document_date || e.due_date || (e.created_at ? e.created_at.split('T')[0] : null);
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
    if (allFilteredSelected) filtered.forEach(e => next.delete(e.id)); else filtered.forEach(e => next.add(e.id));
    setSelectedIds(next);
  };
  const toggleEntry = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };
  const toggleCategory = (key) => { const next = new Set(selectedCategories); if (next.has(key)) next.delete(key); else next.add(key); setSelectedCategories(next); };
  const toggleStatus = (key) => { const next = new Set(selectedStatuses); if (next.has(key)) next.delete(key); else next.add(key); setSelectedStatuses(next); };

  const handleExport = () => {
    const useSelected = selectedIds.size > 0;
    const toExport = useSelected ? entries.filter(e => selectedIds.has(e.id)) : filtered;
    if (toExport.length === 0) { alert('Ni vnosov za izvoz. Spremeni filter ali izberi vnose.'); return; }
    let filename = `Racunovodstvo_izbrani`;
    if (dateFrom && dateTo) filename = `Racunovodstvo_${dateFrom}_${dateTo}`;
    else if (dateFrom) filename = `Racunovodstvo_od_${dateFrom}`;
    else if (dateTo) filename = `Racunovodstvo_do_${dateTo}`;
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
            <p className="text-xs text-as-gray-400 mt-1 italic">Filtrira po datumu dokumentacije / zapadlosti / vnosa</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Kategorije ({selectedCategories.size}/{Object.keys(RACUNOVODSTVO_KATEGORIJE).length})</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setSelectedCategories(new Set(Object.keys(RACUNOVODSTVO_KATEGORIJE)))} className="px-2 py-0.5 text-[10px] bg-as-gray-100 hover:bg-as-gray-200 rounded font-semibold normal-case">Vse</button>
                <button type="button" onClick={() => setSelectedCategories(new Set())} className="px-2 py-0.5 text-[10px] bg-as-gray-100 hover:bg-as-gray-200 rounded font-semibold normal-case">Nobena</button>
              </div>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(RACUNOVODSTVO_KATEGORIJE).map(([key, cat]) => {
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
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-as-gray-400" />
                  <input type="text" value={searchInDialog} onChange={(e) => setSearchInDialog(e.target.value)} placeholder="Išči ..." className="pl-7 pr-2 py-1 border border-as-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-200 w-40" />
                </div>
                <button type="button" onClick={toggleAllFiltered} className="text-xs font-semibold flex items-center gap-1 px-2 py-1 bg-as-gray-100 hover:bg-as-gray-200 rounded">
                  {allFilteredSelected ? <CheckSquare className="w-3 h-3 text-emerald-600" /> : <Square className="w-3 h-3" />}
                  {allFilteredSelected ? 'Odznači filtrirane' : 'Označi filtrirane'}
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs font-semibold px-2 py-1 bg-as-gray-100 hover:bg-as-gray-200 rounded">Reset izbora</button>
              </div>
            </div>
            <div className="border border-as-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-as-gray-400 italic p-4 text-center">Ni vnosov za prikazane filtre.</p>
              ) : (
                filtered.map(e => {
                  const cat = RACUNOVODSTVO_KATEGORIJE[e.category];
                  const status = STATUSI.find(s => s.key === e._status) || STATUSI[0];
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
                          {e.amount && <span className="font-semibold">{formatEUR(e.amount)}</span>}
                          {(e.document_date || e.due_date || e.created_at) && (<span>{formatDateSL(e.document_date || e.due_date || e.created_at)}</span>)}
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

function KategorijeGrid({ countByCategory, overdueByCategory, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(RACUNOVODSTVO_KATEGORIJE).map(([key, cat]) => {
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

function EntriesList({ entries, loading, onEdit, onDelete, selectedCategory, canEdit, onAddComment, onUploadAttachment, onDownloadAttachment, onDeleteAttachment, currentUser }) {
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
        <EntryRow key={entry.id} entry={entry} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry.id)} canEdit={canEdit} onAddComment={onAddComment} onUploadAttachment={onUploadAttachment} onDownloadAttachment={onDownloadAttachment} onDeleteAttachment={onDeleteAttachment} currentUser={currentUser} />
      ))}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, canEdit, onAddComment, onUploadAttachment, onDownloadAttachment, onDeleteAttachment, currentUser }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef(null);
  const cat = RACUNOVODSTVO_KATEGORIJE[entry.category];
  const status = STATUSI.find(s => s.key === entry._status) || STATUSI[0];
  const Icon = cat?.icon || FileText;
  const isOverdue = entry._status === 'overdue';

  const formatBytes = (b) => {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) { await onUploadAttachment(entry.id, f); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
              {entry._attachments && entry._attachments.length > 0 && (<span className="text-xs text-as-gray-500 flex items-center gap-0.5"><Paperclip className="w-3 h-3" /> {entry._attachments.length}</span>)}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-as-gray-500">
              {entry.employee_name && (<span className="flex items-center gap-1 font-semibold" style={{color: '#1E40AF'}}><User className="w-3 h-3" /> {entry.employee_name}</span>)}
              {entry.counterparty && (<span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {entry.counterparty}</span>)}
              {entry.amount !== null && entry.amount !== undefined && entry.amount !== '' && (<span className="font-semibold text-as-gray-700">{formatEUR(entry.amount)}</span>)}
              {entry.due_date && (<span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Rok: {formatDateSL(entry.due_date)}</span>)}
              {entry.next_promise_date && !entry.payment_date && (<span className="flex items-center gap-1 font-semibold" style={{color: '#B91C1C'}}><Bell className="w-3 h-3" /> Obljubljeno: {formatDateSL(entry.next_promise_date)}</span>)}
              {entry.payment_date && (<span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Plačano: {formatDateSL(entry.payment_date)}</span>)}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-as-gray-400 flex-shrink-0 mt-1 transition ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-as-gray-100 bg-as-gray-50/50 p-3 space-y-3">
          {(entry.document_date || entry.service_date) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {entry.document_date && (<div className="bg-white p-2 rounded border border-as-gray-100"><div className="text-[10px] font-bold text-as-gray-500 uppercase tracking-wider">Datum dokumentacije</div><div className="text-sm font-semibold text-as-gray-700">{formatDateSL(entry.document_date)}</div></div>)}
              {entry.service_date && (<div className="bg-white p-2 rounded border border-as-gray-100"><div className="text-[10px] font-bold text-as-gray-500 uppercase tracking-wider">Datum opravljene storitve</div><div className="text-sm font-semibold text-as-gray-700">{formatDateSL(entry.service_date)}</div></div>)}
            </div>
          )}
          {entry.description && (<div><div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</div><p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.description}</p></div>)}
          {entry.notes && (<div><div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</div><p className="text-sm text-as-gray-700 whitespace-pre-wrap">{entry.notes}</p></div>)}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Priponke ({entry._attachments?.length || 0})</div>
              <label className="cursor-pointer text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-as-gray-100 transition" style={{color: '#C8102E'}}>
                <Plus className="w-3 h-3" /> Dodaj
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt" onClick={(e) => e.stopPropagation()} />
              </label>
            </div>
            {entry._attachments && entry._attachments.length > 0 ? (
              <div className="space-y-1">
                {entry._attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 p-2 bg-white rounded border border-as-gray-100">
                    <FileText className="w-4 h-4 text-as-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-as-gray-700 truncate">{att.file_name}</div>
                      <div className="text-xs text-as-gray-400">{formatBytes(att.file_size)} · {att.uploaded_by_name}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDownloadAttachment(att); }} className="p-1.5 hover:bg-as-gray-100 rounded text-as-gray-400 hover:text-as-gray-700" title="Prenesi"><Download className="w-4 h-4" /></button>
                    {canEdit && (<button onClick={(e) => { e.stopPropagation(); onDeleteAttachment(att); }} className="p-1.5 hover:bg-red-50 rounded text-as-gray-400 hover:text-red-600" title="Odstrani"><X className="w-4 h-4" /></button>)}
                  </div>
                ))}
              </div>
            ) : (<p className="text-xs text-as-gray-400 italic">Ni priponk. Dodaj PDF, Excel, sliko (max 50MB).</p>)}
          </div>

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
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendComment(); }} placeholder="Dodaj komentar (npr. 'Obljubil plačati v petek') ..." className="flex-1 px-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white" />
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

function EntryModal({ entry, defaultCategory, employees = [], onSave, onClose }) {
  const [form, setForm] = useState({
    id: entry?.id || null,
    category: entry?.category || defaultCategory || 'prejeti_racuni',
    sub_category: entry?.sub_category || '',
    title: entry?.title || '',
    description: entry?.description || '',
    amount: entry?.amount ?? '',
    counterparty: entry?.counterparty || '',
    employee_email: entry?.employee_email || '',
    employee_name: entry?.employee_name || '',
    due_date: entry?.due_date || '',
    payment_date: entry?.payment_date || '',
    document_date: entry?.document_date || '',
    service_date: entry?.service_date || '',
    next_promise_date: entry?.next_promise_date || '',
    status: entry?.status || 'open',
    notes: entry?.notes || '',
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const cat = RACUNOVODSTVO_KATEGORIJE[form.category];

  const handleEmployeeChange = (email) => {
    if (!email) { setForm({ ...form, employee_email: '', employee_name: '' }); return; }
    const emp = employees.find(e => e.email === email);
    setForm({ ...form, employee_email: email, employee_name: emp ? emp.name : '' });
  };

  const handlePendingFilesAdd = (e) => {
    const files = Array.from(e.target.files);
    const valid = files.filter(f => {
      if (f.size > 50 * 1024 * 1024) { alert(`Datoteka "${f.name}" je prevelika (max 50MB).`); return false; }
      return true;
    });
    setPendingFiles([...pendingFiles, ...valid]);
  };

  const removePendingFile = (idx) => { setPendingFiles(pendingFiles.filter((_, i) => i !== idx)); };

  const formatBytes = (b) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { alert('Naslov je obvezen.'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, amount: form.amount === '' ? null : parseFloat(form.amount), pendingFiles });
    } finally {
      setSaving(false);
    }
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
              {Object.entries(RACUNOVODSTVO_KATEGORIJE).map(([key, c]) => (<option key={key} value={key}>{c.name}</option>))}
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
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="npr. Račun Elektro Maribor 11/2025" required className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Delavec / zaposleni {cat?.showEmployee && '*'}</span>
            </label>
            <select value={form.employee_email} onChange={(e) => handleEmployeeChange(e.target.value)} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
              <option value="">— ni vezano na delavca —</option>
              {employees.map(emp => (<option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Partner / dobavitelj / kupec</label>
            <input type="text" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="npr. Elektro Maribor d.d." className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Znesek (€)</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300">
                {STATUSI.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Datum zapadlosti</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Datum plačila</label>
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" />
            </div>
          </div>
          {cat?.showDocumentDates && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg" style={{backgroundColor: '#FEF9E7'}}>
              <div><label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color: '#854D0E'}}>Datum dokumentacije</label><input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white" /></div>
              <div><label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color: '#854D0E'}}>Datum opravljene storitve</label><input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white" /></div>
            </div>
          )}
          {cat?.showPromiseDate && (
            <div className="p-3 rounded-lg" style={{backgroundColor: '#FEE2E2'}}>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{color: '#B91C1C'}}>
                <span className="flex items-center gap-1.5"><Bell className="w-3 h-3" /> Obljubljeno plačilo (datum)</span>
              </label>
              <input type="date" value={form.next_promise_date} onChange={(e) => setForm({ ...form, next_promise_date: e.target.value })} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300 bg-white" />
              <p className="text-xs mt-1" style={{color: '#B91C1C'}}>Če ta datum preteče in ni datuma plačila → vnos se avtomatsko označi kot ZAMUDA. Zgodovino obljub piši v klepetu.</p>
            </div>
          )}
          <div><label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opis</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Dodaten opis ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" /></div>
          <div><label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Opombe</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opombe ..." rows={2} className="w-full px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-300" /></div>
          {!entry?.id && (
            <div>
              <label className="block text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1.5"><Paperclip className="w-3 h-3" /> Priponke (neobvezno)</span>
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-as-gray-300 rounded-lg cursor-pointer hover:border-as-red-400 hover:bg-as-red-50 transition">
                <Plus className="w-4 h-4 text-as-gray-400" />
                <span className="text-sm text-as-gray-500 font-medium">Dodaj datoteke</span>
                <input type="file" multiple className="hidden" onChange={handlePendingFilesAdd} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt" />
              </label>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pendingFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-as-gray-50 rounded-lg">
                      <Paperclip className="w-4 h-4 text-as-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-as-gray-700 truncate">{file.name}</div>
                        <div className="text-xs text-as-gray-400">{formatBytes(file.size)}</div>
                      </div>
                      <button type="button" onClick={() => removePendingFile(idx)} className="p-1 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-as-gray-400 mt-1.5">PDF, Word, Excel, slike (max 50MB).</p>
            </div>
          )}
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
