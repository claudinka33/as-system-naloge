// Chat.jsx — Notranji klepet V2 (skupine, priloge, zvok, barve, razvrščanje)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send, Search, Edit2, Trash2, X, Check, CheckCheck, Loader2, MessageSquare, Lock,
  Paperclip, Image as ImageIcon, FileText, Download, Users, Plus, UserPlus, UserMinus, Smile,
  Bell, BellOff
} from 'lucide-react';
import { supabase } from './supabase.js';
import {
  getConversation, sendMessage, markAsRead, getUnreadCounts, getLastMessageTimes,
  editMessage, deleteMessage,
  setTyping, clearTyping, updatePresence, getPresence, isOnline, formatChatTime,
  canEditMessage, CHAT_EDIT_LOCK_DAYS,
  getMyGroups, getGroupMembers, createGroup, addGroupMember, removeGroupMember, deleteGroup,
  getGroupMessages, sendGroupMessage, markGroupAsRead, getGroupReads, getGroupUnreadCounts, getGroupReadStatus,
  getGroupLastMessageTimes,
  uploadAttachment, isImageAttachment, formatFileSize,
  avatarColor, initials, AVATAR_COLORS
} from './lib/chatApi.js';

const AS_RED = '#C8102E';
const MY_BUBBLE = '#C8102E';      // moja sporočila
const OTHER_BUBBLE = '#FFFFFF';   // sporočila drugih (z border)
const BG_CHAT = 'linear-gradient(180deg, #F0F4F8 0%, #E8EEF4 100%)';

// Mali "ping" zvok (Web Audio API — brez fajla)
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

export default function Chat({ currentUser, employees }) {
  // selected: { type: 'dm'|'group', id: email or group.id }
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});         // dm: email -> count
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({}); // group_id -> count
  const [presence, setPresence] = useState({});
  const [typingFrom, setTypingFrom] = useState({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Sortiranje
  const [lastMsgTimesDM, setLastMsgTimesDM] = useState({});
  const [lastMsgTimesGroup, setLastMsgTimesGroup] = useState({});

  // Skupine
  const [myGroups, setMyGroups] = useState([]);
  const [groupReads, setGroupReads] = useState({});
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupMembersMap, setGroupMembersMap] = useState({}); // group_id -> [emails]
  const [groupReadStatus, setGroupReadStatus] = useState({}); // za trenutno odprto skupino: { email: last_read_at }

  // Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastSeenMsgIdRef = useRef(null);

  // Priloge
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ===== PRESENCE =====
  useEffect(() => {
    updatePresence(currentUser.email);
    const id = setInterval(() => updatePresence(currentUser.email), 30000);
    return () => clearInterval(id);
  }, [currentUser.email]);

  // ===== LOADERS =====
  const reloadAllCounts = async () => {
    try {
      const [dmCounts, groups, reads, lastDM] = await Promise.all([
        getUnreadCounts(currentUser.email),
        getMyGroups(currentUser.email),
        getGroupReads(currentUser.email),
        getLastMessageTimes(currentUser.email),
      ]);
      setUnreadCounts(dmCounts);
      setMyGroups(groups);
      setGroupReads(reads);
      setLastMsgTimesDM(lastDM);
      // group unread + last times
      const [gUnread, gLast] = await Promise.all([
        getGroupUnreadCounts(currentUser.email, groups, reads),
        getGroupLastMessageTimes(groups),
      ]);
      setGroupUnreadCounts(gUnread);
      setLastMsgTimesGroup(gLast);
      // members map za prikaz koliko ljudi v skupini
      const memMap = {};
      for (const g of groups) {
        const mem = await getGroupMembers(g.id);
        memMap[g.id] = mem.map(m => m.member_email);
      }
      setGroupMembersMap(memMap);
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
    reloadAllCounts();
    reloadPresence();
    const id = setInterval(() => { reloadAllCounts(); reloadPresence(); }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== LOAD CONVERSATION / GROUP =====
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let msgs = [];
        if (selected.type === 'dm') {
          msgs = await getConversation(currentUser.email, selected.id);
          if (!cancelled) {
            setMessages(msgs);
            await markAsRead(currentUser.email, selected.id);
          }
        } else {
          msgs = await getGroupMessages(selected.id);
          if (!cancelled) {
            setMessages(msgs);
            await markGroupAsRead(selected.id, currentUser.email);
            // read receipts: kdo je nazadnje videl skupino
            try {
              const rs = await getGroupReadStatus(selected.id);
              setGroupReadStatus(rs);
            } catch {}
          }
        }
        await reloadAllCounts();
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.type, selected?.id]);

  // ===== REALTIME: messages =====
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, async (payload) => {
        const m = payload.new || payload.old;
        if (!m) return;

        const isMineSent = m.from_email === currentUser.email;

        // INSERT od drugega → zvok + counts
        if (payload.eventType === 'INSERT' && !isMineSent) {
          // 1-na-1 zame
          const dmToMe = !m.group_id && m.to_email === currentUser.email;
          // skupina v kateri sem
          const inMyGroup = m.group_id && myGroups.some(g => g.id === m.group_id);
          if (dmToMe || inMyGroup) {
            if (soundEnabled && m.id !== lastSeenMsgIdRef.current) {
              playPing();
              lastSeenMsgIdRef.current = m.id;
            }
          }
          await reloadAllCounts();
        }

        // Če zadeva trenutni prikaz — refresh
        if (selected) {
          let inConv = false;
          if (selected.type === 'dm') {
            inConv = !m.group_id && (
              (m.from_email === currentUser.email && m.to_email === selected.id) ||
              (m.from_email === selected.id && m.to_email === currentUser.email)
            );
          } else {
            inConv = m.group_id === selected.id;
          }
          if (inConv) {
            if (selected.type === 'dm') {
              const msgs = await getConversation(currentUser.email, selected.id);
              setMessages(msgs);
              if (!isMineSent) await markAsRead(currentUser.email, selected.id);
            } else {
              const msgs = await getGroupMessages(selected.id);
              setMessages(msgs);
              if (!isMineSent) await markGroupAsRead(selected.id, currentUser.email);
            }
            await reloadAllCounts();
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.type, selected?.id, myGroups.length, soundEnabled]);

  // ===== REALTIME: typing =====
  useEffect(() => {
    const channel = supabase
      .channel('chat-typing-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_typing' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (row.to_email !== currentUser.email) return;
        if (payload.eventType === 'DELETE') {
          setTypingFrom(prev => { const n = { ...prev }; delete n[row.from_email]; return n; });
        } else {
          setTypingFrom(prev => ({ ...prev, [row.from_email]: Date.now() }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTypingFrom(prev => {
        const now = Date.now();
        const next = {};
        Object.entries(prev).forEach(([k, t]) => { if (now - t < 5000) next[k] = t; });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ===== REALTIME: groups (članstva spremembe) =====
  useEffect(() => {
    const channel = supabase
      .channel('chat-groups-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members' }, async () => {
        await reloadAllCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_groups' }, async () => {
        await reloadAllCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_read' }, async (payload) => {
        // Če je posodobljeno za trenutno skupino, osveži read receipts
        const r = payload.new || payload.old;
        if (r && selected?.type === 'group' && r.group_id === selected.id) {
          try {
            const rs = await getGroupReadStatus(selected.id);
            setGroupReadStatus(rs);
          } catch {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== AUTO SCROLL =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ===== TYPING =====
  const handleInputChange = (val) => {
    setInputText(val);
    if (!selected || selected.type !== 'dm') return; // tipkanje za zdaj samo 1-na-1
    setTyping(currentUser.email, selected.id).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      clearTyping(currentUser.email, selected.id).catch(() => {});
    }, 4000);
  };

  // ===== POSILJANJE =====
  const handleSend = async () => {
    const t = inputText.trim();
    if (!t && !pendingAttachment) return;
    if (!selected) return;

    setInputText('');
    const att = pendingAttachment;
    setPendingAttachment(null);

    try {
      if (selected.type === 'dm') {
        await sendMessage(currentUser.email, selected.id, t, att);
        await clearTyping(currentUser.email, selected.id);
      } else {
        await sendGroupMessage(currentUser.email, selected.id, t, att);
      }
    } catch (e) {
      alert('Napaka pri pošiljanju: ' + e.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ===== EDIT/DELETE =====
  const startEdit = (m) => { setEditingId(m.id); setEditText(m.text); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = async (m) => {
    const t = editText.trim();
    if (!t || t === m.text) { cancelEdit(); return; }
    try { await editMessage(m.id, currentUser.email, t); cancelEdit(); }
    catch (e) { alert('Napaka: ' + e.message); }
  };
  const handleDelete = async (m) => {
    if (!confirm('Izbriši sporočilo?')) return;
    try { await deleteMessage(m.id, currentUser.email); }
    catch (e) { alert('Napaka: ' + e.message); }
  };

  // ===== PRILOGE =====
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Datoteka je prevelika (max 10 MB).');
      return;
    }
    setUploading(true);
    try {
      const att = await uploadAttachment(file, currentUser.email);
      setPendingAttachment(att);
    } catch (err) {
      alert('Napaka pri nalaganju: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  };

  // ===== SORTIRANJE LEVE STRANI =====
  const otherEmployees = employees.filter(e => e.email !== currentUser.email);

  const sortedItems = useMemo(() => {
    // Zlijem DM + skupine, sortiram po zadnjem sporočilu (desc), neimajo zadaj
    const dmItems = otherEmployees.map(emp => ({
      kind: 'dm',
      key: `dm-${emp.email}`,
      emp,
      sortTime: lastMsgTimesDM[emp.email] || null,
      unread: unreadCounts[emp.email] || 0,
    }));
    const groupItems = myGroups.map(g => ({
      kind: 'group',
      key: `group-${g.id}`,
      group: g,
      sortTime: lastMsgTimesGroup[g.id] || g.created_at,
      unread: groupUnreadCounts[g.id] || 0,
    }));
    const merged = [...dmItems, ...groupItems];
    merged.sort((a, b) => {
      // 1. tisti z zadnjim sporočilom — najnovejši na vrh
      if (a.sortTime && b.sortTime) return new Date(b.sortTime) - new Date(a.sortTime);
      if (a.sortTime) return -1;
      if (b.sortTime) return 1;
      // 2. ostali abecedno
      const an = a.kind === 'dm' ? a.emp.name : a.group.name;
      const bn = b.kind === 'dm' ? b.emp.name : b.group.name;
      return an.localeCompare(bn);
    });
    // search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      return merged.filter(it => {
        if (it.kind === 'dm') return it.emp.name.toLowerCase().includes(q) || it.emp.department.toLowerCase().includes(q);
        return it.group.name.toLowerCase().includes(q);
      });
    }
    return merged;
  }, [otherEmployees, myGroups, lastMsgTimesDM, lastMsgTimesGroup, unreadCounts, groupUnreadCounts, search]);

  const totalUnread =
    Object.values(unreadCounts).reduce((s, n) => s + n, 0) +
    Object.values(groupUnreadCounts).reduce((s, n) => s + n, 0);

  // ===== Trenutni sogovornik / skupina =====
  const selectedUser = selected?.type === 'dm' ? employees.find(e => e.email === selected.id) : null;
  const selectedGroup = selected?.type === 'group' ? myGroups.find(g => g.id === selected.id) : null;
  const selectedGroupMembers = selectedGroup ? (groupMembersMap[selectedGroup.id] || []) : [];

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
      <div className="flex h-full">

        {/* LEVA: seznam */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-as-gray-200`}
          style={{ background: 'linear-gradient(180deg, #FAFBFC 0%, #F4F6F9 100%)' }}>
          <div className="p-3 border-b border-as-gray-200 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5" style={{ color: AS_RED }} />
              <h2 className="font-bold text-as-gray-700">Klepet</h2>
              {totalUnread > 0 && (
                <span className="ml-1 text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: AS_RED }}>
                  {totalUnread}
                </span>
              )}
              <button
                onClick={() => setSoundEnabled(s => !s)}
                title={soundEnabled ? 'Izklopi zvok' : 'Vklopi zvok'}
                className="ml-auto p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400 hover:text-as-gray-700 transition">
                {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowCreateGroup(true)}
                title="Nova skupina"
                className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-500 hover:text-as-gray-700 transition">
                <Users className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-as-gray-400" />
              <input type="text" placeholder="Išči..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sortedItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-as-gray-400">Ni zadetkov.</div>
            ) : (
              sortedItems.map(item => {
                if (item.kind === 'dm') {
                  const { emp, unread } = item;
                  const online = isOnline(presence[emp.email]);
                  const active = selected?.type === 'dm' && selected.id === emp.email;
                  const color = avatarColor(emp.email);
                  return (
                    <button key={item.key} onClick={() => setSelected({ type: 'dm', id: emp.email })}
                      className={`w-full flex items-center gap-3 p-3 border-b border-as-gray-100 hover:bg-white transition text-left ${active ? 'bg-white border-l-4' : ''}`}
                      style={active ? { borderLeftColor: AS_RED } : {}}>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ backgroundColor: color }}>
                          {initials(emp.name)}
                        </div>
                        {online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Online" />
                        )}
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
                // GROUP
                const { group, unread } = item;
                const active = selected?.type === 'group' && selected.id === group.id;
                const memCount = (groupMembersMap[group.id] || []).length;
                return (
                  <button key={item.key} onClick={() => setSelected({ type: 'group', id: group.id })}
                    className={`w-full flex items-center gap-3 p-3 border-b border-as-gray-100 hover:bg-white transition text-left ${active ? 'bg-white border-l-4' : ''}`}
                    style={active ? { borderLeftColor: group.color || '#0E7490' } : {}}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: group.color || '#0E7490' }}>
                      <Users className="w-5 h-5" />
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
                      <div className="text-xs text-as-gray-400 truncate">👥 {memCount} {memCount === 1 ? 'član' : memCount < 5 ? 'člani' : 'članov'}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* DESNO: pogovor */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col`} style={{ background: BG_CHAT }}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-as-gray-400 text-sm">
              👈 Izberi sogovornika ali skupino.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-as-gray-200 bg-white flex items-center gap-3 shadow-sm">
                <button onClick={() => setSelected(null)} className="md:hidden p-1 hover:bg-as-gray-100 rounded">
                  <X className="w-5 h-5 text-as-gray-500" />
                </button>
                {selected.type === 'dm' && selectedUser ? (
                  <>
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow" style={{ backgroundColor: avatarColor(selectedUser.email) }}>
                        {initials(selectedUser.name)}
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
                  </>
                ) : selectedGroup ? (
                  <>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow" style={{ backgroundColor: selectedGroup.color || '#0E7490' }}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-as-gray-700">{selectedGroup.name}</div>
                      <div className="text-xs text-as-gray-400">
                        👥 {selectedGroupMembers.length} članov · ustvaril/a: {employees.find(e => e.email === selectedGroup.created_by_email)?.name || selectedGroup.created_by_email}
                      </div>
                    </div>
                    <button onClick={() => setShowGroupSettings(true)}
                      className="p-2 hover:bg-as-gray-100 rounded-lg text-as-gray-500 hover:text-as-gray-700 transition"
                      title="Nastavitve skupine">
                      <Users className="w-4 h-4" />
                    </button>
                  </>
                ) : null}
              </div>

              {/* Sporočila */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-10 text-as-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Nalagam...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-as-gray-400 text-sm">
                    Še ni sporočil.
                  </div>
                ) : (
                  messages.map(m => {
                    const mine = m.from_email === currentUser.email;
                    const editable = mine && canEditMessage(m.created_at);
                    const author = employees.find(e => e.email === m.from_email);
                    const showAuthor = selected.type === 'group' && !mine; // pri skupinah priži ime
                    const bubbleColor = mine ? AS_RED : '#FFFFFF';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                        {/* avatar samo pri drugih v skupinah */}
                        {showAuthor && (
                          <div className="mr-2 mt-1">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm" style={{ backgroundColor: avatarColor(m.from_email) }}>
                              {initials(author?.name || m.from_email)}
                            </div>
                          </div>
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'rounded-br-sm text-white' : 'rounded-bl-sm text-as-gray-700 border border-as-gray-200'}`}
                          style={{ backgroundColor: bubbleColor }}>
                          {showAuthor && (
                            <div className="text-[11px] font-bold mb-0.5" style={{ color: avatarColor(m.from_email) }}>{author?.name || m.from_email}</div>
                          )}
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
                              {m.attachment_url && (
                                <Attachment att={{ url: m.attachment_url, name: m.attachment_name, size: m.attachment_size, type: m.attachment_type }} mine={mine} />
                              )}
                              {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                              <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${mine ? 'text-white/70 justify-end' : 'text-as-gray-400'}`}>
                                <span>{formatChatTime(m.created_at)}</span>
                                {m.edited_at && <span className="italic">· ured.</span>}
                                {mine && selected.type === 'dm' && (m.read_at ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                              </div>
                              {mine && selected.type === 'group' && (
                                <GroupReadReceipt
                                  message={m}
                                  members={selectedGroupMembers}
                                  readStatus={groupReadStatus}
                                  employees={employees}
                                  currentUserEmail={currentUser.email}
                                />
                              )}
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

              {/* Pending priloga */}
              {pendingAttachment && (
                <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 flex items-center gap-2">
                  {isImageAttachment(pendingAttachment.type) ? (
                    <img src={pendingAttachment.url} alt="" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <FileText className="w-8 h-8 text-blue-600" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-blue-900 truncate">{pendingAttachment.name}</div>
                    <div className="text-xs text-blue-700">{formatFileSize(pendingAttachment.size)}</div>
                  </div>
                  <button onClick={() => setPendingAttachment(null)} className="p-1 text-blue-700 hover:bg-blue-100 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-as-gray-200 bg-white">
                <div className="flex items-end gap-2">
                  <button onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="p-2.5 rounded-xl text-as-gray-400 hover:text-as-gray-700 hover:bg-as-gray-100 transition disabled:opacity-50"
                    title="Pripni datoteko">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
                  <textarea value={inputText} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
                    rows={1} placeholder="Napiši sporočilo... (Enter za pošlji)"
                    className="flex-1 px-3 py-2 border border-as-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-as-red-100 max-h-32" />
                  <button onClick={handleSend} disabled={!inputText.trim() && !pendingAttachment}
                    className="p-2.5 rounded-xl text-white disabled:opacity-40 transition shadow-md"
                    style={{ backgroundColor: AS_RED }}>
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          currentUser={currentUser}
          employees={otherEmployees}
          onClose={() => setShowCreateGroup(false)}
          onCreated={async (newGroup) => {
            setShowCreateGroup(false);
            await reloadAllCounts();
            setSelected({ type: 'group', id: newGroup.id });
          }}
        />
      )}

      {/* Group Settings Modal */}
      {showGroupSettings && selectedGroup && (
        <GroupSettingsModal
          group={selectedGroup}
          members={selectedGroupMembers}
          allEmployees={employees}
          currentUser={currentUser}
          onClose={() => setShowGroupSettings(false)}
          onChanged={async () => { await reloadAllCounts(); }}
          onDeleted={async () => {
            setShowGroupSettings(false);
            setSelected(null);
            await reloadAllCounts();
          }}
        />
      )}
    </div>
  );
}

// =====================================
// Group read receipt (kdo je prebral)
// =====================================
function GroupReadReceipt({ message, members, readStatus, employees, currentUserEmail }) {
  const [showDetails, setShowDetails] = useState(false);
  // Čas sporočila
  const msgTime = new Date(message.created_at);
  // Čdani člani brez avtorja (avtor je sam)
  const otherMembers = (members || []).filter(e => e !== currentUserEmail);
  // Tisti, ki imajo last_read_at >= msgTime, so prebrali
  const readers = otherMembers.filter(email => {
    const lastRead = readStatus[email];
    if (!lastRead) return false;
    return new Date(lastRead) >= msgTime;
  });
  if (otherMembers.length === 0) return null;
  const total = otherMembers.length;
  const readCount = readers.length;
  const readerNames = readers.map(e => employees.find(emp => emp.email === e)?.name || e);
  let summary;
  if (readCount === 0) summary = '✓ poslano';
  else if (readCount === total) summary = `✓✓ vsi prebrali`;
  else if (readCount <= 3) summary = `✓✓ prebrali: ${readerNames.join(', ')}`;
  else summary = `✓✓ prebrali: ${readCount}/${total}`;
  return (
    <div className="flex justify-end mt-0.5">
      <button
        onClick={() => setShowDetails(s => !s)}
        className="text-[9px] text-white/80 hover:text-white underline-offset-2 hover:underline"
        title="Klikni za podrobnosti"
      >
        {summary}
      </button>
      {showDetails && (
        <div className="absolute bg-as-gray-800 text-white text-[10px] rounded-lg shadow-2xl mt-5 p-2 max-w-xs z-10"
          onClick={() => setShowDetails(false)}>
          <div className="font-bold mb-1">Prebrali ({readCount}/{total}):</div>
          {otherMembers.map(email => {
            const emp = employees.find(e => e.email === email);
            const lastRead = readStatus[email];
            const hasRead = lastRead && new Date(lastRead) >= msgTime;
            return (
              <div key={email} className="flex items-center gap-1.5">
                <span className={hasRead ? 'text-green-300' : 'text-as-gray-400'}>{hasRead ? '✓✓' : '•'}</span>
                <span className={hasRead ? '' : 'text-as-gray-400'}>{emp?.name || email}</span>
                {hasRead && <span className="text-as-gray-400 ml-auto">{new Date(lastRead).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================
// Attachment renderer
// =====================================
function Attachment({ att, mine }) {
  if (!att.url) return null;
  if (isImageAttachment(att.type)) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img src={att.url} alt={att.name} className="max-w-full max-h-64 rounded-lg object-cover" />
      </a>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" download={att.name}
      className={`flex items-center gap-2 mb-1 p-2 rounded-lg ${mine ? 'bg-white/20 hover:bg-white/30' : 'bg-as-gray-100 hover:bg-as-gray-200'} transition`}>
      <FileText className={`w-5 h-5 ${mine ? 'text-white' : 'text-as-gray-600'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${mine ? 'text-white' : 'text-as-gray-700'}`}>{att.name}</div>
        <div className={`text-[10px] ${mine ? 'text-white/80' : 'text-as-gray-500'}`}>{formatFileSize(att.size)}</div>
      </div>
      <Download className={`w-4 h-4 ${mine ? 'text-white' : 'text-as-gray-500'}`} />
    </a>
  );
}

// =====================================
// Create Group Modal
// =====================================
function CreateGroupModal({ currentUser, employees, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const toggleMember = (email) => {
    const next = new Set(selected);
    if (next.has(email)) next.delete(email); else next.add(email);
    setSelected(next);
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.size === 0) {
      alert('Vnesi ime skupine in dodaj vsaj 1 člana.');
      return;
    }
    setSaving(true);
    try {
      const g = await createGroup(name, currentUser.email, [...selected], color);
      onCreated(g);
    } catch (e) { alert('Napaka: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 className="font-bold text-as-gray-700 flex items-center gap-2"><Users className="w-5 h-5" style={{ color: AS_RED }} /> Nova skupina</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1">Ime skupine</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="npr. Prodajna ekipa"
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-2">Barva</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-as-gray-700' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-2">Člani ({selected.size} izbranih)</label>
            <div className="max-h-60 overflow-y-auto border border-as-gray-200 rounded-lg">
              {employees.map(emp => {
                const checked = selected.has(emp.email);
                return (
                  <label key={emp.email} className="flex items-center gap-3 p-2.5 border-b border-as-gray-100 last:border-b-0 hover:bg-as-gray-50 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(emp.email)}
                      className="w-4 h-4 accent-as-red-600" />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: avatarColor(emp.email) }}>
                      {initials(emp.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-as-gray-700">{emp.name}</div>
                      <div className="text-xs text-as-gray-400">{emp.department}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-as-gray-600 hover:bg-as-gray-100 rounded-lg">Prekliči</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md disabled:opacity-60"
            style={{ backgroundColor: AS_RED }}>
            {saving ? <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> : <Plus className="w-4 h-4 inline mr-1" />}
            Ustvari
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================
// Group Settings Modal
// =====================================
function GroupSettingsModal({ group, members, allEmployees, currentUser, onClose, onChanged, onDeleted }) {
  const isCreator = group.created_by_email === currentUser.email;
  const [adding, setAdding] = useState(false);
  const nonMembers = allEmployees.filter(e => !members.includes(e.email));

  const handleAdd = async (email) => {
    try { await addGroupMember(group.id, email); await onChanged(); }
    catch (e) { alert(e.message); }
  };

  const handleRemove = async (email) => {
    if (!confirm(`Odstrani ${allEmployees.find(e => e.email === email)?.name || email} iz skupine?`)) return;
    try { await removeGroupMember(group.id, email); await onChanged(); }
    catch (e) { alert(e.message); }
  };

  const handleDelete = async () => {
    if (!confirm(`Zbriši skupino "${group.name}"? Vsa sporočila bodo izgubljena.`)) return;
    try { await deleteGroup(group.id, currentUser.email); await onDeleted(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-5 py-3 flex items-center justify-between">
          <h2 className="font-bold text-as-gray-700 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: group.color || '#0E7490' }}>
              <Users className="w-4 h-4" />
            </div>
            {group.name}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-2">Člani ({members.length})</div>
            <div className="border border-as-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {members.map(email => {
                const emp = allEmployees.find(e => e.email === email);
                const isMe = email === currentUser.email;
                const isCreatorOfThis = email === group.created_by_email;
                return (
                  <div key={email} className="flex items-center gap-3 p-2.5 border-b border-as-gray-100 last:border-b-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: avatarColor(email) }}>
                      {initials(emp?.name || email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-as-gray-700">
                        {emp?.name || email}
                        {isMe && <span className="text-xs font-normal text-as-gray-400 ml-1">(ti)</span>}
                        {isCreatorOfThis && <span className="text-xs font-normal text-as-red-600 ml-1">• ustvarjalec</span>}
                      </div>
                      <div className="text-xs text-as-gray-400">{emp?.department || ''}</div>
                    </div>
                    {isCreator && !isCreatorOfThis && (
                      <button onClick={() => handleRemove(email)} className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Odstrani">
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isCreator && nonMembers.length > 0 && (
            <div>
              <button onClick={() => setAdding(s => !s)} className="text-sm font-semibold text-as-red-600 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Dodaj člana
              </button>
              {adding && (
                <div className="mt-2 border border-as-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {nonMembers.map(emp => (
                    <button key={emp.email} onClick={() => handleAdd(emp.email)}
                      className="w-full flex items-center gap-3 p-2.5 border-b border-as-gray-100 last:border-b-0 hover:bg-as-gray-50 text-left">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: avatarColor(emp.email) }}>
                        {initials(emp.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-as-gray-700">{emp.name}</div>
                        <div className="text-xs text-as-gray-400">{emp.department}</div>
                      </div>
                      <Plus className="w-4 h-4 text-as-red-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isCreator && (
            <div className="pt-3 border-t border-as-gray-200">
              <button onClick={handleDelete} className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Zbriši skupino
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
