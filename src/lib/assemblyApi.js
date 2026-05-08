// assemblyApi.js — Supabase queries za Montaža modul
import { supabase } from '../supabase.js';

// ===== ŠIFRANTI =====

export async function loadAssemblyWorkers() {
  const { data, error } = await supabase
    .from('assembly_workers')
    .select('*')
    .eq('active', true)
    .order('display_order');
  if (error) throw error;
  return data || [];
}

export async function loadAssemblyMachines() {
  const { data, error } = await supabase
    .from('assembly_machines')
    .select('*')
    .eq('active', true)
    .order('display_order');
  if (error) throw error;
  return data || [];
}

export async function loadAssemblyActivities() {
  const { data, error } = await supabase
    .from('assembly_activity_types')
    .select('*')
    .eq('active', true)
    .order('display_order');
  if (error) throw error;
  return data || [];
}

// ===== TRANSAKCIJE =====

// Upsert: če obstaja vnos za isti dan + delavec, ga posodobi
export async function upsertAssemblyEntry(entry) {
  const { data, error } = await supabase
    .from('assembly_entries')
    .upsert([{ ...entry, updated_at: new Date().toISOString() }], {
      onConflict: 'date,worker_id'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAssemblyEntry(date, worker_id) {
  const { data, error } = await supabase
    .from('assembly_entries')
    .select('*')
    .eq('date', date)
    .eq('worker_id', worker_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ===== POROČILA =====

export async function getDailyAssembly(date) {
  const { data, error } = await supabase
    .from('assembly_entries')
    .select('*, assembly_workers(name, work_type)')
    .eq('date', date)
    .order('worker_id');
  if (error) throw error;
  return data || [];
}

export async function getMonthlyAssembly(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('assembly_entries')
    .select('*, assembly_workers(name, work_type)')
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date');
  if (error) throw error;
  return data || [];
}

// ===== HELPERS =====

export const SLOVENIAN_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

export function formatNumber(n) {
  if (n == null) return '0';
  return new Intl.NumberFormat('sl-SI').format(n);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export const WORK_TYPE_LABELS = {
  avtomat: '🤖 Avtomat',
  rocna: '👐 Ročna',
  oba: '🤖👐 Oba',
};
