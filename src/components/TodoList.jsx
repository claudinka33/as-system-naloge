import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ListTodo, Plus, Check, X, Pencil } from 'lucide-react';

// barvni akcenti za vrstice (rotirajo se po vrsti)
const ACCENTS = ['#C8102E', '#E8833A', '#2E7D5B', '#2B6CB0', '#7C3AED'];
const accentFor = (id) => ACCENTS[Number(String(id).slice(-1)) % ACCENTS.length];

export default function TodoList({ currentUser }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');

  const email = currentUser?.email;

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setItems(data || []);
    })();
    return () => { cancelled = true; };
  }, [email]);

  const addTodo = async () => {
    const t = text.trim();
    if (!t || !email) return;
    setText('');
    setErr('');
    const { data, error } = await supabase
      .from('todos')
      .insert([{ user_email: email, text: t }])
      .select()
      .single();
    if (error) { setErr(error.message); setText(t); return; }
    if (data) setItems(prev => [data, ...prev]);
  };

  const toggleTodo = async (item) => {
    const done = !item.done;
    const completed_at = done ? new Date().toISOString() : null;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done, completed_at } : i));
    const { error } = await supabase.from('todos').update({ done, completed_at }).eq('id', item.id);
    if (error) setErr(error.message);
  };

  const startEdit = (item) => { setEditId(item.id); setEditText(item.text); };
  const cancelEdit = () => { setEditId(null); setEditText(''); };

  const saveEdit = async (item) => {
    const t = editText.trim();
    if (!t || t === item.text) { cancelEdit(); return; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, text: t } : i));
    cancelEdit();
    const { error } = await supabase.from('todos').update({ text: t }).eq('id', item.id);
    if (error) setErr(error.message);
  };

  const deleteTodo = async (id) => {
    if (!window.confirm('Izbrišem to opravilo?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) setErr(error.message);
  };

  const clearDone = async () => {
    const ids = items.filter(i => i.done).map(i => i.id);
    if (!ids.length) return;
    if (!window.confirm(`Izbrišem ${ids.length} opravljenih?`)) return;
    setItems(prev => prev.filter(i => !i.done));
    await supabase.from('todos').delete().in('id', ids);
  };

  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  const renderRow = (item) => {
    const isEditing = editId === item.id;
    const accent = item.done ? '#9CA3AF' : accentFor(item.id);

    if (isEditing) {
      return (
        <div key={item.id} className="flex items-center gap-1.5 py-0.5">
          <input
            type="text"
            value={editText}
            autoFocus
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(item);
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={() => saveEdit(item)}
            className="flex-1 px-2.5 py-1.5 border-2 rounded-lg text-[13px] focus:outline-none"
            style={{ borderColor: accent }}
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => saveEdit(item)}
            className="p-1.5 rounded-lg text-white shadow-sm"
            style={{ backgroundColor: accent }}
            title="Shrani"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className="group flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg transition"
        style={{
          borderLeft: `3px solid ${accent}`,
          backgroundColor: item.done ? '#F9FAFB' : `${accent}0D`,
        }}
      >
        <button
          onClick={() => toggleTodo(item)}
          className="w-[18px] h-[18px] rounded-md flex-shrink-0 flex items-center justify-center transition"
          style={item.done
            ? { backgroundColor: accent }
            : { border: `2px solid ${accent}`, backgroundColor: '#fff' }}
          title={item.done ? 'Vrni med odprta' : 'Označi kot opravljeno'}
        >
          {item.done && <Check className="w-3 h-3 text-white" />}
        </button>

        <span
          onClick={() => startEdit(item)}
          className={`flex-1 text-[13px] break-words leading-snug cursor-text font-medium ${item.done ? 'text-as-gray-400 line-through' : 'text-as-gray-700'}`}
        >
          {item.text}
        </span>

        <button
          onClick={() => startEdit(item)}
          className="p-1 rounded-md text-as-gray-300 hover:text-as-gray-600 hover:bg-white transition flex-shrink-0"
          title="Uredi"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => deleteTodo(item.id)}
          className="p-1 rounded-md text-as-gray-300 hover:text-as-red-600 hover:bg-white transition flex-shrink-0"
          title="Izbriši"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* barvna glava */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ background: 'linear-gradient(90deg, #C8102E 0%, #33373A 100%)' }}
      >
        <ListTodo className="w-4 h-4 text-white flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-white">
          Moj TO-DO
        </span>
        <span className="ml-auto text-[11px] font-bold text-white bg-white/20 rounded-full px-2 py-0.5">
          {open.length}
        </span>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
            placeholder="Novo opravilo…"
            className="flex-1 px-2.5 py-1.5 border border-as-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
          />
          <button
            onClick={addTodo}
            className="px-3 text-white rounded-lg transition flex items-center shadow-sm hover:opacity-90"
            style={{ backgroundColor: '#C8102E' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {err && <p className="mt-1.5 text-[11px] text-red-600 break-words">{err}</p>}

        {open.length > 0 && (
          <div className="mt-2 space-y-1">
            {open.map(renderRow)}
          </div>
        )}

        {done.length > 0 && (
          <div className="mt-2 pt-2 border-t border-as-gray-100">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowDone(!showDone)}
                className="text-[11px] font-bold uppercase tracking-wider text-as-gray-400 hover:text-as-gray-600 transition"
              >
                {showDone ? '▾ Skrij' : '▸ Opravljeno'} ({done.length})
              </button>
              {showDone && (
                <button
                  onClick={clearDone}
                  className="text-[11px] font-semibold text-as-gray-400 hover:text-as-red-600 transition"
                >
                  Počisti vse
                </button>
              )}
            </div>

            {showDone && (
              <div className="mt-1.5 space-y-1">
                {done.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
