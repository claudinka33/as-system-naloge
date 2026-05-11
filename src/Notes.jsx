import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { FileText, Plus, Trash2, Download, Save, Bold, Italic, List, ListOrdered, Heading1, Heading2, Underline } from 'lucide-react';

export default function Notes({ currentUser }) {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Load notes
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_email', currentUser.email)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setNotes(data);
      if (data.length > 0 && !selectedNote) {
        selectNote(data[0]);
      }
    }
    setLoading(false);
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setTitle(note.title);
    setLastSaved(null);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = note.content || '';
      }
    }, 0);
  };

  const createNote = async () => {
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        user_email: currentUser.email,
        title: 'Nov dokument',
        content: ''
      }])
      .select()
      .single();

    if (!error && data) {
      setNotes([data, ...notes]);
      selectNote(data);
    }
  };

  const deleteNote = async (noteId) => {
    if (!confirm('Res želiš izbrisati ta dokument?')) return;

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (!error) {
      const newNotes = notes.filter(n => n.id !== noteId);
      setNotes(newNotes);
      if (selectedNote?.id === noteId) {
        if (newNotes.length > 0) {
          selectNote(newNotes[0]);
        } else {
          setSelectedNote(null);
          setTitle('');
        }
      }
    }
  };

  const saveNote = async (newTitle, newContent) => {
    if (!selectedNote) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('notes')
      .update({
        title: newTitle ?? title,
        content: newContent ?? (editorRef.current?.innerHTML || ''),
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedNote.id)
      .select()
      .single();

    if (!error && data) {
      setNotes(notes.map(n => n.id === data.id ? data : n));
      setSelectedNote(data);
      setLastSaved(new Date());
    }
    setSaving(false);
  };

  // Debounced auto-save on content change
  const handleContentChange = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 1500);
  };

  // Title change
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(e.target.value);
    }, 1500);
  };

  // Formatting commands
  const exec = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentChange();
  };

  // PDF Export - prenese kot fajl
  const exportToPDF = async () => {
    const content = editorRef.current?.innerHTML || '';
    setSaving(true);
    try {
      // Dinamično naloži jsPDF in html2canvas iz CDN
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('https://esm.sh/jspdf@2.5.2'),
        import('https://esm.sh/html2canvas@1.4.1')
      ]);

      // Ustvari skriti container z vsebino
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;padding:40px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.6;color:#111827;background:white;';
      container.innerHTML = `
        <h1 style="color:#C8102E;border-bottom:2px solid #C8102E;padding-bottom:8px;margin:0 0 8px;font-size:28px;">${title}</h1>
        <div style="color:#6b7280;font-size:12px;margin-bottom:24px;">
          Avtor: ${currentUser.name} • Datum: ${new Date().toLocaleDateString('sl-SI')}
        </div>
        <div style="font-size:14px;">${content}</div>
        <style>
          h1 { font-size: 24px; font-weight: 700; margin: 16px 0 8px; color: #C8102E; }
          h2 { font-size: 18px; font-weight: 600; margin: 14px 0 8px; color: #1f2937; }
          p { margin: 8px 0; }
          ul { list-style: disc; padding-left: 24px; margin: 8px 0; }
          ol { list-style: decimal; padding-left: 24px; margin: 8px 0; }
          li { margin: 4px 0; }
        </style>
      `;
      document.body.appendChild(container);

      // Render v canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });

      document.body.removeChild(container);

      // Generiraj PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin na vsako stran
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;
      const pageHeight = pdfHeight - 20;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Dodaj dodatne strani če je daljše od ene strani
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Sanitiziraj title za filename
      const safeTitle = (title || 'dokument').replace(/[^a-zA-Z0-9\u00C0-\u017F]+/g, '_').replace(/^_+|_+$/g, '');
      pdf.save(`${safeTitle || 'dokument'}.pdf`);
    } catch (err) {
      console.error('PDF export napaka:', err);
      alert('Napaka pri ustvarjanju PDF: ' + err.message);
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

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-red-700" />
          Beležnica
        </h2>
        <button
          onClick={createNote}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nov dokument
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Sidebar - seznam dokumentov */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Moji dokumenti ({notes.length})</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">Nalagam...</div>
            ) : notes.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Še nimaš dokumentov.<br />Klikni "Nov dokument".
              </div>
            ) : (
              notes.map(note => (
                <div
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedNote?.id === note.id ? 'bg-red-50 border-l-4 border-l-red-700' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {note.title || 'Brez naslova'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimeAgo(note.updated_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="text-gray-400 hover:text-red-600 p-1"
                      title="Izbriši"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {selectedNote ? (
            <>
              {/* Title + actions */}
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Naslov dokumenta..."
                    className="flex-1 px-3 py-2 text-lg font-semibold bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => saveNote()}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                    title="Shrani"
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm">{saving ? 'Shranjujem...' : 'Shrani'}</span>
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="flex items-center gap-1 px-3 py-2 bg-red-700 text-white rounded hover:bg-red-800"
                    title="Izvozi PDF"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm">PDF</span>
                  </button>
                </div>
                {lastSaved && (
                  <div className="text-xs text-gray-500 mt-2">
                    ✓ Shranjeno {formatTimeAgo(lastSaved)}
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-white flex-wrap">
                <button onClick={() => exec('bold')} className="p-2 hover:bg-gray-100 rounded" title="Krepko (Ctrl+B)">
                  <Bold className="w-4 h-4" />
                </button>
                <button onClick={() => exec('italic')} className="p-2 hover:bg-gray-100 rounded" title="Poševno (Ctrl+I)">
                  <Italic className="w-4 h-4" />
                </button>
                <button onClick={() => exec('underline')} className="p-2 hover:bg-gray-100 rounded" title="Podčrtano (Ctrl+U)">
                  <Underline className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('formatBlock', '<h1>')} className="p-2 hover:bg-gray-100 rounded" title="Naslov 1">
                  <Heading1 className="w-4 h-4" />
                </button>
                <button onClick={() => exec('formatBlock', '<h2>')} className="p-2 hover:bg-gray-100 rounded" title="Naslov 2">
                  <Heading2 className="w-4 h-4" />
                </button>
                <button onClick={() => exec('formatBlock', '<p>')} className="px-2 py-1 hover:bg-gray-100 rounded text-sm" title="Navadno besedilo">
                  P
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button onClick={() => exec('insertUnorderedList')} className="p-2 hover:bg-gray-100 rounded" title="Seznam">
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => exec('insertOrderedList')} className="p-2 hover:bg-gray-100 rounded" title="Oštevilčen seznam">
                  <ListOrdered className="w-4 h-4" />
                </button>
              </div>

              {/* Editor */}
              <div
                ref={editorRef}
                contentEditable
                onInput={handleContentChange}
                onBlur={() => saveNote()}
                className="flex-1 p-6 overflow-y-auto focus:outline-none prose prose-sm max-w-none"
                style={{ minHeight: '400px' }}
                suppressContentEditableWarning={true}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                <p>Izberi dokument ali ustvari novega</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline styles za contentEditable */}
      <style>{`
        [contenteditable] h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #C8102E; }
        [contenteditable] h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.5rem; color: #1f2937; }
        [contenteditable] p { margin: 0.5rem 0; }
        [contenteditable] ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        [contenteditable] li { margin: 0.25rem 0; }
        [contenteditable]:empty:before {
          content: 'Začni pisati...';
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
