import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ListTodo, Plus, Check, X, Loader2 } from 'lucide-react';

export default function TodoList({ currentUser }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const email = currentUser?.email;

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (!error) setItems(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [email]);

  const addTodo = async () => {
    const t = text.trim();
    if (!t || !email) return;
    setText('');
    const { data, error } = await supabase
      .from('todos')
      .insert([{ user_email: email, text: t }])
      .select()
      .single();
    if (!error && data) setItems(prev => [data, ...prev]);
  };

  const toggleTodo = async (item) => {
    const done = !item.done;
    const completed_at = done ? new Date().toISOString() : null;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done, completed_at } : i));
    await supabase.from('todos').update({ done, completed_at }).eq('id', item.id);
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
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm mb-6">
      <div className="px-4 py-3 border-b border-as-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-as-gray-700 flex items-center gap-2">
          <ListTodo className="w-4 h-4" style={{ color: '#C8102E' }} />
          Moj TO-DO
        </h3>
        <span className="text-xs font-semibold text-as-gray-400">
          {open.length} odprtih
        </span>
      </div>

      <div className="px-4 py-3 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
          placeholder="Napiši opravilo in pritisni Enter..."
          className="flex-1 px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
        />
        <button
          onClick={addTodo}
          className="px-3 py-2 text-white rounded-lg transition shadow-sm flex items-center"
          style={{ backgroundColor: '#C8102E' }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div className="py-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-as-gray-400" />
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <p className="py-4 text-center text-sm text-as-gray-400">
            Ni opravil. Dodaj prvo zgoraj.
          </p>
        ) : (
          <div className="space-y-1.5">
            {open.map(item => (
              <div
                key={item.id}
                className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-as-gray-50 transition"
              >
                <button
                  onClick={() => toggleTodo(item)}
                  className="w-5 h-5 rounded-full border-2 border-as-gray-300 hover:border-as-red-400 flex-shrink-0 transition"
                />
                <span className="flex-1 text-sm text-as-gray-700 break-words">{item.text}</span>
                <button
                  onClick={() => deleteTodo(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-as-gray-300 hover:text-as-red-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {done.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between px-2.5">
                  <button
                    onClick={() => setShowDone(!showDone)}
                    className="text-xs font-semibold text-as-gray-400 hover:text-as-gray-600 transition"
                  >
                    {showDone ? 'Skrij' : 'Prikaži'} opravljene ({done.length})
                  </button>
                  {showDone && (
                    <button
                      onClick={clearDone}
                      className="text-xs font-semibold text-as-gray-400 hover:text-as-red-600 transition"
                    >
                      Počisti
                    </button>
                  )}
                </div>

                {showDone && (
                  <div className="mt-1.5 space-y-1.5">
                    {done.map(item => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-as-gray-50 transition opacity-60"
                      >
                        <button
                          onClick={() => toggleTodo(item)}
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition"
                          style={{ backgroundColor: '#C8102E' }}
                        >
                          <Check className="w-3 h-3 text-white" />
                        </button>
                        <span className="flex-1 text-sm text-as-gray-500 line-through break-words">
                          {item.text}
                        </span>
                        <button
                          onClick={() => deleteTodo(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-as-gray-300 hover:text-as-red-600 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
