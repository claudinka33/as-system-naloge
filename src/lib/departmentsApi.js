// departmentsApi.js — nalaganje in shranjevanje konfiguracije delovnih mest (tabela custom_departments)
// Konfiguracija je popolnoma podatkovno gnana; App.jsx iz nje zgradi navigacijo in module.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase.js';

// Privzeta prazna kategorija / polje (za graditelj v UI)
export const EMPTY_CATEGORY = () => ({
  key: 'kat_' + Math.random().toString(36).slice(2, 8),
  name: '',
  icon: 'FileText',
  color: '#374151',
  bgColor: '#E5E7EB',
  desc: '',
  subKategorije: [],
});

export const FIELD_TYPES = [
  { value: 'text', label: 'Besedilo' },
  { value: 'number', label: 'Število' },
  { value: 'date', label: 'Datum' },
  { value: 'select', label: 'Spustni seznam' },
  { value: 'textarea', label: 'Daljše besedilo' },
];

export const EMPTY_FIELD = () => ({
  key: 'polje_' + Math.random().toString(36).slice(2, 8),
  label: '',
  type: 'text',
  options: [],
  required: false,
});

// Očisti/normaliziraj vrstico iz baze v obliko za uporabo
function normalizeRow(r) {
  return {
    id: r.id,
    key: r.key,
    name: r.name || r.key,
    icon: r.icon || 'Building2',
    accentColor: r.accent_color || '#374151',
    accentBg: r.accent_bg || '#E5E7EB',
    descr: r.descr || '',
    categories: Array.isArray(r.categories) ? r.categories : [],
    fields: Array.isArray(r.fields) ? r.fields : [],
    allowedEmails: Array.isArray(r.allowed_emails) ? r.allowed_emails : [],
    sortOrder: r.sort_order ?? 0,
    active: r.active !== false,
  };
}

export async function loadDepartments() {
  try {
    const { data, error } = await supabase
      .from('custom_departments')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error || !data) return [];
    return data.map(normalizeRow);
  } catch (e) {
    return [];
  }
}

// payload je normalizirana oblika; pretvorimo nazaj v db stolpce
export async function saveDepartment(dep) {
  const row = {
    key: dep.key,
    name: dep.name,
    icon: dep.icon || 'Building2',
    accent_color: dep.accentColor || '#374151',
    accent_bg: dep.accentBg || '#E5E7EB',
    descr: dep.descr || null,
    categories: dep.categories || [],
    fields: dep.fields || [],
    allowed_emails: dep.allowedEmails || [],
    sort_order: dep.sortOrder ?? 0,
    active: dep.active !== false,
    updated_at: new Date().toISOString(),
  };
  if (dep.id) {
    return supabase.from('custom_departments').update(row).eq('id', dep.id);
  }
  return supabase.from('custom_departments').insert([row]);
}

export async function deleteDepartment(id) {
  return supabase.from('custom_departments').delete().eq('id', id);
}

export function useDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const d = await loadDepartments();
    setDepartments(d);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { departments, loading, reload };
}

// slug iz imena (za ključ novega delovnega mesta)
export function slugify(name) {
  const map = { 'č': 'c', 'š': 's', 'ž': 'z', 'Č': 'c', 'Š': 's', 'Ž': 'z', 'đ': 'd', 'ć': 'c' };
  return (name || '')
    .split('').map((ch) => map[ch] ?? ch).join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || ('dm_' + Math.random().toString(36).slice(2, 7));
}
