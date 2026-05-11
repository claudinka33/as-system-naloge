// HomeChat.jsx — Klepet widget na Domov strani (zadnji pogovori)
import React, { useState, useEffect } from 'react';
import { MessageSquare, Users, ChevronRight } from 'lucide-react';
import {
  getUnreadCounts, getLastMessageTimes,
  getMyGroups, getGroupReads, getGroupUnreadCounts, getGroupLastMessageTimes,
  getPresence, isOnline, formatChatTime,
  avatarColor, initials
} from './lib/chatApi.js';
import { supabase } from './supabase.js';

const AS_RED = '#C8102E';
const MAX_ITEMS = 6;

export default function HomeChat({ currentUser, employees, onOpenChat, onNavigateChat }) {
  const [unreadDM, setUnreadDM] = useState({});
  const [unreadGroup, setUnreadGroup] = useState({});
  const [myGroups, setMyGroups] = useState([]);
  const [lastMsgDM, setLastMsgDM] = useState({});
  const [lastMsgGroup, setLastMsgGroup] = useState({});
  const [presence, setPresence] = useState({});

  const otherEmployees = employees.filter(e => e.email !== currentUser.email);

  const reloadAll = async () => {
    try {
      const [dm, groups, reads, lastDM, p] = await Promise.all([
        getUnreadCounts(currentUser.email),
        getMyGroups(currentUser.email),
        getGroupReads(currentUser.email),
        getLastMessageTimes(currentUser.email),
        getPresence(),
      ]);
      setUnreadDM(dm);
      setMyGroups(groups);
      setLastMsgDM(lastDM);
      const map = {};
      p.forEach(x => { map[x.email] = x; });
      setPresence(map);
      const [gUnread, gLast] = await Promise.all([
        getGroupUnreadCounts(currentUser.email, groups, reads),
        getGroupLastMessageTimes(groups),
      ]);
      setUnreadGroup(gUnread);
      setLastMsgGroup(gLast);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    reloadAll();
    const id = setInterval(reloadAll, 15000);
    const channel = supabase
      .channel('home-chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, reloadAll)
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sortirano: zadnji aktivni pogovori prvi, samo MAX_ITEMS
  const dmItems = otherEmployees
    .filter(emp => (unreadDM[emp.email] || 0) > 0 || lastMsgDM[emp.email])
    .map(emp => ({
      kind: 'dm', emp,
      sortTime: lastMsgDM[emp.email] || null,
      unread: unreadDM[emp.email] || 0,
    }));
  const groupItems = myGroups.map(g => ({
    kind: 'group', group: g,
    sortTime: lastMsgGroup[g.id] || g.created_at,
    unread: unreadGroup[g.id] || 0,
  }));
  const merged = [...dmItems, ...groupItems]
    .sort((a, b) => {
      if (a.sortTime && b.sortTime) return new Date(b.sortTime) - new Date(a.sortTime);
      if (a.sortTime) return -1;
      if (b.sortTime) return 1;
      return 0;
    })
    .slice(0, MAX_ITEMS);

  const totalUnread =
    Object.values(unreadDM).reduce((s, n) => s + n, 0) +
    Object.values(unreadGroup).reduce((s, n) => s + n, 0);

  if (merged.length === 0) return null;

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-as-gray-100 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: AS_RED }}>
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-as-gray-700">Klepet</h3>
          <div className="text-xs text-as-gray-500">
            {totalUnread > 0 ? (
              <span className="font-semibold" style={{ color: AS_RED }}>{totalUnread} {totalUnread === 1 ? 'neprebrano' : 'neprebranih'} sporočil</span>
            ) : 'Vsi pogovori prebrani'}
          </div>
        </div>
        <button onClick={onNavigateChat}
          className="text-xs font-semibold text-as-red-600 hover:text-as-red-700 flex items-center gap-1 px-3 py-1.5 hover:bg-as-red-50 rounded-lg transition">
          Odpri klepet <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="divide-y divide-as-gray-100">
        {merged.map(item => {
          if (item.kind === 'dm') {
            const { emp, unread, sortTime } = item;
            const online = isOnline(presence[emp.email]);
            const color = avatarColor(emp.email);
            return (
              <button key={`h-dm-${emp.email}`}
                onClick={() => onOpenChat && onOpenChat('dm', emp.email)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-as-gray-50 transition text-left">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm" style={{ backgroundColor: color }}>
                    {initials(emp.name)}
                  </div>
                  {online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-semibold text-sm truncate ${unread > 0 ? 'text-as-gray-900' : 'text-as-gray-700'}`}>{emp.name}</span>
                    {sortTime && <span className="text-[10px] text-as-gray-400">{formatChatTime(sortTime)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-as-gray-400 truncate">{emp.department}</span>
                    {unread > 0 && (
                      <span className="text-xs font-bold text-white px-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: AS_RED, minWidth: '20px', textAlign: 'center' }}>
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          }
          const { group, unread, sortTime } = item;
          return (
            <button key={`h-g-${group.id}`}
              onClick={() => onOpenChat && onOpenChat('group', group.id)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-as-gray-50 transition text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: group.color || '#0E7490' }}>
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`font-semibold text-sm truncate ${unread > 0 ? 'text-as-gray-900' : 'text-as-gray-700'}`}>{group.name}</span>
                  {sortTime && <span className="text-[10px] text-as-gray-400">{formatChatTime(sortTime)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-as-gray-400 truncate">👥 skupina</span>
                  {unread > 0 && (
                    <span className="text-xs font-bold text-white px-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: AS_RED, minWidth: '20px', textAlign: 'center' }}>
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
