// Globalne nastavitve aplikacije (tabela app_settings: key TEXT PK, value JSONB)
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase.js';

// Ključi v tabeli app_settings
// module_labels    -> { "tasks": "Opravila", "crm": "Stranke", ... }
// modules_disabled -> ["gradiva", "crm"]   (moduli, ki so globalno izklopljeni)
// departments      -> ["Nabava", "Prodaja", ...]  (prazno = uporabi constants.js)
// areas            -> ["Prodaja", "Montaža", ...] (prazno = uporabi constants.js)
export const SETTINGS_DEFAULTS = {
  module_labels: {},
  modules_disabled: [],
  departments: [],
  areas: [],
};

export async function loadAppSettings() {
  try {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error || !data) return { ...SETTINGS_DEFAULTS };
    const out = { ...SETTINGS_DEFAULTS };
    data.forEach((row) => {
      if (row && row.key && row.value !== null && row.value !== undefined) out[row.key] = row.value;
    });
    return out;
  } catch (e) {
    return { ...SETTINGS_DEFAULTS };
  }
}

export async function saveAppSetting(key, value) {
  return supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export function useAppSettings() {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const s = await loadAppSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { settings, loading, reload };
}
