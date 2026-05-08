// productionApi.js — Supabase queries za Proizvodnja modul
import { supabase } from '../supabase.js';

// ===== ŠIFRANTI =====

export async function loadMachines() {
  const { data, error } = await supabase
    .from('production_machines')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function loadProducts() {
  const { data, error } = await supabase
    .from('production_products')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function loadWires() {
  const { data, error } = await supabase
    .from('production_wires')
    .select('*')
    .eq('active', true)
    .order('code');
  if (error) throw error;
  return data || [];
}

export async function loadWorkers() {
  const { data, error } = await supabase
    .from('production_workers')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function loadBreakdownReasons() {
  const { data, error } = await supabase
    .from('breakdown_reasons')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function loadDefectReasons() {
  const { data, error } = await supabase
    .from('defect_reasons')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function loadPlans(year) {
  const { data, error } = await supabase
    .from('production_plans')
    .select('*, production_products(name, category, yearly_plan)')
    .eq('year', year);
  if (error) throw error;
  return data || [];
}

// ===== TRANSAKCIJE =====

export async function insertProduction(entry) {
  const { data, error } = await supabase
    .from('production_entries')
    .insert([entry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertBreakdown(entry) {
  const { data, error } = await supabase
    .from('machine_breakdowns')
    .insert([entry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function insertScrap(entry) {
  const { data, error } = await supabase
    .from('production_scrap')
    .insert([entry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ===== POROČILA =====

export async function getDailyData(date) {
  const [productionRes, breakdownRes, scrapRes] = await Promise.all([
    supabase
      .from('production_entries')
      .select('*, production_machines(name, category), production_products(name)')
      .eq('date', date)
      .order('created_at'),
    supabase
      .from('machine_breakdowns')
      .select('*, production_machines(name, category), breakdown_reasons(name, category)')
      .eq('date', date)
      .order('created_at'),
    supabase
      .from('production_scrap')
      .select('*, production_machines(name, category), production_products(name), production_wires(code), defect_reasons(name), production_workers(name)')
      .eq('date', date)
      .order('created_at'),
  ]);

  if (productionRes.error) throw productionRes.error;
  if (breakdownRes.error) throw breakdownRes.error;
  if (scrapRes.error) throw scrapRes.error;

  return {
    production: productionRes.data || [],
    breakdowns: breakdownRes.data || [],
    scrap: scrapRes.data || [],
  };
}

export async function getMonthlyData(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const [productionRes, breakdownRes, scrapRes] = await Promise.all([
    supabase
      .from('production_entries')
      .select('*, production_machines(name, category), production_products(name, category)')
      .gte('date', startDate)
      .lt('date', endDate),
    supabase
      .from('machine_breakdowns')
      .select('*, production_machines(name, category), breakdown_reasons(name, category)')
      .gte('date', startDate)
      .lt('date', endDate),
    supabase
      .from('production_scrap')
      .select('*, production_machines(name), production_products(name), defect_reasons(name)')
      .gte('date', startDate)
      .lt('date', endDate),
  ]);

  if (productionRes.error) throw productionRes.error;
  if (breakdownRes.error) throw breakdownRes.error;
  if (scrapRes.error) throw scrapRes.error;

  return {
    production: productionRes.data || [],
    breakdowns: breakdownRes.data || [],
    scrap: scrapRes.data || [],
  };
}

// ===== HELPERS =====

export const CATEGORY_LABELS = {
  vijaki: 'Vijaki',
  pini: 'PINI',
  sidra: 'Sidra',
  sidra_gildemeister: 'Sidra Gildemeister',
  zicniki: 'Žičniki',
};

export const CATEGORY_ICONS = {
  vijaki: '🔩',
  pini: '📍',
  sidra: '⚓',
  sidra_gildemeister: '⚙️',
  zicniki: '🔧',
};

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
