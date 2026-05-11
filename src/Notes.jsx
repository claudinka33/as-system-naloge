import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { FileText, Plus, Trash2, Download, Save, Bold, Italic, List, ListOrdered, Heading1, Heading2, Underline, Folder, FolderPlus, ChevronRight, ChevronDown, FolderOpen, Type, Palette, Move } from 'lucide-react';

const FONT_OPTIONS = [
  { label: 'Sans-serif', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"Courier New", Consolas, monospace' },
  { label: 'Rokopis', value: '"Comic Sans MS", "Brush Script MT", cursive' }
];

export default function Notes({ currentUser }) {
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
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [foldersRes, notesRes] = await Promise.all([
      supabase.from('note_folders').select('*').eq('user_email', currentUser.email).order('created_at', { ascending: true }),
      supabase.from('notes').select('*').eq('user_email', currentUser.email).order('updated_at', { ascending: false })
    ]);
    if (!foldersRes.error && foldersRes.data) {
      setFolders(foldersRes.data);
      const exp = {};
      foldersRes.data.forEach(f => { exp[f.id] = true; });
      setExpandedFolders(exp);
    }
    if (!notesRes.error && notesRes.data) {
      setNotes(notesRes.data);
      if (notesRes.data.length > 0 && !selectedNote) selectNote(notesRes.data[0]);
    }
    setLoading(false);
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setLastSaved(null);
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = note.content || '';
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

  const openNewFolderModal = () => {
    setNewFolderName('');
    setShowNewFolderModal(true);
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const { data, error } = await supabase.from('note_folders').insert([{ user_email: currentUser.email, name }]).select().single();
    if (!error && data) {
      setFolders([...folders, data]);
      setExpandedFolders({ ...expandedFolders, [data.id]: true });
      setShowNewFolderModal(false);
      setNewFolderName('');
    }
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

  const renderNoteItem = (note, indent = false) => (
    <div
      key={note.id}
      draggable
      onDragStart={(e) => { setDraggedNoteId(note.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { setDraggedNoteId(null); setDragOverFolderId(null); }}
      onClick={() => selectNote(note)}
      className={`p-2 border-b border-gray-100 cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors ${selectedNote?.id === note.id ? 'bg-red-50 border-l-4 border-l-red-700' : ''} ${indent ? 'pl-6' : ''} ${draggedNoteId === note.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">{note.title || 'Brez naslova'}</div>
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
    <div className="max-w-7xl mx-auto p-4" onClick={() => setShowMoveMenu(null)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText className="w-7 h-7 text-red-700" />Beležnica</h2>
        <div className="flex items-center gap-2">
          <button onClick={openNewFolderModal} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"><FolderPlus className="w-4 h-4" /><span className="hidden sm:inline">Nova mapica</span></button>
          <button onClick={createNote} className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"><Plus className="w-5 h-5" />Nov dokument</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50"><h3 className="text-sm font-semibold text-gray-700">Mapice in dokumenti</h3></div>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {loading ? (<div className="p-4 text-center text-gray-500 text-sm">Nalagam...</div>) : (
              <>
                {folders.map(folder => {
                  const folderNotes = notesInFolder(folder.id);
                  const isExpanded = expandedFolders[folder.id];
                  return (
                    <div key={folder.id}>
                      <div
                        className={`flex items-center gap-1 p-2 cursor-pointer border-b border-gray-100 group transition-colors ${dragOverFolderId === folder.id ? 'bg-red-100 border-2 border-red-500' : 'hover:bg-gray-100'}`}
                        onClick={() => toggleFolder(folder.id)}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolderId(folder.id); }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => { e.preventDefault(); if (draggedNoteId) { moveNoteToFolder(draggedNoteId, folder.id); } setDragOverFolderId(null); setDraggedNoteId(null); }}
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                        <Folder className="w-4 h-4 text-red-700" />
                        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{folder.name}</span>
                        <span className="text-xs text-gray-400">{folderNotes.length}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id, folder.name); }} className="text-gray-300 hover:text-red-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Izbriši mapico"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {isExpanded && folderNotes.map(n => renderNoteItem(n, true))}
                    </div>
                  );
                })}
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
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
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
                  <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-1" title="Barva besedila"><Palette className="w-4 h-4" /></button>
                  {showColorPicker && (
                    <div className="absolute top-10 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2" onClick={(e) => e.stopPropagation()}>
                      <input type="color" onChange={(e) => setColor(e.target.value)} className="w-32 h-10 cursor-pointer" />
                      <div className="flex gap-1 mt-2 flex-wrap" style={{ width: '128px' }}>
                        {['#000000', '#C8102E', '#1f2937', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#dc2626'].map(c => (
                          <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div ref={editorRef} contentEditable onInput={handleContentChange} onBlur={() => saveNote()} className="flex-1 p-6 overflow-y-auto focus:outline-none prose prose-sm max-w-none" style={{ minHeight: '400px' }} suppressContentEditableWarning={true} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center"><FileText className="w-16 h-16 mx-auto text-gray-300 mb-3" /><p>Izberi dokument ali ustvari novega</p></div>
            </div>
          )}
        </div>
      </div>
      {/* Modal za novo mapico */}
      {showNewFolderModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewFolderModal(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderPlus className="w-6 h-6 text-red-700" />
              <h3 className="text-lg font-bold text-gray-900">Nova mapica</h3>
            </div>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolderModal(false); }}
              placeholder="npr. SESTANKI, JAGROS, MONTAŽA..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Prekliči
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Ustvari mapico
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
        [contenteditable] li { margin: 0.25rem 0; }
        [contenteditable]:empty:before { content: 'Začni pisati...'; color: #9ca3af; }
      `}</style>
    </div>
  );
}
