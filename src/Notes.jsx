import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { FileText, Plus, Trash2, Download, Save, Bold, Italic, List, ListOrdered, Heading1, Heading2, Underline, Folder, FolderPlus, ChevronRight, ChevronDown, FolderOpen, Type, Palette, Move, Users, Lock, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, IndentIncrease, IndentDecrease, Highlighter, Smile, RemoveFormatting } from 'lucide-react';

const FONT_OPTIONS = [
  { label: 'Privzeta (Sans)', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'Courier (Mono)', value: '"Courier New", Consolas, monospace' },
  { label: 'Impact', value: 'Impact, Charcoal, sans-serif' },
  { label: 'Rokopis', value: '"Comic Sans MS", "Brush Script MT", cursive' }
];

// Simboli / ikone za vstavljanje (rokica najprej)
const SYMBOLS = ['👉','👈','☝️','✋','👍','👌','✅','✔️','❗','❓','⚠️','⭐','★','🔥','📌','📍','🔴','🟢','🔵','🟡','➡️','⬅️','→','•','◦','▪️','№','§','✎','📎','📅','💡','❌'];

export default function Notes({ currentUser, employees }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showMoveMenu, setShowMoveMenu] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderVisibleToAll, setFolderVisibleToAll] = useState(false);
  const [folderAllowedEmails, setFolderAllowedEmails] = useState([]);
  const [folderColor, setFolderColor] = useState('');
  const [folderParentId, setFolderParentId] = useState(null);
  const [authorTags, setAuthorTags] = useState(true);
  const [editingFolder, setEditingFolder] = useState(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const [seenMap, setSeenMap] = useState(() => { try { return JSON.parse(localStorage.getItem('note_seen') || '{}'); } catch { return {}; } });
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const canSeeFolder = (f) => {
    if (!f) return false;
    if ((f.created_by_email && f.created_by_email === currentUser?.email) || f.user_email === currentUser?.email) return true;
    if (f.visible_to_all) return true;
    return (f.allowed_emails || []).includes(currentUser?.email);
  };
  const canEditFolder = (f) => !!f && ((f.created_by_email && f.created_by_email === currentUser?.email) || f.user_email === currentUser?.email);

  // "Novo" sledenje (lokalno, brez baze)
  const markSeen = (note) => {
    if (!note) return;
    setSeenMap(prev => {
      const next = { ...prev, [note.id]: note.updated_at || new Date().toISOString() };
      try { localStorage.setItem('note_seen', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const isNoteNew = (note) => {
    const seen = seenMap[note.id];
    if (!seen) return false;
    return new Date(note.updated_at).getTime() > new Date(seen).getTime();
  };
  const folderNewCount = (folderId) => notes.filter(n => n.folder_id === folderId && isNoteNew(n)).length;

  // Člani mape (kdo ima dostop)
  const folderMembers = (f) => {
    const set = new Set();
    const owner = f.created_by_email || f.user_email;
    if (owner) set.add(owner);
    if (f.visible_to_all) (employees || []).forEach(e => set.add(e.email));
    else (f.allowed_emails || []).forEach(e => set.add(e));
    return [...set];
  };
  const personInitials = (email) => {
    const emp = (employees || []).find(e => e.email === email);
    const nm = emp?.name || email;
    return nm.split(/[ .@]/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('');
  };
  const personName = (email) => ((employees || []).find(e => e.email === email)?.name) || email;

  // Barva uporabnika (vsak svojo barvo pri pisanju)
  const USER_COLORS = ['#C8102E', '#2563eb', '#16a34a', '#9333ea', '#ca8a04', '#0891b2', '#db2777', '#ea580c', '#4f46e5', '#0d9488', '#65a30d', '#7c3aed', '#dc2626'];
  const colorForEmail = (email) => { let h = 0; const s = email || ''; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return USER_COLORS[h % USER_COLORS.length]; };
  const myColor = colorForEmail(currentUser?.email);
  const FOLDER_COLORS = ['#C8102E', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#9333ea', '#db2777', '#6b7280', '#0d9488'];

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [foldersRes, notesRes] = await Promise.all([
      supabase.from('note_folders').select('*').order('created_at', { ascending: true }),
      supabase.from('notes').select('*').order('updated_at', { ascending: false })
    ]);
    const allFolders = (!foldersRes.error && foldersRes.data) ? foldersRes.data : [];
    const myFolders = allFolders.filter(canSeeFolder);
    const visibleFolderIds = new Set(myFolders.map(f => f.id));
    setFolders(myFolders);
    setExpandedFolders({}); // mape ZAPRTE ob vstopu — poljubno odpiraš
    const allNotes = (!notesRes.error && notesRes.data) ? notesRes.data : [];
    const myNotes = allNotes.filter(n => n.user_email === currentUser.email || (n.folder_id && visibleFolderIds.has(n.folder_id)));
    setNotes(myNotes);
    // baseline za "novo": kar že obstaja ob prvem nalaganju ni "novo"
    setSeenMap(prev => {
      const next = { ...prev }; let changed = false;
      myNotes.forEach(n => { if (next[n.id] === undefined) { next[n.id] = n.updated_at; changed = true; } });
      if (changed) { try { localStorage.setItem('note_seen', JSON.stringify(next)); } catch {} }
      return next;
    });
    if (myNotes.length > 0 && !selectedNote) selectNote(myNotes[0]);
    setLoading(false);
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setLastSaved(null);
    markSeen(note);
    setTimeout(() => {
      if (editorRef.current) { editorRef.current.innerHTML = note.content || '<div><br></div>'; recomputeAuthorRuns(); }
    }, 0);
  };

  const createNote = async () => {
    const folderId = (selectedFolderId && selectedFolderId !== 'unfiled') ? selectedFolderId : null;
    const { data, error } = await supabase.from('notes').insert([{ user_email: currentUser.email, title: 'Nov dokument', content: '', folder_id: folderId }]).select().single();
    if (!error && data) { setNotes([data, ...notes]); selectNote(data); }
  };

  const deleteNote = async (noteId) => {
    if (!confirm('Res želiš izbrisati ta dokument?')) return;
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (!error) {
      const newNotes = notes.filter(n => n.id !== noteId);
      setNotes(newNotes);
      if (selectedNote?.id === noteId) {
        if (newNotes.length > 0) selectNote(newNotes[0]);
        else { setSelectedNote(null); setTitle(''); }
      }
    }
  };

  const saveNote = async (newTitle, newContent) => {
    if (!selectedNote) return;
    setSaving(true);
    const { data, error } = await supabase.from('notes').update({
      title: newTitle ?? title,
      content: newContent ?? (editorRef.current?.innerHTML || ''),
      updated_at: new Date().toISOString()
    }).eq('id', selectedNote.id).select().single();
    if (!error && data) {
      setNotes(notes.map(n => n.id === data.id ? data : n));
      setSelectedNote(data);
      setLastSaved(new Date());
      markSeen(data);
    }
    setSaving(false);
  };

  const handleContentChange = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { saveNote(); }, 1500);
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { saveNote(e.target.value); }, 1500);
  };

  const openNewFolderModal = (parentId = null) => {
    setEditingFolder(null);
    setNewFolderName('');
    setFolderVisibleToAll(false);
    setFolderAllowedEmails([]);
    setFolderColor('');
    setFolderParentId(parentId || null);
    setShowNewFolderModal(true);
  };
  const openEditFolder = (f) => {
    setEditingFolder(f);
    setNewFolderName(f.name || '');
    setFolderVisibleToAll(!!f.visible_to_all);
    setFolderAllowedEmails(f.allowed_emails || []);
    setFolderColor(f.color || '');
    setFolderParentId(f.parent_id || null);
    setShowNewFolderModal(true);
  };
  const closeFolderModal = () => {
    setShowNewFolderModal(false);
    setEditingFolder(null);
    setNewFolderName('');
    setFolderVisibleToAll(false);
    setFolderAllowedEmails([]);
    setFolderColor('');
    setFolderParentId(null);
  };
  const toggleAllowed = (email) => {
    setFolderAllowedEmails(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };

  const saveFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setSavingFolder(true);
    const payload = {
      name,
      visible_to_all: folderVisibleToAll,
      allowed_emails: folderVisibleToAll ? [] : folderAllowedEmails,
      color: folderColor || null,
      parent_id: folderParentId || null
    };
    if (editingFolder) {
      const { data, error } = await supabase.from('note_folders').update(payload).eq('id', editingFolder.id).select().single();
      if (!error && data) {
        setFolders(folders.map(f => f.id === data.id ? data : f));
        closeFolderModal();
      }
    } else {
      payload.user_email = currentUser.email;
      payload.created_by_email = currentUser.email;
      payload.created_by_name = currentUser.name || currentUser.email;
      const { data, error } = await supabase.from('note_folders').insert([payload]).select().single();
      if (!error && data) {
        setFolders([...folders, data]);
        setExpandedFolders({ ...expandedFolders, [data.id]: true });
        closeFolderModal();
      }
    }
    setSavingFolder(false);
  };

  const deleteFolder = async (folderId, folderName) => {
    const cnt = notes.filter(n => n.folder_id === folderId).length;
    const msg = cnt > 0 ? `Res izbrišeš mapico "${folderName}"? ${cnt} dokumentov ostane brez mape.` : `Res izbrišeš mapico "${folderName}"?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from('note_folders').delete().eq('id', folderId);
    if (!error) {
      setFolders(folders.filter(f => f.id !== folderId));
      setNotes(notes.map(n => n.folder_id === folderId ? { ...n, folder_id: null } : n));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
    }
  };

  const moveNoteToFolder = async (noteId, folderId) => {
    const { data, error } = await supabase.from('notes').update({ folder_id: folderId }).eq('id', noteId).select().single();
    if (!error && data) {
      setNotes(notes.map(n => n.id === noteId ? data : n));
      if (selectedNote?.id === noteId) setSelectedNote(data);
      setShowMoveMenu(null);
    }
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders({ ...expandedFolders, [folderId]: !expandedFolders[folderId] });
  };

  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentChange();
  };

  const setFontFamily = (font) => exec('fontName', font);
  const setColor = (color) => { exec('foreColor', color); setShowColorPicker(false); };
  const setHighlight = (color) => {
    document.execCommand('styleWithCSS', false, true);
    exec('hiliteColor', color);
    document.execCommand('styleWithCSS', false, false);
    setShowColorPicker(false);
  };
  const applyFontSizePx = (val) => {
    const n = Math.max(3, Math.min(250, parseInt(val, 10) || 16));
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontSize', false, '7');
    (editorRef.current?.querySelectorAll('font[size="7"]') || []).forEach(f => { f.removeAttribute('size'); f.style.fontSize = n + 'px'; });
    document.execCommand('styleWithCSS', false, false);
    handleContentChange();
  };
  // Samodejno označi avtorja odstavka, kjer pišeš (brez barvanja besedila)
  const tagCurrentBlock = () => {
    if (!authorTags) return;
    const editor = editorRef.current; if (!editor) return;
    const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
    let el = sel.anchorNode; if (!el) return;
    el = el.nodeType === 3 ? el.parentElement : el;
    while (el && el.parentElement && el.parentElement !== editor) el = el.parentElement;
    if (el && el !== editor && el.parentElement === editor) {
      const name = currentUser?.name || currentUser?.email || '';
      if (el.getAttribute('data-author') !== name) {
        el.setAttribute('data-author', name);
        el.style.setProperty('--author-color', colorForEmail(currentUser?.email));
      }
    }
  };
  const handleEditorInput = () => { tagCurrentBlock(); recomputeAuthorRuns(); handleContentChange(); };
  // Ime avtorja naj se pokaže SAMO na začetku zaporedja istega avtorja (ne na vsaki vrstici)
  const recomputeAuthorRuns = () => {
    const editor = editorRef.current; if (!editor) return;
    let last = null;
    Array.from(editor.children).forEach(el => {
      const a = el.getAttribute && el.getAttribute('data-author');
      if (a) {
        if (a === last) el.setAttribute('data-cont', '1');
        else el.removeAttribute('data-cont');
        last = a;
      } else { last = null; }
    });
  };
  // Odstrani oznako avtorja na trenutnem odstavku
  const removeAuthorHere = () => {
    const editor = editorRef.current; if (!editor) return;
    const sel = window.getSelection();
    let el = sel && sel.rangeCount ? sel.anchorNode : null;
    if (el) {
      el = el.nodeType === 3 ? el.parentElement : el;
      while (el && el.parentElement && el.parentElement !== editor) el = el.parentElement;
      if (el && el !== editor && el.parentElement === editor && el.hasAttribute('data-author')) {
        el.removeAttribute('data-author');
        el.removeAttribute('data-cont');
        el.style.removeProperty('--author-color');
        recomputeAuthorRuns();
        handleContentChange();
        editor.focus();
        return;
      }
    }
    clearAllAuthors();
  };
  const clearAllAuthors = () => {
    const editor = editorRef.current; if (!editor) return;
    editor.querySelectorAll('[data-author]').forEach(n => { n.removeAttribute('data-author'); n.removeAttribute('data-cont'); n.style.removeProperty('--author-color'); });
    handleContentChange();
    editor.focus();
  };
  const insertSymbol = (s) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, s);
    setShowSymbols(false);
    handleContentChange();
  };
  // Tab = zamik pikice naprej (kot Word), Shift+Tab = nazaj
  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      exec(e.shiftKey ? 'outdent' : 'indent');
    }
  };

  const exportToPDF = async () => {
    const content = editorRef.current?.innerHTML || '';
    setSaving(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('https://esm.sh/jspdf@2.5.2'),
        import('https://esm.sh/html2canvas@1.4.1')
      ]);
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;padding:40px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.6;color:#111827;background:white;';
      container.innerHTML = `<h1 style="color:#C8102E;border-bottom:2px solid #C8102E;padding-bottom:8px;margin:0 0 8px;font-size:28px;">${title}</h1><div style="color:#6b7280;font-size:12px;margin-bottom:24px;">Avtor: ${currentUser.name} • Datum: ${new Date().toLocaleDateString('sl-SI')}</div><div style="font-size:14px;">${content}</div><style>h1{font-size:24px;font-weight:700;margin:16px 0 8px;color:#C8102E;}h2{font-size:18px;font-weight:600;margin:14px 0 8px;color:#1f2937;}p{margin:8px 0;}ul{list-style:disc;padding-left:24px;margin:8px 0;}ol{list-style:decimal;padding-left:24px;margin:8px 0;}li{margin:4px 0;}</style>`;
      document.body.appendChild(container);
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      document.body.removeChild(container);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      const pageHeight = pdfHeight - 20;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const safeTitle = (title || 'dokument').replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '_').replace(/^_+|_+$/g, '');
      pdf.save(`${safeTitle || 'dokument'}.pdf`);
    } catch (err) {
      console.error('PDF napaka:', err);
      alert('Napaka pri PDF: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'pred trenutkom';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `pred ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `pred ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `pred ${days} dni`;
    return new Date(date).toLocaleDateString('sl-SI');
  };

  const notesInFolder = (folderId) => notes.filter(n => n.folder_id === folderId);
  const unfiledNotes = notes.filter(n => !n.folder_id);
  const childFolders = (parentId) => folders.filter(f => (f.parent_id || null) === parentId);
  const rootFolders = folders.filter(f => !f.parent_id || !folders.some(p => p.id === f.parent_id));

  const renderFolderNode = (folder, depth) => {
    const folderNotes = notesInFolder(folder.id);
    const isExpanded = expandedFolders[folder.id];
    const members = folderMembers(folder);
    const shared = folder.visible_to_all || members.length > 1;
    const newCount = folderNewCount(folder.id);
    const kids = childFolders(folder.id);
    const fColor = folder.color || '#b91c1c';
    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 p-2 cursor-pointer border-b border-gray-100 group transition-colors ${dragOverFolderId === folder.id ? 'bg-red-100 border-2 border-red-500' : 'hover:bg-gray-100'}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => toggleFolder(folder.id)}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id); }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => { e.preventDefault(); if (draggedNoteId) { moveNoteToFolder(draggedNoteId, folder.id); } setDragOverFolderId(null); setDraggedNoteId(null); }}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
          <Folder className="w-4 h-4 flex-shrink-0" style={{ color: fColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800 truncate">{folder.name}</span>
              {newCount > 0 && <span className="flex-shrink-0 text-[10px] font-bold text-white bg-red-600 rounded-full px-1.5 py-0.5 leading-none" title={`${newCount} novih/posodobljenih`}>{newCount} novo</span>}
            </div>
            {shared && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex -space-x-1">
                  {members.slice(0, 3).map(em => (
                    <span key={em} className="w-4 h-4 rounded-full border border-white text-[8px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: colorForEmail(em) }} title={personName(em)}>{personInitials(em)}</span>
                  ))}
                </div>
                <span className="text-[10px] text-gray-400">{folder.visible_to_all ? 'vsi' : `${members.length} ${members.length === 1 ? 'oseba' : members.length === 2 ? 'osebi' : 'oseb'}`}</span>
              </div>
            )}
          </div>
          {folder.visible_to_all ? <Users className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> : ((folder.allowed_emails && folder.allowed_emails.length > 0) ? <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> : <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />)}
          <span className="text-xs text-gray-400 flex-shrink-0">{folderNotes.length}</span>
          {canEditFolder(folder) && <button onClick={(e) => { e.stopPropagation(); openNewFolderModal(folder.id); }} className="text-gray-300 hover:text-green-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Dodaj podmapo"><FolderPlus className="w-3.5 h-3.5" /></button>}
          {canEditFolder(folder) && <button onClick={(e) => { e.stopPropagation(); openEditFolder(folder); }} className="text-gray-300 hover:text-blue-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Uredi mapo (dostop, barva)"><Users className="w-3.5 h-3.5" /></button>}
          {canEditFolder(folder) && <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id, folder.name); }} className="text-gray-300 hover:text-red-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Izbriši mapico"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
        {isExpanded && (
          <>
            {shared && (
              <div className="py-1 text-[11px] text-gray-500 bg-gray-50 border-b border-gray-100" style={{ paddingLeft: `${24 + depth * 14}px`, paddingRight: '8px' }}>
                👥 V mapi: {folder.visible_to_all ? 'vsi zaposleni' : members.map(personName).join(', ')}
              </div>
            )}
            {kids.map(k => renderFolderNode(k, depth + 1))}
            {folderNotes.map(n => renderNoteItem(n, true, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderNoteItem = (note, indent = false, depth = 0) => (
    <div
      key={note.id}
      draggable
      onDragStart={(e) => { setDraggedNoteId(note.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { setDraggedNoteId(null); setDragOverFolderId(null); }}
      onClick={() => selectNote(note)}
      style={indent ? { paddingLeft: `${24 + depth * 14}px` } : undefined}
      className={`p-2 border-b border-gray-100 cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors ${selectedNote?.id === note.id ? 'bg-red-50 border-l-4 border-l-red-700' : ''} ${draggedNoteId === note.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isNoteNew(note) && <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" title="Novo / posodobljeno" />}
            <div className={`text-sm truncate ${isNoteNew(note) ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>{note.title || 'Brez naslova'}</div>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{formatTimeAgo(note.updated_at)}</div>
        </div>
        <div className="flex items-center gap-0.5 relative">
          <button onClick={(e) => { e.stopPropagation(); setShowMoveMenu(showMoveMenu === note.id ? null : note.id); }} className="text-gray-400 hover:text-blue-600 p-1" title="Premakni"><Move className="w-3.5 h-3.5" /></button>
          <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-gray-400 hover:text-red-600 p-1" title="Izbriši"><Trash2 className="w-3.5 h-3.5" /></button>
          {showMoveMenu === note.id && (
            <div className="absolute right-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 border-b">Premakni v:</div>
              <button onClick={() => moveNoteToFolder(note.id, null)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-gray-400" />Brez mape</button>
              {folders.map(f => (
                <button key={f.id} onClick={() => moveNoteToFolder(note.id, f.id)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"><Folder className="w-4 h-4 text-red-600" />{f.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-2 sm:p-4" onClick={() => { setShowMoveMenu(null); setShowSymbols(false); setShowColorPicker(false); }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-7 h-7 text-red-700" />Beležnica</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => openNewFolderModal()} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"><FolderPlus className="w-4 h-4" /><span className="hidden sm:inline">Nova mapica</span></button>
          <button onClick={createNote} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"><Plus className="w-5 h-5" />Nov dokument</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <div className="md:col-span-1 lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50"><h3 className="text-sm font-semibold text-gray-700">Mapice in dokumenti</h3></div>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {loading ? (<div className="p-4 text-center text-gray-500 text-sm">Nalagam...</div>) : (
              <>
                {rootFolders.map(folder => renderFolderNode(folder, 0))}
                {unfiledNotes.length > 0 && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId('unfiled'); }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => { e.preventDefault(); if (draggedNoteId) { moveNoteToFolder(draggedNoteId, null); } setDragOverFolderId(null); setDraggedNoteId(null); }}
                  >
                    <div className={`flex items-center gap-1 p-2 border-b border-gray-100 transition-colors ${dragOverFolderId === 'unfiled' ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50'}`}><FolderOpen className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium text-gray-600 flex-1">Brez mape</span><span className="text-xs text-gray-400">{unfiledNotes.length}</span></div>
                    {unfiledNotes.map(n => renderNoteItem(n, true))}
                  </div>
                )}
                {notes.length === 0 && folders.length === 0 && (<div className="p-4 text-center text-gray-500 text-sm">Še nimaš dokumentov.<br />Klikni "Nov dokument".</div>)}
              </>
            )}
          </div>
        </div>
        <div className="md:col-span-2 lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {selectedNote ? (
            <>
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <input type="text" value={title} onChange={handleTitleChange} placeholder="Naslov dokumenta..." className="flex-1 px-3 py-2 text-lg font-semibold bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                  <button onClick={() => saveNote()} disabled={saving} className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50" title="Shrani"><Save className="w-4 h-4" /><span className="hidden sm:inline text-sm">{saving ? 'Shranjujem...' : 'Shrani'}</span></button>
                  <button onClick={exportToPDF} className="flex items-center gap-1 px-3 py-2 bg-red-700 text-white rounded hover:bg-red-800" title="Izvozi PDF"><Download className="w-4 h-4" /><span className="hidden sm:inline text-sm">PDF</span></button>
                </div>
                {lastSaved && (<div className="text-xs text-gray-500 mt-2">✓ Shranjeno {formatTimeAgo(lastSaved)}</div>)}
              </div>
              <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-white flex-wrap">
                <button onClick={() => exec('undo')} className="p-2 hover:bg-gray-100 rounded" title="Razveljavi"><Undo2 className="w-4 h-4" /></button>
                <button onClick={() => exec('redo')} className="p-2 hover:bg-gray-100 rounded" title="Ponovi"><Redo2 className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('bold')} className="p-2 hover:bg-gray-100 rounded" title="Krepko"><Bold className="w-4 h-4" /></button>
                <button onClick={() => exec('italic')} className="p-2 hover:bg-gray-100 rounded" title="Poševno"><Italic className="w-4 h-4" /></button>
                <button onClick={() => exec('underline')} className="p-2 hover:bg-gray-100 rounded" title="Podčrtano"><Underline className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('formatBlock', '<h1>')} className="p-2 hover:bg-gray-100 rounded" title="Naslov 1"><Heading1 className="w-4 h-4" /></button>
                <button onClick={() => exec('formatBlock', '<h2>')} className="p-2 hover:bg-gray-100 rounded" title="Naslov 2"><Heading2 className="w-4 h-4" /></button>
                <button onClick={() => exec('formatBlock', '<p>')} className="px-2 py-1 hover:bg-gray-100 rounded text-sm" title="Navadno">P</button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('insertUnorderedList')} className="p-2 hover:bg-gray-100 rounded" title="Seznam"><List className="w-4 h-4" /></button>
                <button onClick={() => exec('insertOrderedList')} className="p-2 hover:bg-gray-100 rounded" title="Oštevilčen seznam"><ListOrdered className="w-4 h-4" /></button>
                <button onClick={() => exec('indent')} className="p-2 hover:bg-gray-100 rounded" title="Zamik naprej (Tab)"><IndentIncrease className="w-4 h-4" /></button>
                <button onClick={() => exec('outdent')} className="p-2 hover:bg-gray-100 rounded" title="Zamik nazaj (Shift+Tab)"><IndentDecrease className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('justifyLeft')} className="p-2 hover:bg-gray-100 rounded" title="Poravnaj levo"><AlignLeft className="w-4 h-4" /></button>
                <button onClick={() => exec('justifyCenter')} className="p-2 hover:bg-gray-100 rounded" title="Sredinsko"><AlignCenter className="w-4 h-4" /></button>
                <button onClick={() => exec('justifyRight')} className="p-2 hover:bg-gray-100 rounded" title="Poravnaj desno"><AlignRight className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowSymbols(!showSymbols); setShowColorPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-1" title="Vstavi simbol / ikono"><Smile className="w-4 h-4" /></button>
                  {showSymbols && (
                    <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2" onClick={(e) => e.stopPropagation()} style={{ width: '232px' }}>
                      <div className="text-xs font-semibold text-gray-500 mb-1 px-1">Klikni za vstavljanje</div>
                      <div className="flex flex-wrap gap-0.5">
                        {SYMBOLS.map(s => (
                          <button key={s} onClick={() => insertSymbol(s)} className="w-8 h-8 text-lg hover:bg-gray-100 rounded flex items-center justify-center" title={`Vstavi ${s}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1" title="Velikost pisave (3–250 px)">
                  <input type="number" min="3" max="250" defaultValue="16" list="fs-presets"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFontSizePx(e.target.value); } }}
                    onBlur={(e) => applyFontSizePx(e.target.value)}
                    className="w-16 text-sm border border-gray-300 rounded px-2 py-1" />
                  <span className="text-xs text-gray-400">px</span>
                  <datalist id="fs-presets">
                    {[8, 10, 12, 14, 16, 18, 24, 32, 48, 64, 96, 150, 200, 250].map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <button onClick={() => exec('removeFormat')} className="p-2 hover:bg-gray-100 rounded" title="Počisti oblikovanje"><RemoveFormatting className="w-4 h-4" /></button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => setAuthorTags(v => !v)} className={`px-2 py-1.5 rounded text-xs font-semibold border ${authorTags ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-400'}`} title="Vklop/izklop samodejnih oznak avtorja">{authorTags ? '🏷️ Avtor: ON' : '🏷️ Avtor: OFF'}</button>
                <button onClick={removeAuthorHere} className="p-2 hover:bg-gray-100 rounded text-gray-500" title="Odstrani oznako avtorja na tem odstavku (postavi kurzor vanj)"><Trash2 className="w-4 h-4" /></button>
                <button onClick={clearAllAuthors} className="px-2 py-1.5 rounded text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-100" title="Odstrani VSE oznake avtorja v dokumentu">✕ vse oznake</button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <div className="flex items-center gap-1">
                  <Type className="w-4 h-4 text-gray-600" />
                  <select onChange={(e) => setFontFamily(e.target.value)} className="text-sm border border-gray-300 rounded px-1 py-1 bg-white hover:bg-gray-50 cursor-pointer" defaultValue="" title="Pisava">
                    <option value="" disabled>Pisava</option>
                    {FONT_OPTIONS.map(f => (<option key={f.label} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>))}
                  </select>
                </div>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowSymbols(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-1" title="Barva besedila"><Palette className="w-4 h-4" /></button>
                  {showColorPicker && (
                    <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                      <div className="text-xs font-semibold text-gray-500 mb-1">Barva besedila</div>
                      <input type="color" onChange={(e) => setColor(e.target.value)} className="w-32 h-9 cursor-pointer" />
                      <div className="flex gap-1 mt-2 flex-wrap" style={{ width: '128px' }}>
                        {['#000000', '#C8102E', '#1f2937', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#dc2626'].map(c => (
                          <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                      <div className="text-xs font-semibold text-gray-500 mt-3 mb-1 flex items-center gap-1"><Highlighter className="w-3 h-3" /> Označi (marker)</div>
                      <div className="flex gap-1 flex-wrap" style={{ width: '128px' }}>
                        {['#FEF08A', '#BBF7D0', '#BFDBFE', '#FECACA', '#E9D5FF', '#FED7AA', '#FFFFFF'].map(c => (
                          <button key={c} onClick={() => setHighlight(c)} className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={`Marker ${c}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {(() => {
                const cf = folders.find(f => f.id === selectedNote.folder_id);
                const mem = cf ? folderMembers(cf) : [];
                if (!cf || !(cf.visible_to_all || mem.length > 1)) return null;
                return (
                  <div className="px-4 py-1.5 border-b border-gray-100 bg-amber-50 text-xs text-amber-800 flex items-center gap-1">
                    ✍️ Skupna mapa — ob vsakem odstavku se samodejno zapiše, kdo ga je napisal.
                  </div>
                );
              })()}
              <div ref={editorRef} contentEditable onInput={handleEditorInput} onKeyDown={handleEditorKeyDown} onBlur={() => saveNote()} className={`flex-1 p-4 sm:p-6 overflow-y-auto focus:outline-none prose prose-sm max-w-none ${authorTags ? '' : 'hide-authors'}`} style={{ minHeight: '400px' }} suppressContentEditableWarning={true} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center"><FileText className="w-16 h-16 mx-auto text-gray-300 mb-3" /><p>Izberi dokument ali ustvari novega</p></div>
            </div>
          )}
        </div>
      </div>
      {/* Modal za novo/uredi mapico */}
      {showNewFolderModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeFolderModal(); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderPlus className="w-6 h-6 text-red-700" />
              <h3 className="text-lg font-bold text-gray-900">{editingFolder ? 'Uredi mapico' : 'Nova mapica'}</h3>
            </div>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveFolder(); if (e.key === 'Escape') closeFolderModal(); }}
              placeholder="npr. SESTANKI, JAGROS, MONTAŽA..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
            />

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Kdo vidi mapo</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setFolderVisibleToAll(false)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 ${!folderVisibleToAll ? 'text-white border-transparent bg-red-700' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  <Lock className="w-4 h-4" /> Samo izbrani
                </button>
                <button
                  type="button"
                  onClick={() => setFolderVisibleToAll(true)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 ${folderVisibleToAll ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'}`}
                  style={folderVisibleToAll ? { backgroundColor: '#059669' } : {}}
                >
                  <Users className="w-4 h-4" /> Vsi
                </button>
              </div>
              {!folderVisibleToAll && (
                <div className="border border-gray-200 rounded-lg p-2 max-h-52 overflow-y-auto space-y-1">
                  {(employees || []).filter(emp => emp.email !== currentUser?.email).map(emp => {
                    const checked = folderAllowedEmails.includes(emp.email);
                    return (
                      <label key={emp.email} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={checked} onChange={() => toggleAllowed(emp.email)} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                        <span className="text-gray-700 flex-1">{emp.name}</span>
                        <span className="text-xs text-gray-400">{emp.department}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Ti kot lastnik mapo vedno vidiš. Dokumenti brez mape so vedno zasebni.</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Barva mape</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                <button type="button" onClick={() => setFolderColor('')} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs ${!folderColor ? 'border-gray-800' : 'border-gray-200'}`} title="Privzeta"><Folder className="w-4 h-4" style={{ color: '#b91c1c' }} /></button>
                {FOLDER_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFolderColor(c)} className={`w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform ${folderColor === c ? 'border-gray-800' : 'border-white'}`} style={{ backgroundColor: c }} title={c} />
                ))}
                <input type="color" value={folderColor || '#b91c1c'} onChange={(e) => setFolderColor(e.target.value)} className="w-7 h-7 cursor-pointer rounded border border-gray-300" title="Poljubna barva" />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nadrejena mapa (za podmapo)</label>
              <select value={folderParentId || ''} onChange={(e) => setFolderParentId(e.target.value || null)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">— brez (glavna mapa) —</option>
                {folders.filter(f => canEditFolder(f) && (!editingFolder || f.id !== editingFolder.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Če izbereš nadrejeno mapo, bo ta mapa njena podmapa.</p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={closeFolderModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Prekliči
              </button>
              <button
                onClick={saveFolder}
                disabled={!newFolderName.trim() || savingFolder}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingFolder ? 'Shranjujem...' : (editingFolder ? 'Shrani' : 'Ustvari mapico')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        [contenteditable] h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #C8102E; }
        [contenteditable] h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.5rem; color: #1f2937; }
        [contenteditable] p { margin: 0.5rem 0; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] ul ul { list-style: circle; }
        [contenteditable] ul ul ul { list-style: square; }
        [contenteditable] ol ol { list-style: lower-alpha; }
        [contenteditable] ol ol ol { list-style: lower-roman; }
        [contenteditable] li { margin: 0.25rem 0; }
        [contenteditable] blockquote { margin: 0.5rem 0 0.5rem 1.5rem; padding-left: 0.75rem; border-left: 3px solid #e5e7eb; color: #374151; }
        [contenteditable] [data-author] { position: relative; }
        [contenteditable] [data-author]::before {
          content: attr(data-author);
          display: block;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--author-color, #9ca3af);
          opacity: 0.85;
          margin-bottom: 2px;
          user-select: none;
        }
        [contenteditable].hide-authors [data-author]::before { display: none; }
        [contenteditable] [data-author][data-cont]::before { display: none; }
        [contenteditable]:empty:before { content: 'Začni pisati...'; color: #9ca3af; }
      `}</style>
    </div>
  );
}
