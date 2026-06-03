import React, { useState, useEffect } from 'react';
import { 
  FileText, Video, DollarSign, BookOpen, Image as ImageIcon, Award,
  Upload, Trash2, Edit2, Download, ExternalLink, Search, X, Plus, Loader2,
  Calendar, User, Globe, Folder, Settings, Users, Check, Lock
} from 'lucide-react';
import { supabase } from './supabase.js';
import { ADMIN_EMAILS } from './constants.js';

const FOLDER_COLORS = ['#C8102E', '#DC2626', '#EA580C', '#059669', '#0891B2', '#7C3AED', '#1E40AF', '#854D0E', '#475569'];

const LANGUAGES = ['SI', 'EN', 'DE', 'HR', 'IT'];

function Gradiva({ currentUser, employees }) {
  const isAdmin = ADMIN_EMAILS.includes(currentUser?.email);

  const [folders, setFolders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Mape (folder) modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderForm, setFolderForm] = useState({ name: '', color: FOLDER_COLORS[0], visible_to_all: true, allowed_emails: [] });
  const [savingFolder, setSavingFolder] = useState(false);

  // Form state za nov material
  const [form, setForm] = useState({
    title: '',
    description: '',
    folder_id: null,
    type: 'pdf',
    youtube_url: '',
    external_url: '',
    language: 'SI',
    file: null,
    cover: null
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const [{ data: fData, error: fErr }, { data, error }] = await Promise.all([
      supabase.from('gradiva_folders').select('*').order('created_at', { ascending: true }),
      supabase.from('gradiva').select('*').order('created_at', { ascending: false }),
    ]);
    if (fErr) console.error('Napaka pri nalaganju map:', fErr);
    else setFolders(fData || []);
    if (error) {
      console.error('Napaka pri nalaganju:', error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      folder_id: (activeFolder !== 'all' ? activeFolder : (visibleFolders[0]?.id ?? null)),
      type: 'pdf',
      youtube_url: '',
      external_url: '',
      language: 'SI',
      file: null,
      cover: null
    });
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!form.title.trim()) {
      alert('Vnesi naslov');
      return;
    }
    if (!form.folder_id) {
      alert('Izberi mapo');
      return;
    }
    if (form.type === 'pdf' && !form.file && !editingId) {
      alert('Izberi PDF datoteko');
      return;
    }
    if (form.type === 'youtube' && !form.youtube_url.trim()) {
      alert('Vnesi YouTube povezavo');
      return;
    }
    if (form.type === 'link' && !form.external_url.trim()) {
      alert('Vnesi spletno povezavo');
      return;
    }

    setUploading(true);

    try {
      let file_url = null;
      let file_name = null;
      let file_size = null;

      // Upload PDF/image v Supabase Storage
      if ((form.type === 'pdf' || form.type === 'image') && form.file) {
        const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${form.folder_id}/${Date.now()}_${safeName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('gradiva')
          .upload(path, form.file);
        
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('gradiva')
          .getPublicUrl(path);
        
        file_url = urlData.publicUrl;
        file_name = form.file.name;
        file_size = form.file.size;
      }

      // Upload naslovne slike (cover) ce obstaja
      let cover_url = null;
      if (form.cover) {
        const safeCover = form.cover.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const coverPath = `covers/${Date.now()}_${safeCover}`;
        const { error: coverErr } = await supabase.storage.from('gradiva').upload(coverPath, form.cover);
        if (coverErr) throw coverErr;
        const { data: coverUrlData } = supabase.storage.from('gradiva').getPublicUrl(coverPath);
        cover_url = coverUrlData.publicUrl;
      }

      // Skupna polja
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        folder_id: form.folder_id,
        type: form.type,
        youtube_url: form.type === 'youtube' ? form.youtube_url.trim() : null,
        external_url: form.type === 'link' ? form.external_url.trim() : null,
        language: form.language
      };
      // Datoteko/cover dodamo le ce je bila nova nalozena
      if (file_url) { payload.file_url = file_url; payload.file_name = file_name; payload.file_size = file_size; }
      if (cover_url) { payload.cover_url = cover_url; }

      if (editingId) {
        const { error: updErr } = await supabase
          .from('gradiva')
          .update(payload)
          .eq('id', editingId);
        if (updErr) throw updErr;
      } else {
        payload.created_by_email = currentUser.email;
        payload.created_by_name = currentUser.name || currentUser.email;
        const { error: insertError } = await supabase
          .from('gradiva')
          .insert(payload);
        if (insertError) throw insertError;
      }

      await loadItems();
      resetForm();
      setShowAddModal(false);
    } catch (err) {
      console.error('Napaka:', err);
      alert('Napaka pri shranjevanju: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      folder_id: item.folder_id || null,
      type: item.type || 'pdf',
      youtube_url: item.youtube_url || '',
      external_url: item.external_url || '',
      language: item.language || 'SI',
      file: null,
      cover: null
    });
    setShowAddModal(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`Res želiš izbrisati "${item.title}"?`)) return;

    try {
      // Izbriši storage file če obstaja
      if (item.file_url && item.file_url.includes('/storage/v1/object/public/gradiva/')) {
        const path = item.file_url.split('/storage/v1/object/public/gradiva/')[1];
        if (path) {
          await supabase.storage.from('gradiva').remove([path]);
        }
      }

      if (item.cover_url && item.cover_url.includes('/storage/v1/object/public/gradiva/')) {
        const cpath = item.cover_url.split('/storage/v1/object/public/gradiva/')[1];
        if (cpath) {
          await supabase.storage.from('gradiva').remove([cpath]);
        }
      }

      const { error } = await supabase
        .from('gradiva')
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;
      
      await loadItems();
    } catch (err) {
      console.error('Napaka:', err);
      alert('Napaka pri brisanju: ' + err.message);
    }
  };

  // === Vidnost map ===
  const canSeeFolder = (f) => {
    if (!f) return false;
    if (isAdmin) return true;
    if (f.visible_to_all) return true;
    if (f.created_by_email && f.created_by_email === currentUser?.email) return true;
    return (f.allowed_emails || []).includes(currentUser?.email);
  };
  const canEditFolder = (f) => !!f && (isAdmin || (f.created_by_email && f.created_by_email === currentUser?.email));
  const visibleFolders = folders.filter(canSeeFolder);
  const visibleFolderIds = new Set(visibleFolders.map(f => f.id));
  const getFolder = (id) => folders.find(f => f.id === id) || null;

  // === Mape: ustvari / uredi / izbriši ===
  const openNewFolder = () => {
    setEditingFolder(null);
    setFolderForm({ name: '', color: FOLDER_COLORS[0], visible_to_all: true, allowed_emails: [] });
    setShowFolderModal(true);
  };
  const openEditFolder = (f) => {
    setEditingFolder(f);
    setFolderForm({ name: f.name || '', color: f.color || FOLDER_COLORS[0], visible_to_all: !!f.visible_to_all, allowed_emails: f.allowed_emails || [] });
    setShowFolderModal(true);
  };
  const toggleAllowed = (email) => {
    setFolderForm(prev => ({
      ...prev,
      allowed_emails: prev.allowed_emails.includes(email)
        ? prev.allowed_emails.filter(e => e !== email)
        : [...prev.allowed_emails, email]
    }));
  };
  const saveFolder = async () => {
    if (!folderForm.name.trim()) { alert('Vnesi ime mape'); return; }
    setSavingFolder(true);
    try {
      const payload = {
        name: folderForm.name.trim(),
        color: folderForm.color,
        visible_to_all: folderForm.visible_to_all,
        allowed_emails: folderForm.visible_to_all ? [] : folderForm.allowed_emails,
      };
      if (editingFolder) {
        const { error } = await supabase.from('gradiva_folders').update(payload).eq('id', editingFolder.id);
        if (error) throw error;
      } else {
        payload.created_by_email = currentUser.email;
        payload.created_by_name = currentUser.name || currentUser.email;
        const { error } = await supabase.from('gradiva_folders').insert(payload);
        if (error) throw error;
      }
      await loadItems();
      setShowFolderModal(false);
      setEditingFolder(null);
    } catch (e) {
      alert('Napaka pri shranjevanju mape: ' + e.message);
    } finally {
      setSavingFolder(false);
    }
  };
  const deleteFolder = async (f) => {
    const cnt = items.filter(i => i.folder_id === f.id).length;
    if (cnt > 0) { alert(`Mapa "${f.name}" ni prazna (${cnt} gradiv). Najprej premakni ali izbriši gradiva.`); return; }
    if (!confirm(`Izbrišem mapo "${f.name}"?`)) return;
    const { error } = await supabase.from('gradiva_folders').delete().eq('id', f.id);
    if (error) { alert('Napaka pri brisanju mape: ' + error.message); return; }
    if (activeFolder === f.id) setActiveFolder('all');
    setShowFolderModal(false);
    setEditingFolder(null);
    await loadItems();
  };

  // Filter items (samo iz vidnih map)
  const filteredItems = items.filter(item => {
    if (!isAdmin && !visibleFolderIds.has(item.folder_id)) return false;
    if (activeFolder !== 'all' && item.folder_id !== activeFolder) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && 
          !(item.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Count po mapah
  const counts = visibleFolders.reduce((acc, f) => {
    acc[f.id] = items.filter(i => i.folder_id === f.id).length;
    return acc;
  }, { all: items.filter(i => isAdmin || visibleFolderIds.has(i.folder_id)).length });

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getYoutubeThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  };

  return (
    <div className="w-full py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{backgroundColor: '#C8102E'}}>
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-as-gray-800">Gradiva</h1>
            <p className="text-sm text-as-gray-500">Predstavitve, ceniki, katalogi, video</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="px-4 py-2 text-white font-semibold rounded-lg flex items-center gap-2 hover:opacity-90 transition shadow-sm"
          style={{backgroundColor: '#C8102E'}}
        >
          <Plus className="w-4 h-4" />
          Dodaj gradivo
        </button>
      </div>

      {/* Iskanje */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-as-gray-400" />
          <input
            type="text"
            placeholder="Iskanje gradiv..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
          />
        </div>
      </div>

      {/* Mape */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <button
          onClick={() => setActiveFolder('all')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border shadow-sm hover:opacity-90"
          style={activeFolder === 'all'
            ? {backgroundColor: '#374151', color: '#fff', borderColor: 'transparent'}
            : {backgroundColor: '#37415112', color: '#374151', borderColor: '#37415140'}}
        >
          <Folder className="w-4 h-4" />
          Vse
          <span className="text-xs px-2 py-0.5 rounded-full" style={activeFolder === 'all' ? {backgroundColor: 'rgba(255,255,255,0.25)'} : {backgroundColor: '#37415122'}}>
            {counts.all || 0}
          </span>
        </button>
        {visibleFolders.map(f => {
          const active = activeFolder === f.id;
          const col = f.color || '#C8102E';
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.id)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border shadow-sm hover:opacity-90"
              style={active
                ? {backgroundColor: col, color: '#fff', borderColor: 'transparent'}
                : {backgroundColor: col + '12', color: col, borderColor: col + '40'}}
            >
              <Folder className="w-4 h-4" />
              {f.name}
              {!f.visible_to_all && <Lock className="w-3 h-3 opacity-70" />}
              <span className="text-xs px-2 py-0.5 rounded-full" style={active ? {backgroundColor: 'rgba(255,255,255,0.25)'} : {backgroundColor: col + '22'}}>
                {counts[f.id] || 0}
              </span>
              {canEditFolder(f) && (
                <span
                  onClick={(e) => { e.stopPropagation(); openEditFolder(f); }}
                  className="ml-1 -mr-1 p-0.5 rounded hover:bg-black/10 cursor-pointer"
                  title="Uredi mapo / vidnost"
                >
                  <Settings className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={openNewFolder}
          className="px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 border border-dashed border-as-gray-300 text-as-gray-500 hover:bg-as-gray-50"
        >
          <Plus className="w-4 h-4" /> Nova mapa
        </button>
      </div>

      {/* Vsebina */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
          <p className="text-as-gray-500 font-medium">
            {searchQuery ? 'Ni rezultatov za iskano.' : 'Še ni dodanih gradiv v tej kategoriji.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{color: '#C8102E'}}
            >
              + Dodaj prvo gradivo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map(item => {
            const folder = getFolder(item.folder_id);
            const cat = folder ? { color: folder.color, label: folder.name } : { color: '#C8102E', label: '—' };
            const Icon = Folder;
            const isYoutube = item.type === 'youtube';
            const thumbnail = isYoutube ? getYoutubeThumbnail(item.youtube_url) : null;

            return (
              <div key={item.id} className="bg-white border border-as-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition group" style={{borderTop: `3px solid ${cat?.color || '#C8102E'}`}}>
                {/* Thumbnail / preview (A4 portret) */}
                {item.cover_url ? (
                  <div className="relative w-full bg-as-gray-100 aspect-[210/297]">
                    <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
                    {isYoutube && (
                      <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/30 transition">
                        <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[11px] border-l-as-gray-800 border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </a>
                    )}
                  </div>
                ) : isYoutube && thumbnail ? (
                  <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="block relative w-full bg-as-gray-100 aspect-[210/297]">
                    <img src={thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition">
                      <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[11px] border-l-as-gray-800 border-y-[8px] border-y-transparent ml-1" />
                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="aspect-[210/297] w-full flex items-center justify-center relative" style={{background: `linear-gradient(135deg, ${cat?.color || '#C8102E'}, ${(cat?.color || '#C8102E')}b3)`}}>
                    <Icon className="w-14 h-14 text-white" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold uppercase tracking-wider text-white/80">{item.type}</span>
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-as-gray-800 line-clamp-2 flex-1">{item.title}</h3>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-as-gray-300 hover:text-as-red-600 transition p-1 -m-1"
                        title="Uredi"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-as-gray-300 hover:text-red-500 transition p-1 -m-1"
                        title="Izbriši"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-sm text-as-gray-500 line-clamp-2 mb-3">{item.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-as-gray-400 mb-3 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: (cat?.color || '#C8102E') + '15', color: cat?.color || '#C8102E'}}>
                      {cat?.label || item.category}
                    </span>
                    {item.language && (
                      <span className="px-2 py-0.5 rounded-full bg-as-gray-100 font-medium flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {item.language}
                      </span>
                    )}
                    {item.file_size && (
                      <span>{formatFileSize(item.file_size)}</span>
                    )}
                  </div>

                  {/* Akcije */}
                  <div className="flex gap-2">
                    {item.type === 'pdf' && item.file_url && (
                      <>
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition flex items-center justify-center gap-1"
                          style={{backgroundColor: '#C8102E'}}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Odpri
                        </a>
                        <a
                          href={item.file_url}
                          download={item.file_name}
                          className="px-3 py-2 text-sm font-semibold bg-as-gray-100 text-as-gray-700 rounded-lg hover:bg-as-gray-200 transition flex items-center gap-1"
                          title="Prenesi"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    {item.type === 'youtube' && (
                      <a
                        href={item.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition flex items-center justify-center gap-1"
                        style={{backgroundColor: '#DC2626'}}
                      >
                        <Video className="w-3.5 h-3.5" />
                        Predvajaj
                      </a>
                    )}
                    {item.type === 'link' && (
                      <a
                        href={item.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition flex items-center justify-center gap-1"
                        style={{backgroundColor: '#C8102E'}}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Odpri povezavo
                      </a>
                    )}
                    {item.type === 'image' && item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition flex items-center justify-center gap-1"
                        style={{backgroundColor: '#C8102E'}}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Odpri sliko
                      </a>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-as-gray-100 flex items-center justify-between text-xs text-as-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.created_by_name || item.created_by_email}
                    </span>
                    <span>{new Date(item.created_at).toLocaleDateString('sl-SI')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL — Dodaj gradivo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-as-gray-800">{editingId ? 'Uredi gradivo' : 'Dodaj gradivo'}</h2>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-as-gray-400 hover:text-as-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Naslov */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Naslov *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="npr. Predstavitev AS system 2026"
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
                />
              </div>

              {/* Opis */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Opis</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Kratek opis vsebine..."
                  rows={2}
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400 resize-none"
                />
              </div>

              {/* Mapa */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Mapa *</label>
                {visibleFolders.length === 0 ? (
                  <p className="text-sm text-as-gray-500">Najprej ustvari mapo (gumb „Nova mapa").</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {visibleFolders.map(f => {
                      const active = form.folder_id === f.id;
                      const col = f.color || '#C8102E';
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setForm({...form, folder_id: f.id})}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border ${
                            active ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
                          }`}
                          style={active ? {backgroundColor: col} : {}}
                        >
                          <Folder className="w-4 h-4" />
                          <span className="text-xs">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tip */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Tip gradiva *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'pdf', label: 'PDF', icon: FileText },
                    { id: 'youtube', label: 'YouTube', icon: Video },
                    { id: 'image', label: 'Slika', icon: ImageIcon },
                    { id: 'link', label: 'Povezava', icon: ExternalLink }
                  ].map(t => {
                    const Icon = t.icon;
                    const active = form.type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setForm({...form, type: t.id, file: null})}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border justify-center ${
                          active ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
                        }`}
                        style={active ? {backgroundColor: '#C8102E'} : {}}
                      >
                        <Icon className="w-4 h-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PDF / Image upload */}
              {(form.type === 'pdf' || form.type === 'image') && (
                <div>
                  <label className="block text-sm font-semibold text-as-gray-700 mb-1">
                    {form.type === 'pdf' ? 'PDF datoteka *' : 'Slika *'}
                    {editingId && <span className="font-normal text-as-gray-400"> — pusti prazno za obstojeco</span>}
                  </label>
                  <input
                    type="file"
                    accept={form.type === 'pdf' ? '.pdf' : 'image/*'}
                    onChange={(e) => setForm({...form, file: e.target.files[0] || null})}
                    className="w-full px-3 py-2 border border-as-gray-200 rounded-lg file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-as-gray-100 file:text-as-gray-700 file:font-semibold file:cursor-pointer file:text-sm"
                  />
                  {form.file && (
                    <p className="text-xs text-as-gray-500 mt-1">
                      {form.file.name} ({formatFileSize(form.file.size)})
                    </p>
                  )}
                </div>
              )}

              {/* Naslovna slika (cover) — neobvezno */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Naslovna slika (neobvezno)</label>
                <p className="text-xs text-as-gray-400 mb-1">Ce jo nalozis, se prikaze na kartici (A4). Sicer barvni blok.</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setForm({...form, cover: e.target.files[0] || null})}
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-as-gray-100 file:text-as-gray-700 file:font-semibold file:cursor-pointer file:text-sm"
                />
                {form.cover && (
                  <p className="text-xs text-as-gray-500 mt-1">{form.cover.name} ({formatFileSize(form.cover.size)})</p>
                )}
              </div>

              {/* YouTube URL */}
              {form.type === 'youtube' && (
                <div>
                  <label className="block text-sm font-semibold text-as-gray-700 mb-1">YouTube povezava *</label>
                  <input
                    type="url"
                    value={form.youtube_url}
                    onChange={(e) => setForm({...form, youtube_url: e.target.value})}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
                  />
                </div>
              )}

              {/* External link */}
              {form.type === 'link' && (
                <div>
                  <label className="block text-sm font-semibold text-as-gray-700 mb-1">Spletna povezava *</label>
                  <input
                    type="url"
                    value={form.external_url}
                    onChange={(e) => setForm({...form, external_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
                  />
                </div>
              )}

              {/* Jezik */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Jezik</label>
                <div className="flex gap-2 flex-wrap">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setForm({...form, language: lang})}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition border ${
                        form.language === lang ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
                      }`}
                      style={form.language === lang ? {backgroundColor: '#C8102E'} : {}}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                disabled={uploading}
                className="px-4 py-2 text-sm font-semibold text-as-gray-600 hover:bg-as-gray-100 rounded-lg transition disabled:opacity-50"
              >
                Prekliči
              </button>
              <button
                onClick={handleAdd}
                disabled={uploading}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                style={{backgroundColor: '#C8102E'}}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Nalagam...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Shrani
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — Mapa */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-as-gray-800">{editingFolder ? 'Uredi mapo' : 'Nova mapa'}</h2>
              <button onClick={() => { setShowFolderModal(false); setEditingFolder(null); }} className="text-as-gray-400 hover:text-as-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Ime */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Ime mape *</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({...folderForm, name: e.target.value})}
                  placeholder="npr. Interni dokumenti"
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
                />
              </div>

              {/* Barva */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Barva</label>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFolderForm({...folderForm, color: c})}
                      className="w-8 h-8 rounded-lg border-2 transition"
                      style={{ backgroundColor: c, borderColor: folderForm.color === c ? '#111827' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>

              {/* Vidnost */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Kdo vidi mapo</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFolderForm({...folderForm, visible_to_all: true})}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 ${folderForm.visible_to_all ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200'}`}
                    style={folderForm.visible_to_all ? {backgroundColor: '#059669'} : {}}
                  >
                    <Users className="w-4 h-4" /> Vsi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderForm({...folderForm, visible_to_all: false})}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 ${!folderForm.visible_to_all ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200'}`}
                    style={!folderForm.visible_to_all ? {backgroundColor: '#C8102E'} : {}}
                  >
                    <Lock className="w-4 h-4" /> Izbrani
                  </button>
                </div>
                {!folderForm.visible_to_all && (
                  <div className="border border-as-gray-200 rounded-lg p-2 max-h-52 overflow-y-auto space-y-1">
                    {(employees || []).map(emp => {
                      const checked = folderForm.allowed_emails.includes(emp.email);
                      return (
                        <label key={emp.email} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-as-gray-50 cursor-pointer text-sm">
                          <input type="checkbox" checked={checked} onChange={() => toggleAllowed(emp.email)} className="w-4 h-4" style={{accentColor: '#C8102E'}} />
                          <span className="text-as-gray-700">{emp.name}</span>
                          <span className="text-xs text-as-gray-400">{emp.department}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-as-gray-400 mt-1">Admin in lastnik mape vedno vidita mapo.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-between gap-2">
              <div>
                {editingFolder && canEditFolder(editingFolder) && (
                  <button onClick={() => deleteFolder(editingFolder)} className="px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Izbriši mapo
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowFolderModal(false); setEditingFolder(null); }} disabled={savingFolder} className="px-4 py-2 text-sm font-semibold text-as-gray-600 hover:bg-as-gray-100 rounded-lg transition disabled:opacity-50">Prekliči</button>
                <button onClick={saveFolder} disabled={savingFolder} className="px-4 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2" style={{backgroundColor: '#C8102E'}}>
                  {savingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Shrani mapo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Gradiva;
