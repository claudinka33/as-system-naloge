import React, { useState, useEffect } from 'react';
import { 
  FileText, Video, DollarSign, BookOpen, Image as ImageIcon, Award,
  Upload, Trash2, Download, ExternalLink, Search, X, Plus, Loader2,
  Calendar, User, Globe
} from 'lucide-react';
import { supabase } from './supabase.js';

const CATEGORIES = [
  { id: 'predstavitve', label: 'Predstavitve', icon: FileText, color: '#C8102E' },
  { id: 'video', label: 'Video', icon: Video, color: '#DC2626' },
  { id: 'ceniki', label: 'Ceniki', icon: DollarSign, color: '#059669' },
  { id: 'katalogi', label: 'Katalogi', icon: BookOpen, color: '#7C3AED' },
  { id: 'logotipi', label: 'Logotipi & branding', icon: ImageIcon, color: '#EA580C' },
  { id: 'certifikati', label: 'Certifikati', icon: Award, color: '#0891B2' }
];

const LANGUAGES = ['SI', 'EN', 'DE', 'HR', 'IT'];

function Gradiva({ currentUser, employees }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state za nov material
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'predstavitve',
    type: 'pdf',
    youtube_url: '',
    external_url: '',
    language: 'SI',
    file: null
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gradiva')
      .select('*')
      .order('created_at', { ascending: false });
    
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
      category: 'predstavitve',
      type: 'pdf',
      youtube_url: '',
      external_url: '',
      language: 'SI',
      file: null
    });
  };

  const handleAdd = async () => {
    if (!form.title.trim()) {
      alert('Vnesi naslov');
      return;
    }
    if (form.type === 'pdf' && !form.file) {
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
        const path = `${form.category}/${Date.now()}_${safeName}`;
        
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

      // Vstavi v gradiva tabelo
      const { error: insertError } = await supabase
        .from('gradiva')
        .insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category,
          type: form.type,
          file_url,
          file_name,
          file_size,
          youtube_url: form.type === 'youtube' ? form.youtube_url.trim() : null,
          external_url: form.type === 'link' ? form.external_url.trim() : null,
          language: form.language,
          created_by_email: currentUser.email,
          created_by_name: currentUser.name || currentUser.email
        });

      if (insertError) throw insertError;

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

  // Filter items
  const filteredItems = items.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && 
          !(item.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Count po kategorijah
  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = items.filter(i => i.category === cat.id).length;
    return acc;
  }, { all: items.length });

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
          onClick={() => setShowAddModal(true)}
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

      {/* Kategorije */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border ${
            activeCategory === 'all'
              ? 'text-white border-transparent shadow-sm'
              : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
          }`}
          style={activeCategory === 'all' ? {backgroundColor: '#C8102E'} : {}}
        >
          Vse
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeCategory === 'all' ? 'bg-white/20' : 'bg-as-gray-100'}`}>
            {counts.all}
          </span>
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border ${
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
              }`}
              style={active ? {backgroundColor: cat.color} : {}}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-as-gray-100'}`}>
                {counts[cat.id] || 0}
              </span>
            </button>
          );
        })}
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
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{color: '#C8102E'}}
            >
              + Dodaj prvo gradivo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredItems.map(item => {
            const cat = CATEGORIES.find(c => c.id === item.category);
            const Icon = cat?.icon || FileText;
            const isYoutube = item.type === 'youtube';
            const thumbnail = isYoutube ? getYoutubeThumbnail(item.youtube_url) : null;

            return (
              <div key={item.id} className="bg-white border border-as-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition group" style={{borderTop: `3px solid ${cat?.color || '#C8102E'}`}}>
                {/* Thumbnail / preview */}
                {isYoutube && thumbnail ? (
                  <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="block relative h-28 bg-as-gray-100">
                    <img src={thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition">
                      <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[11px] border-l-as-gray-800 border-y-[8px] border-y-transparent ml-1" />
                      </div>
                    </div>
                  </a>
                ) : (
                  <div className="h-28 flex items-center justify-center relative" style={{background: `linear-gradient(135deg, ${cat?.color || '#C8102E'}, ${(cat?.color || '#C8102E')}b3)`}}>
                    <Icon className="w-10 h-10 text-white" />
                    <span className="absolute bottom-1.5 right-2 text-[10px] font-bold uppercase tracking-wider text-white/80">{item.type}</span>
                  </div>
                )}

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-as-gray-800 line-clamp-2 flex-1">{item.title}</h3>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-as-gray-300 hover:text-red-500 transition p-1 -m-1"
                      title="Izbriši"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
              <h2 className="text-lg font-bold text-as-gray-800">Dodaj gradivo</h2>
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

              {/* Kategorija */}
              <div>
                <label className="block text-sm font-semibold text-as-gray-700 mb-1">Kategorija *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const active = form.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setForm({...form, category: cat.id})}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 border ${
                          active ? 'text-white border-transparent' : 'bg-white text-as-gray-600 border-as-gray-200 hover:bg-as-gray-50'
                        }`}
                        style={active ? {backgroundColor: cat.color} : {}}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
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
    </div>
  );
}

export default Gradiva;
