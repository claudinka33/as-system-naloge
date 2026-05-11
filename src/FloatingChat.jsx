// FloatingChat.jsx — FB Messenger style plavajoči klepet (vedno spodaj desno)
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, X, Send, Search, Paperclip, Loader2, ChevronDown, ChevronUp,
  Users, Plus, Image as ImageIcon, FileText, Download, Edit2, Trash2, Lock,
  Bell, BellOff, Check, CheckCheck
} from 'lucide-react';
import { supabase } from './supabase.js';
import {
  getConversation, sendMessage, markAsRead, getUnreadCounts, getLastMessageTimes,
  editMessage, deleteMessage,
  setTyping, clearTyping, updatePresence, getPresence, isOnline, formatChatTime,
  canEditMessage, CHAT_EDIT_LOCK_DAYS,
  getMyGroups, getGroupMembers, createGroup,
  getGroupMessages, sendGroupMessage, markGroupAsRead, getGroupReads, getGroupUnreadCounts,
  getGroupLastMessageTimes,
  uploadAttachment, isImageAttachment, formatFileSize,
  avatarColor, initials, AVATAR_COLORS
} from './lib/chatApi.js';

const AS_RED = '#C8102E';
const MAX_WINDOWS = 4;

function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(); o.stop(ctx.currentTime + 0.2);
  } catch {}
}

export default function FloatingChat({ currentUser, employees }) {
  const [showLauncher, setShowLauncher] = useState(false); // popis kontaktov / skupin
  const [openWindows, setOpenWindows] = useState([]); // [{type, id, minimized}]
  const [unreadDM, setUnreadDM] = useState({});
  const [unreadGroup, setUnreadGroup] = useState({});
  const [myGroups, setMyGroups] = useState([]);
  const [groupReads, setGroupReads] = useState({});
  const [lastMsgDM, setLastMsgDM] = useState({});
  const [lastMsgGroup, setLastMsgGroup] = useState({});
  const [presence, setPresence] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const lastSeenMsgIdRef = useRef(null);

  const otherEmployees = employees.filter(e => e.email !== currentUser.email);

  // ===== PRESENCE =====
  useEffect(() => {
    updatePresence(currentUser.email);
    const id = setInterval(() => updatePresence(currentUser.email), 30000);
    return () => clearInterval(id);
  }, [currentUser.email]);

  // ===== LOAD COUNTS =====
  const reloadAll = async () => {
    try {
      const [dm, groups, reads, lastDM] = await Promise.all([
        getUnreadCounts(currentUser.email),
        getMyGroups(currentUser.email),
        getGroupReads(currentUser.email),
        getLastMessageTimes(currentUser.email),
      ]);
      setUnreadDM(dm);
      setMyGroups(groups);
      setGroupReads(reads);
      setLastMsgDM(lastDM);
      const [gUnread, gLast] = await Promise.all([
        getGroupUnreadCounts(currentUser.email, groups, reads),
        getGroupLastMessageTimes(groups),
      ]);
      setUnreadGroup(gUnread);
      setLastMsgGroup(gLast);
    } catch (e) { /* ignore */ }
  };
  const reloadPresence = async () => {
    try {
      const list = await getPresence();
      const map = {};
      list.forEach(p => { map[p.email] = p; });
      setPresence(map);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    reloadAll(); reloadPresence();
    const id = setInterval(() => { reloadAll(); reloadPresence(); }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== REALTIME =====
  useEffect(() => {
    const channel = supabase
      .channel('floating-chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const m = payload.new || payload.old;
        if (!m) return;
        const isMineSent = m.from_email === currentUser.email;

        // Auto-odpri okno + ping ko mi nekdo pošlje (DM)
        if (payload.eventType === 'INSERT' && !isMineSent) {
          const dmToMe = !m.group_id && m.to_email === currentUser.email;
          const inMyGroup = m.group_id && myGroups.some(g => g.id === m.group_id);
          if (dmToMe || inMyGroup) {
            if (soundEnabled && m.id !== lastSeenMsgIdRef.current) {
              playPing();
              lastSeenMsgIdRef.current = m.id;
            }
            // Če DM in se okno še ne odpre, ga avtomatsko odpri minimizirano
            if (dmToMe) {
              setOpenWindows(prev => {
                const exists = prev.find(w => w.type === 'dm' && w.id === m.from_email);
                if (exists) return prev;
                const next = [...prev, { type: 'dm', id: m.from_email, minimized: true }];
                return next.slice(-MAX_WINDOWS);
              });
            }
            // Če GROUP in okno se ne odpre, ne odpri (preveč intrusive za skupine)
          }
          await reloadAll();
        } else if (payload.eventType !== 'INSERT') {
          await reloadAll();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroups.length, soundEnabled]);

  // ===== ODPIRANJE / ZAPIRANJE OKEN =====
  const openWindow = (type, id) => {
    setShowLauncher(false);
    setOpenWindows(prev => {
      const exists = prev.find(w => w.type === type && w.id === id);
      if (exists) {
        // če obstaja — razminimiziraj
        return prev.map(w => w.type === type && w.id === id ? { ...w, minimized: false } : w);
      }
      const next = [...prev, { type, id, minimized: false }];
      return next.slice(-MAX_WINDOWS);
    });
  };

  const closeWindow = (type, id) => {
    setOpenWindows(prev => prev.filter(w => !(w.type === type && w.id === id)));
  };

  const toggleMinimize = (type, id) => {
    setOpenWindows(prev => prev.map(w =>
      w.type === type && w.id === id ? { ...w, minimized: !w.minimized } : w
    ));
  };

  // ===== UNREAD TOTAL =====
  const totalUnread =
    Object.values(unreadDM).reduce((s, n) => s + n, 0) +
    Object.values(unreadGroup).reduce((s, n) => s + n, 0);

  // ===== SORTED CONTACTS LIST =====
  const dmItems = otherEmployees.map(emp => ({
    kind: 'dm', emp,
    sortTime: lastMsgDM[emp.email] || null,
    unread: unreadDM[emp.email] || 0,
  }));
  const groupItems = myGroups.map(g => ({
    kind: 'group', group: g,
    sortTime: lastMsgGroup[g.id] || g.created_at,
    unread: unreadGroup[g.id] || 0,
  }));
  let merged = [...dmItems, ...groupItems];
  merged.sort((a, b) => {
    if (a.sortTime && b.sortTime) return new Date(b.sortTime) - new Date(a.sortTime);
    if (a.sortTime) return -1;
    if (b.sortTime) return 1;
    const an = a.kind === 'dm' ? a.emp.name : a.group.name;
    const bn = b.kind === 'dm' ? b.emp.name : b.group.name;
    return an.localeCompare(bn);
  });
  if (search.trim()) {
    const q = search.toLowerCase();
    merged = merged.filter(it => it.kind === 'dm'
      ? it.emp.name.toLowerCase().includes(q) || it.emp.department.toLowerCase().includes(q)
      : it.group.name.toLowerCase().includes(q));
  }

  return (
    <>
      {/* Plavajoca okna (od desne proti levi) */}
      <div className="fixed bottom-0 right-20 z-40 flex items-end gap-3 pointer-events-none">
        {openWindows.map(w => (
          <ChatWindow
            key={`${w.type}-${w.id}`}
            type={w.type}
            id={w.id}
            minimized={w.minimized}
            currentUser={currentUser}
            employees={employees}
            myGroups={myGroups}
            presence={presence}
            soundEnabled={soundEnabled}
            onClose={() => closeWindow(w.type, w.id)}
            onToggleMinimize={() => toggleMinimize(w.type, w.id)}
            unreadInThis={w.type === 'dm' ? (unreadDM[w.id] || 0) : (unreadGroup[w.id] || 0)}
            onMessageActivity={reloadAll}
          />
        ))}
      </div>

      {/* Launcher pop-up */}
      {showLauncher && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowLauncher(false)} />
          <div className="fixed bottom-20 right-4 w-80 max-h-[70vh] bg-white border border-as-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-as-gray-200 bg-gradient-to-r from-white to-as-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5" style={{ color: AS_RED }} />
                <span className="font-bold text-as-gray-700">Klepet</span>
                {totalUnread > 0 && (
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: AS_RED }}>
                    {totalUnread}
                  </span>
                )}
                <button
                  onClick={() => setSoundEnabled(s => !s)}
                  title={soundEnabled ? 'Izklopi zvok' : 'Vklopi zvok'}
                  className="ml-auto p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400 hover:text-as-gray-700 transition">
                  {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <button onClick={() => setShowLauncher(false)} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-4 h-4 text-as-gray-400" />
                <input type="text" placeholder="Išči..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {merged.length === 0 ? (
                <div className="p-4 text-center text-sm text-as-gray-400">Ni zadetkov.</div>
              ) : (
                merged.map(item => {
                  if (item.kind === 'dm') {
                    const { emp, unread } = item;
                    const online = isOnline(presence[emp.email]);
                    const color = avatarColor(emp.email);
                    return (
                      <button key={`dm-${emp.email}`} onClick={() => openWindow('dm', emp.email)}
                        className="w-full flex items-center gap-3 p-2.5 border-b border-as-gray-100 hover:bg-as-gray-50 transition text-left">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm" style={{ backgroundColor: color }}>
                            {initials(emp.name)}
                          </div>
                          {online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-semibold text-sm truncate ${unread > 0 ? 'text-as-gray-900' : 'text-as-gray-700'}`}>{emp.name}</span>
                            {unread > 0 && (
                              <span className="text-xs font-bold text-white px-1.5 rounded-full animate-pulse" style={{ backgroundColor: AS_RED, minWidth: '20px', textAlign: 'center' }}>
                                {unread}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-as-gray-400 truncate">{emp.department}</div>
                        </div>
                      </button>
                    );
                  }
                  const { group, unread } = item;
                  return (
                    <button key={`g-${group.id}`} onClick={() => openWindow('group', group.id)}
                      className="w-full flex items-center gap-3 p-2.5 border-b border-as-gray-100 hover:bg-as-gray-50 transition text-left">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: group.color || '#0E7490' }}>
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-semibold text-sm truncate ${unread > 0 ? 'text-as-gray-900' : 'text-as-gray-700'}`}>{group.name}</span>
                          {unread > 0 && (
                            <span className="text-xs font-bold text-white px-1.5 rounded-full animate-pulse" style={{ backgroundColor: AS_RED, minWidth: '20px', textAlign: 'center' }}>
                              {unread}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-as-gray-400 truncate">👥 skupina</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* Glavni gumb spodaj desno */}
      <button
        onClick={() => setShowLauncher(s => !s)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition hover:scale-105"
        style={{ backgroundColor: AS_RED }}
        title="Klepet"
      >
        <MessageSquare className="w-6 h-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 text-[11px] font-bold text-white rounded-full flex items-center justify-center animate-pulse border-2 border-white" style={{ backgroundColor: '#DC2626' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </>
  );
}

// =====================================
// CHAT WINDOW (eno plavajoče okno)
// =====================================
function ChatWindow({ type, id, minimized, currentUser, employees, myGroups, presence, soundEnabled, onClose, onToggleMinimize, unreadInThis, onMessageActivity }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [typingFrom, setTypingFrom] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isDM = type === 'dm';
  const selectedUser = isDM ? employees.find(e => e.email === id) : null;
  const selectedGroup = !isDM ? myGroups.find(g => g.id === id) : null;

  const reload = async () => {
    if (minimized) return;
    setLoading(true);
    try {
      let msgs = [];
      if (isDM) {
        msgs = await getConversation(currentUser.email, id);
        setMessages(msgs);
        await markAsRead(currentUser.email, id);
      } else {
        msgs = await getGroupMessages(id);
        setMessages(msgs);
        await markGroupAsRead(id, currentUser.email);
      }
      onMessageActivity && onMessageActivity();
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, minimized]);

  // realtime za to okno
  useEffect(() => {
    const channel = supabase
      .channel(`floating-${type}-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const m = payload.new || payload.old;
        if (!m) return;
        let inConv = false;
        if (isDM) {
          inConv = !m.group_id && (
            (m.from_email === currentUser.email && m.to_email === id) ||
            (m.from_email === id && m.to_email === currentUser.email)
          );
        } else {
          inConv = m.group_id === id;
        }
        if (inConv) await reload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, minimized]);

  // typing
  useEffect(() => {
    if (!isDM) return;
    const channel = supabase
      .channel(`floating-typing-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.from_email !== id || row.to_email !== currentUser.email) return;
        if (payload.eventType === 'DELETE') setTypingFrom(false);
        else setTypingFrom(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingFrom(false), 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDM, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, minimized]);

  const handleInputChange = (val) => {
    setInputText(val);
    if (!isDM) return;
    setTyping(currentUser.email, id).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      clearTyping(currentUser.email, id).catch(() => {});
    }, 4000);
  };

  const handleSend = async () => {
    const t = inputText.trim();
    if (!t && !pendingAttachment) return;
    setInputText('');
    const att = pendingAttachment;
    setPendingAttachment(null);
    try {
      if (isDM) {
        await sendMessage(currentUser.email, id, t, att);
        await clearTyping(currentUser.email, id);
      } else {
        await sendGroupMessage(currentUser.email, id, t, att);
      }
    } catch (e) {
      alert('Napaka: ' + e.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB.'); return; }
    setUploading(true);
    try {
      const att = await uploadAttachment(file, currentUser.email);
      setPendingAttachment(att);
    } catch (err) { alert('Napaka: ' + err.message); }
    setUploading(false);
    e.target.value = '';
  };

  const startEdit = (m) => { setEditingId(m.id); setEditText(m.text); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async (m) => {
    const t = editText.trim();
    if (!t || t === m.text) { cancelEdit(); return; }
    try { await editMessage(m.id, currentUser.email, t); cancelEdit(); }
    catch (e) { alert(e.message); }
  };
  const handleDelete = async (m) => {
    if (!confirm('Izbriši?')) return;
    try { await deleteMessage(m.id, currentUser.email); }
    catch (e) { alert(e.message); }
  };

  const title = isDM ? selectedUser?.name : selectedGroup?.name;
  const subtitle = isDM
    ? (typingFrom ? 'piše...' : (isOnline(presence[selectedUser?.email]) ? 'online' : selectedUser?.department))
    : `👥 skupina`;
  const headerColor = isDM ? (selectedUser ? avatarColor(selectedUser.email) : AS_RED) : (selectedGroup?.color || '#0E7490');

  if (!selectedUser && !selectedGroup) return null;

  return (
    <div className="pointer-events-auto w-72 sm:w-80 bg-white border border-as-gray-200 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ height: minimized ? 'auto' : '440px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        style={{ background: `linear-gradient(135deg, ${headerColor} 0%, ${headerColor}DD 100%)` }}
        onClick={onToggleMinimize}>
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
          {isDM ? initials(selectedUser?.name) : <Users className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0 text-white">
          <div className="text-sm font-bold truncate flex items-center gap-1.5">
            {title}
            {unreadInThis > 0 && minimized && (
              <span className="text-[10px] font-bold bg-white text-as-gray-900 px-1.5 rounded-full">{unreadInThis}</span>
            )}
          </div>
          <div className="text-[10px] text-white/80 truncate">{subtitle}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }} className="p-1 text-white/80 hover:text-white">
          {minimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ background: 'linear-gradient(180deg, #F0F4F8 0%, #E8EEF4 100%)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-6 text-as-gray-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-1" /> Nalagam...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-xs">Še ni sporočil.</div>
            ) : (
              messages.map(m => {
                const mine = m.from_email === currentUser.email;
                const editable = mine && canEditMessage(m.created_at);
                const author = employees.find(e => e.email === m.from_email);
                const showAuthor = !isDM && !mine;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`max-w-[80%] rounded-xl px-2.5 py-1.5 shadow-sm ${mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm bg-white text-as-gray-700 border border-as-gray-200'}`}
                      style={mine ? { backgroundColor: AS_RED } : {}}>
                      {showAuthor && (
                        <div className="text-[10px] font-bold mb-0.5" style={{ color: avatarColor(m.from_email) }}>{author?.name || m.from_email}</div>
                      )}
                      {editingId === m.id ? (
                        <div className="flex flex-col gap-1">
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                            className="w-full px-2 py-1 text-xs text-as-gray-700 border border-as-gray-200 rounded" autoFocus />
                          <div className="flex gap-1 justify-end">
                            <button onClick={cancelEdit} className="text-[10px] px-2 py-0.5 bg-white text-as-gray-700 rounded">Prekliči</button>
                            <button onClick={() => saveEdit(m)} className="text-[10px] px-2 py-0.5 bg-white text-as-red-600 rounded font-semibold">Shrani</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {m.attachment_url && <MiniAttachment att={{ url: m.attachment_url, name: m.attachment_name, size: m.attachment_size, type: m.attachment_type }} mine={mine} />}
                          {m.text && <div className="text-xs whitespace-pre-wrap break-words">{m.text}</div>}
                          <div className={`flex items-center gap-1 mt-0.5 text-[9px] ${mine ? 'text-white/70 justify-end' : 'text-as-gray-400'}`}>
                            <span>{formatChatTime(m.created_at)}</span>
                            {m.edited_at && <span className="italic">· ured.</span>}
                            {mine && isDM && (m.read_at ? <CheckCheck className="w-2.5 h-2.5" /> : <Check className="w-2.5 h-2.5" />)}
                          </div>
                        </>
                      )}
                    </div>
                    {mine && editingId !== m.id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition ml-0.5">
                        {editable ? (
                          <>
                            <button onClick={() => startEdit(m)} className="p-0.5 text-as-gray-400 hover:text-as-red-600" title="Uredi">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(m)} className="p-0.5 text-as-gray-400 hover:text-red-600" title="Izbriši">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <Lock className="w-3 h-3 text-as-gray-300" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending attachment */}
          {pendingAttachment && (
            <div className="px-2 py-1.5 bg-blue-50 border-t border-blue-200 flex items-center gap-2 text-xs">
              {isImageAttachment(pendingAttachment.type) ? <ImageIcon className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-blue-600" />}
              <span className="flex-1 truncate text-blue-900 font-semibold">{pendingAttachment.name}</span>
              <button onClick={() => setPendingAttachment(null)} className="text-blue-700">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-2 bg-white border-t border-as-gray-200 flex items-end gap-1.5">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="p-1.5 rounded-lg text-as-gray-400 hover:text-as-gray-700 hover:bg-as-gray-100 transition disabled:opacity-50"
              title="Pripni">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
            <textarea value={inputText} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
              rows={1} placeholder="Sporočilo..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-as-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-as-red-100 max-h-20" />
            <button onClick={handleSend} disabled={!inputText.trim() && !pendingAttachment}
              className="p-1.5 rounded-lg text-white disabled:opacity-40 transition"
              style={{ backgroundColor: AS_RED }}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MiniAttachment({ att, mine }) {
  if (!att.url) return null;
  if (isImageAttachment(att.type)) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img src={att.url} alt={att.name} className="max-w-full max-h-32 rounded object-cover" />
      </a>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
      className={`flex items-center gap-1.5 mb-1 p-1.5 rounded ${mine ? 'bg-white/20' : 'bg-as-gray-100'} text-[10px]`}>
      <FileText className={`w-3 h-3 ${mine ? 'text-white' : 'text-as-gray-600'}`} />
      <span className={`flex-1 truncate ${mine ? 'text-white' : 'text-as-gray-700'}`}>{att.name}</span>
      <Download className={`w-3 h-3 ${mine ? 'text-white' : 'text-as-gray-500'}`} />
    </a>
  );
}
