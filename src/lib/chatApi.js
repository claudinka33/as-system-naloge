// chatApi.js — Supabase queries za notranji klepet
import { supabase } from '../supabase.js';

// ===== SPOROČILA =====

// Vse sporočilo med dvema osebama (oba smera)
export async function getConversation(emailA, emailB) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .or(`and(from_email.eq.${emailA},to_email.eq.${emailB}),and(from_email.eq.${emailB},to_email.eq.${emailA})`)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data || [];
}

// Pošlji novo sporočilo
export async function sendMessage(from_email, to_email, text) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ from_email, to_email, text: text.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Označi sporočila kot prebrana (vsa od `from_email` k meni `to_email`)
export async function markAsRead(my_email, from_email) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_email', my_email)
    .eq('from_email', from_email)
    .is('read_at', null);
  if (error) throw error;
}

// Števec neprebranih sporočil po pošiljatelju (za pikice ob imenih)
export async function getUnreadCounts(my_email) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('from_email')
    .eq('to_email', my_email)
    .is('read_at', null)
    .is('deleted_at', null);
  if (error) throw error;
  const counts = {};
  (data || []).forEach(m => {
    counts[m.from_email] = (counts[m.from_email] || 0) + 1;
  });
  return counts;
}

// Skupno število neprebranih (za gumb "Klepet (3)")
export async function getTotalUnread(my_email) {
  const { count, error } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('to_email', my_email)
    .is('read_at', null)
    .is('deleted_at', null);
  if (error) throw error;
  return count || 0;
}

// Uredi sporočilo (samo 7 dni nazaj, samo svoje)
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

// Izbriši sporočilo (soft delete, samo svoje)
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
    .from('chat_typing')
    .delete()
    .eq('from_email', from_email)
    .eq('to_email', to_email);
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
  const { data, error } = await supabase
    .from('user_presence')
    .select('*');
  if (error) throw error;
  return data || [];
}

// ===== HELPERS =====

export function isOnline(presenceRecord) {
  if (!presenceRecord) return false;
  const last = new Date(presenceRecord.last_seen_at);
  const diffSec = (Date.now() - last.getTime()) / 1000;
  return diffSec < 60; // online če v zadnji minuti
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
