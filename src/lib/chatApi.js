// chatApi.js — Supabase queries za notranji klepet (V2: skupine + priloge)
import { supabase } from '../supabase.js';

// ===== 1-NA-1 SPOROČILA =====

export async function getConversation(emailA, emailB) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .or(`and(from_email.eq.${emailA},to_email.eq.${emailB}),and(from_email.eq.${emailB},to_email.eq.${emailA})`)
    .is('group_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function sendMessage(from_email, to_email, text, attachment = null) {
  const payload = {
    from_email,
    to_email,
    text: text?.trim() || '',
  };
  if (attachment) {
    payload.attachment_url = attachment.url;
    payload.attachment_name = attachment.name;
    payload.attachment_size = attachment.size;
    payload.attachment_type = attachment.type;
  }
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAsRead(my_email, from_email) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_email', my_email)
    .eq('from_email', from_email)
    .is('group_id', null)
    .is('read_at', null);
  if (error) throw error;
}

export async function getUnreadCounts(my_email) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('from_email')
    .eq('to_email', my_email)
    .is('group_id', null)
    .is('read_at', null)
    .is('deleted_at', null);
  if (error) throw error;
  const counts = {};
  (data || []).forEach(m => { counts[m.from_email] = (counts[m.from_email] || 0) + 1; });
  return counts;
}

// Vrne zadnji čas pogovora z vsako osebo (za razvrščanje)
export async function getLastMessageTimes(my_email) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('from_email, to_email, created_at')
    .or(`from_email.eq.${my_email},to_email.eq.${my_email}`)
    .is('group_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const map = {};
  (data || []).forEach(m => {
    const other = m.from_email === my_email ? m.to_email : m.from_email;
    if (!map[other] || new Date(m.created_at) > new Date(map[other])) {
      map[other] = m.created_at;
    }
  });
  return map;
}

export async function editMessage(id, my_email, newText) {
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ text: newText.trim(), edited_at: new Date().toISOString() })
    .eq('id', id)
    .eq('from_email', my_email)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(id, my_email) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('from_email', my_email);
  if (error) throw error;
}

// ===== TIPKANJE =====

export async function setTyping(from_email, to_email) {
  const { error } = await supabase
    .from('chat_typing')
    .upsert({ from_email, to_email, updated_at: new Date().toISOString() }, { onConflict: 'from_email,to_email' });
  if (error) throw error;
}

export async function clearTyping(from_email, to_email) {
  const { error } = await supabase
    .from('chat_typing').delete()
    .eq('from_email', from_email).eq('to_email', to_email);
  if (error) console.warn('clearTyping:', error.message);
}

// ===== PRISOTNOST =====

export async function updatePresence(email) {
  const { error } = await supabase
    .from('user_presence')
    .upsert({ email, last_seen_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) console.warn('updatePresence:', error.message);
}

export async function getPresence() {
  const { data, error } = await supabase.from('user_presence').select('*');
  if (error) throw error;
  return data || [];
}

// ===== SKUPINE =====

export async function getMyGroups(my_email) {
  const { data, error } = await supabase
    .from('chat_group_members')
    .select('group_id, chat_groups(*)')
    .eq('member_email', my_email);
  if (error) throw error;
  return (data || []).map(d => d.chat_groups).filter(Boolean);
}

export async function getGroupMembers(group_id) {
  const { data, error } = await supabase
    .from('chat_group_members')
    .select('*')
    .eq('group_id', group_id);
  if (error) throw error;
  return data || [];
}

export async function createGroup(name, created_by_email, member_emails, color = '#0E7490') {
  const { data: group, error } = await supabase
    .from('chat_groups')
    .insert({ name: name.trim(), created_by_email, color })
    .select()
    .single();
  if (error) throw error;
  // dodaj člane (vključno z ustvarjalcem)
  const allMembers = [...new Set([created_by_email, ...member_emails])];
  const memberRows = allMembers.map(e => ({ group_id: group.id, member_email: e }));
  const { error: memErr } = await supabase
    .from('chat_group_members')
    .insert(memberRows);
  if (memErr) throw memErr;
  return group;
}

export async function addGroupMember(group_id, email) {
  const { error } = await supabase
    .from('chat_group_members')
    .insert({ group_id, member_email: email });
  if (error) throw error;
}

export async function removeGroupMember(group_id, email) {
  const { error } = await supabase
    .from('chat_group_members')
    .delete()
    .eq('group_id', group_id)
    .eq('member_email', email);
  if (error) throw error;
}

export async function deleteGroup(group_id, my_email) {
  // samo ustvarjalec lahko zbriše
  const { data: group, error: gErr } = await supabase
    .from('chat_groups').select('*').eq('id', group_id).single();
  if (gErr) throw gErr;
  if (group.created_by_email !== my_email) throw new Error('Samo ustvarjalec lahko zbriše skupino.');
  const { error } = await supabase.from('chat_groups').delete().eq('id', group_id);
  if (error) throw error;
}

export async function getGroupMessages(group_id) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('group_id', group_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data || [];
}

export async function sendGroupMessage(from_email, group_id, text, attachment = null) {
  const payload = {
    from_email,
    group_id,
    text: text?.trim() || '',
    to_email: null,
  };
  if (attachment) {
    payload.attachment_url = attachment.url;
    payload.attachment_name = attachment.name;
    payload.attachment_size = attachment.size;
    payload.attachment_type = attachment.type;
  }
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markGroupAsRead(group_id, my_email) {
  const { error } = await supabase
    .from('chat_group_read')
    .upsert({ group_id, member_email: my_email, last_read_at: new Date().toISOString() }, { onConflict: 'group_id,member_email' });
  if (error) console.warn('markGroupAsRead:', error.message);
}

export async function getGroupReads(my_email) {
  const { data, error } = await supabase
    .from('chat_group_read')
    .select('*')
    .eq('member_email', my_email);
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => { map[r.group_id] = r.last_read_at; });
  return map;
}

// Vrne {group_id: count} neprebranih sporočil v skupinah za uporabnika
export async function getGroupUnreadCounts(my_email, my_groups, group_reads) {
  const counts = {};
  for (const g of my_groups) {
    const lastRead = group_reads[g.id] || '1970-01-01';
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)
      .gt('created_at', lastRead)
      .neq('from_email', my_email)
      .is('deleted_at', null);
    if (!error) counts[g.id] = count || 0;
  }
  return counts;
}

export async function getGroupLastMessageTimes(my_groups) {
  const map = {};
  for (const g of my_groups) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('group_id', g.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!error && data?.[0]) map[g.id] = data[0].created_at;
  }
  return map;
}

// ===== PRILOGE =====

// Upload v Supabase Storage, vrne { url, name, size, type }
export async function uploadAttachment(file, my_email) {
  const ext = file.name.split('.').pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${my_email}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from('chat-attachments')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw upErr;
  const { data: urlData } = supabase.storage
    .from('chat-attachments')
    .getPublicUrl(path);
  return {
    url: urlData.publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

export function isImageAttachment(type) {
  return type && type.startsWith('image/');
}

export function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ===== HELPERS =====

export function isOnline(presenceRecord) {
  if (!presenceRecord) return false;
  const last = new Date(presenceRecord.last_seen_at);
  const diffSec = (Date.now() - last.getTime()) / 1000;
  return diffSec < 60;
}

export function formatChatTime(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Včeraj ${d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}`;
}

export const CHAT_EDIT_LOCK_DAYS = 7;

export function canEditMessage(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const diffMs = Date.now() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= CHAT_EDIT_LOCK_DAYS;
}

// Generira barvo za avatar iz emaila (konsistentno za vsako osebo)
export const AVATAR_COLORS = [
  '#0E7490', // teal
  '#7C2D12', // orange
  '#065F46', // emerald
  '#1E40AF', // blue
  '#831843', // pink
  '#854D0E', // yellow-brown
  '#5B21B6', // violet
  '#9D174D', // pink-dark
  '#0F766E', // teal-dark
  '#A16207', // amber
  '#1D4ED8', // blue-dark
  '#15803D', // green
  '#B91C1C', // red-dark
  '#7E22CE', // purple
];

export function avatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}
