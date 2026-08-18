import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ListTodo, Plus, Check, X } from 'lucide-react';

export default function TodoList({ currentUser }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [showDone, setShowDone] = useState(false);

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

  const deleteTodo = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('todos').delete().eq('id', id);
  };

  const clearDone = async () => {
    const ids = items.filter(i => i.done).map(i => i.id);
    if (!ids.length) return;
    setItems(prev => prev.filter(i => !i.done));
    await supabase.from('todos').delete().in('id', ids);
  };

  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C8102E' }} />
        <span className="text-xs font-bold uppercase tracking-wider text-as-gray-500">
          Moj TO-DO
        </span>
        <span className="ml-auto text-[11px] font-semibold text-as-gray-400">
          {open.length}
        </span>
      </div>

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
          className="px-2.5 text-white rounded-lg transition flex items-center"
          style={{ backgroundColor: '#C8102E' }}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {err && (
        <p className="mt-1.5 text-[11px] text-red-600 break-words">{err}</p>
      )}

      {open.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {open.map(item => (
            <div
              key={item.id}
              className="group flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-as-gray-50 transition"
            >
              <button
                onClick={() => toggleTodo(item)}
                className="w-4 h-4 rounded-full border-2 border-as-gray-300 hover:border-as-red-400 flex-shrink-0 transition"
              />
              <span className="flex-1 text-[13px] text-as-gray-700 break-words leading-snug">{item.text}</span>
              <button
                onClick={() => deleteTodo(item.id)}
                className="opacity-0 group-hover:opacity-100 text-as-gray-300 hover:text-as-red-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between px-1.5">
            <button
              onClick={() => setShowDone(!showDone)}
              className="text-[11px] font-semibold text-as-gray-400 hover:text-as-gray-600 transition"
            >
              {showDone ? 'Skrij' : 'Opravljeno'} ({done.length})
            </button>
            {showDone && (
              <button
                onClick={clearDone}
                className="text-[11px] font-semibold text-as-gray-400 hover:text-as-red-600 transition"
              >
                Počisti
              </button>
            )}
          </div>

          {showDone && (
            <div className="mt-0.5 space-y-0.5">
              {done.map(item => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-as-gray-50 transition opacity-60"
                >
                  <button
                    onClick={() => toggleTodo(item)}
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#C8102E' }}
                  >
                    <Check className="w-2.5 h-2.5 text-white" />
                  </button>
                  <span className="flex-1 text-[13px] text-as-gray-500 line-through break-words leading-snug">
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-as-gray-300 hover:text-as-red-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
