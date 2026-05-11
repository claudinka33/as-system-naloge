// Chat.jsx — Notranji klepet med zaposlenimi
import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, Edit2, Trash2, X, Check, CheckCheck, Loader2, MessageSquare, Lock } from 'lucide-react';
import { supabase } from './supabase.js';
import {
  getConversation, sendMessage, markAsRead, getUnreadCounts, editMessage, deleteMessage,
  setTyping, clearTyping, updatePresence, getPresence, isOnline, formatChatTime,
  canEditMessage, CHAT_EDIT_LOCK_DAYS
} from './lib/chatApi.js';

const AS_RED = '#C8102E';

export default function Chat({ currentUser, employees }) {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [presence, setPresence] = useState({});
  const [typingFrom, setTypingFrom] = useState({}); // { 'ales.seidl@as-system.si': timestamp }
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const otherEmployees = employees.filter(e => e.email !== currentUser.email);
  const filtered = otherEmployees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );
  const selectedUser = employees.find(e => e.email === selectedEmail);

  // ===== PRESENCE: posodobi vsakih 30s, da "sem online" =====
  useEffect(() => {
    updatePresence(currentUser.email);
    const id = setInterval(() => updatePresence(currentUser.email), 30000);
    return () => clearInterval(id);
  }, [currentUser.email]);

  // ===== LOAD: neprebrana + presence =====
  const reloadCounts = async () => {
    try {
      const counts = await getUnreadCounts(currentUser.email);
      setUnreadCounts(counts);
    } catch (e) { console.warn(e); }
  };

  const reloadPresence = async () => {
    try {
      const list = await getPresence();
      const map = {};
      list.forEach(p => { map[p.email] = p; });
      setPresence(map);
    } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    reloadCounts();
    reloadPresence();
    const id = setInterval(() => { reloadCounts(); reloadPresence(); }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== LOAD CONVERSATION =====
  useEffect(() => {
    if (!selectedEmail) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const msgs = await getConversation(currentUser.email, selectedEmail);
        if (!cancelled) {
          setMessages(msgs);
          await markAsRead(currentUser.email, selectedEmail);
          await reloadCounts();
        }
      } catch (e) {
        console.error(e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail]);

  // ===== REALTIME: nova/posodobljena sporočila =====
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const m = payload.new || payload.old;
        if (!m) return;

        // Posodobi unread counts če je zame
        if (m.to_email === currentUser.email) {
          await reloadCounts();
        }

        // Če zadeva trenutni pogovor — refresh
        const inConv = selectedEmail && (
          (m.from_email === currentUser.email && m.to_email === selectedEmail) ||
          (m.from_email === selectedEmail && m.to_email === currentUser.email)
        );
        if (inConv) {
          const msgs = await getConversation(currentUser.email, selectedEmail);
          setMessages(msgs);
          if (m.from_email === selectedEmail) {
            await markAsRead(currentUser.email, selectedEmail);
            await reloadCounts();
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail]);

  // ===== REALTIME: tipkanje =====
  useEffect(() => {
    const channel = supabase
      .channel('chat-typing-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        // Zanima nas le, če nekdo tipka MENI
        if (row.to_email !== currentUser.email) return;
        if (payload.eventType === 'DELETE') {
          setTypingFrom(prev => {
            const next = { ...prev };
            delete next[row.from_email];
            return next;
          });
        } else {
          setTypingFrom(prev => ({ ...prev, [row.from_email]: Date.now() }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Cleanup tipkanja po 5s =====
  useEffect(() => {
    const id = setInterval(() => {
      setTypingFrom(prev => {
        const now = Date.now();
        const next = {};
        Object.entries(prev).forEach(([k, t]) => {
          if (now - t < 5000) next[k] = t;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ===== AUTO SCROLL na zadnje sporočilo =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== TYPING INDICATOR =====
  const handleInputChange = (val) => {
    setInputText(val);
    if (!selectedEmail) return;
    setTyping(currentUser.email, selectedEmail).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      clearTyping(currentUser.email, selectedEmail).catch(() => {});
    }, 4000);
  };

  const handleSend = async () => {
    const t = inputText.trim();
    if (!t || !selectedEmail) return;
    setInputText('');
    try {
      await sendMessage(currentUser.email, selectedEmail, t);
      await clearTyping(currentUser.email, selectedEmail);
    } catch (e) {
      alert('Napaka pri pošiljanju: ' + e.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditText(m.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (m) => {
    const t = editText.trim();
    if (!t || t === m.text) { cancelEdit(); return; }
    try {
      await editMessage(m.id, currentUser.email, t);
      cancelEdit();
    } catch (e) {
      alert('Napaka pri urejanju: ' + e.message);
    }
  };

  const handleDelete = async (m) => {
    if (!confirm('Izbriši sporočilo?')) return;
    try {
      await deleteMessage(m.id, currentUser.email);
    } catch (e) {
      alert('Napaka pri brisanju: ' + e.message);
    }
  };

  const totalUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
      <div className="flex h-full">

        {/* SEZNAM ZAPOSLENIH */}
        <div className={`${selectedEmail ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-as-gray-200 bg-as-gray-50`}>
          <div className="p-3 border-b border-as-gray-200 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5" style={{ color: AS_RED }} />
              <h2 className="font-bold text-as-gray-700">Klepet</h2>
              {totalUnread > 0 && (
                <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: AS_RED }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-as-gray-400" />
              <input type="text" placeholder="Išči..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-as-gray-400">Ni zadetkov.</div>
            ) : (
              filtered.map(emp => {
                const unread = unreadCounts[emp.email] || 0;
                const online = isOnline(presence[emp.email]);
                const active = selectedEmail === emp.email;
                const initials = emp.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button key={emp.email} onClick={() => setSelectedEmail(emp.email)}
                    className={`w-full flex items-center gap-3 p-3 border-b border-as-gray-100 hover:bg-white transition text-left ${active ? 'bg-white' : ''}`}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: active ? AS_RED : '#6B7280' }}>
                        {initials}
                      </div>
                      {online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Online" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm text-as-gray-700 truncate">{emp.name}</span>
                        {unread > 0 && (
                          <span className="text-xs font-bold text-white px-1.5 rounded-full" style={{ backgroundColor: AS_RED, minWidth: '20px', textAlign: 'center' }}>
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-as-gray-400 truncate">{emp.department}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* OKNO POGOVORA */}
        <div className={`${selectedEmail ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-as-gray-400 text-sm">
              👈 Izberi sogovornika za začetek pogovora.
            </div>
          ) : (
            <>
              {/* Header pogovora */}
              <div className="px-4 py-3 border-b border-as-gray-200 bg-white flex items-center gap-3">
                <button onClick={() => setSelectedEmail(null)} className="md:hidden p-1 hover:bg-as-gray-100 rounded">
                  <X className="w-5 h-5 text-as-gray-500" />
                </button>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: AS_RED }}>
                    {selectedUser.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  {isOnline(presence[selectedUser.email]) && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-as-gray-700">{selectedUser.name}</div>
                  <div className="text-xs text-as-gray-400">
                    {typingFrom[selectedUser.email] ? (
                      <span className="italic" style={{ color: AS_RED }}>piše...</span>
                    ) : isOnline(presence[selectedUser.email]) ? 'online' : selectedUser.department}
                  </div>
                </div>
              </div>

              {/* Sporočila */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-as-gray-50">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-as-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Nalagam...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-as-gray-400 text-sm">
                    Še ni sporočil. Pošlji prvo!
                  </div>
                ) : (
                  messages.map(m => {
                    const mine = m.from_email === currentUser.email;
                    const editable = mine && canEditMessage(m.created_at);
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm bg-white text-as-gray-700 border border-as-gray-200'}`}
                          style={mine ? { backgroundColor: AS_RED } : {}}>
                          {editingId === m.id ? (
                            <div className="flex flex-col gap-1">
                              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                                className="w-full px-2 py-1 text-sm text-as-gray-700 border border-as-gray-200 rounded" autoFocus />
                              <div className="flex gap-1 justify-end">
                                <button onClick={cancelEdit} className="text-xs px-2 py-0.5 bg-white text-as-gray-700 rounded hover:bg-as-gray-100">Prekliči</button>
                                <button onClick={() => saveEdit(m)} className="text-xs px-2 py-0.5 bg-white text-as-red-600 rounded hover:bg-as-gray-100 font-semibold">Shrani</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                              <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${mine ? 'text-white/70 justify-end' : 'text-as-gray-400'}`}>
                                <span>{formatChatTime(m.created_at)}</span>
                                {m.edited_at && <span className="italic">· ured.</span>}
                                {mine && (m.read_at ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                              </div>
                            </>
                          )}
                        </div>
                        {mine && editingId !== m.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-1">
                            {editable ? (
                              <>
                                <button onClick={() => startEdit(m)} title="Uredi" className="p-1 text-as-gray-400 hover:text-as-red-600 hover:bg-as-red-50 rounded">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDelete(m)} title="Izbriši" className="p-1 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <span title={`Zaklenjeno (>${CHAT_EDIT_LOCK_DAYS} dni)`} className="p-1 text-as-gray-300">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-as-gray-200 bg-white">
                <div className="flex items-end gap-2">
                  <textarea value={inputText} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
                    rows={1} placeholder="Napiši sporočilo... (Enter za pošlji, Shift+Enter za novo vrstico)"
                    className="flex-1 px-3 py-2 border border-as-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-as-red-100 max-h-32" />
                  <button onClick={handleSend} disabled={!inputText.trim()}
                    className="p-2.5 rounded-xl text-white disabled:opacity-40 transition"
                    style={{ backgroundColor: AS_RED }}>
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
