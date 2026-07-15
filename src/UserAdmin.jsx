import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { MODULES } from './modulesConfig.js';
import { DEPARTMENTS, AREA_SUGGESTIONS } from './constants.js';
import { loadAppSettings, saveAppSetting } from './lib/appSettings.js';
import DepartmentsAdmin from './DepartmentsAdmin.jsx';
import { loadDepartments } from './lib/departmentsApi.js';
import { Users, UserPlus, Trash2, Edit2, Eye, EyeOff, X, Check, Shield, Loader2, KeyRound, Settings, Plus, Layers } from 'lucide-react';

function TagList({ list, setList, val, setVal, placeholder }) {
  const add = () => {
    const v = (val || '').trim();
    if (!v || list.includes(v)) { setVal(''); return; }
    setList([...list, v]);
    setVal('');
  };
  const remove = (item) => setList(list.filter((x) => x !== item));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {list.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-700">
            {item}
            <button onClick={() => remove(item)} className="text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
          </span>
        ))}
        {list.length === 0 && <span className="text-sm text-gray-400">Prazno — uporabljajo se privzete vrednosti.</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button onClick={add} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Dodaj
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { id: null, email: '', username: '', name: '', department: '', password: '', is_admin: false, active: true, crm_scope: null };

export default function UserAdmin({ currentUser, legacyModulesFor, onClose, onChanged }) {
  const [tab, setTab] = useState('users'); // 'users' | 'settings'

  // === Uporabniki ===
  const [users, setUsers] = useState([]);
  const [accessMap, setAccessMap] = useState({}); // email -> modules[] (samo če obstaja vrstica)
  const [loading, setLoading] = useState(true);
  const [revealRow, setRevealRow] = useState(null);

  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customAccess, setCustomAccess] = useState(false);
  const [modules, setModules] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // === Nastavitve aplikacije ===
  const [labels, setLabels] = useState({});
  const [disabled, setDisabled] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [newDept, setNewDept] = useState('');
  const [newArea, setNewArea] = useState('');
  const [customModules, setCustomModules] = useState([]); // {key,label} za dodeljevanje pravic
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  useEffect(() => { loadAll(); loadSettings(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [uRes, aRes] = await Promise.all([
      supabase.from('app_users').select('*').order('name', { ascending: true }),
      supabase.from('module_access').select('*')
    ]);
    setUsers((!uRes.error && uRes.data) ? uRes.data : []);
    const map = {};
    if (!aRes.error && aRes.data) aRes.data.forEach(r => { map[r.user_email] = r.modules || []; });
    setAccessMap(map);
    setLoading(false);
  };

  const loadSettings = async () => {
    const deps = await loadDepartments();
    setCustomModules(deps.filter((d) => d.active).map((d) => ({ key: d.key, label: d.name })));
    const s = await loadAppSettings();
    setLabels(s.module_labels || {});
    setDisabled(s.modules_disabled || []);
    setDepartments((s.departments && s.departments.length) ? s.departments : DEPARTMENTS);
    setAreas((s.areas && s.areas.length) ? s.areas : AREA_SUGGESTIONS);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setCustomAccess(false);
    setModules([]);
    setShowPassword(false);
    setError('');
    setShowEditor(true);
  };

  const openEdit = (u) => {
    setForm({ id: u.id, email: u.email, username: u.username, name: u.name, department: u.department || '', password: u.password || '', is_admin: !!u.is_admin, active: u.active !== false, crm_scope: u.crm_scope || null });
    const hasRow = Object.prototype.hasOwnProperty.call(accessMap, u.email);
    setCustomAccess(hasRow);
    setModules(hasRow ? [...accessMap[u.email]] : []);
    setShowPassword(false);
    setError('');
    setShowEditor(true);
  };

  const toggleModule = (key) => {
    setModules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const onToggleCustom = (val) => {
    setCustomAccess(val);
    if (val && modules.length === 0 && legacyModulesFor) {
      const u = { email: form.email, is_admin: form.is_admin, department: form.department };
      setModules(legacyModulesFor(u));
    }
  };

  const save = async () => {
    setError('');
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();
    if (!email || !username || !form.name.trim() || !form.password.trim()) {
      setError('Email, uporabniško ime, ime in geslo so obvezni.');
      return;
    }
    setSaving(true);
    const payload = {
      email,
      username,
      name: form.name.trim(),
      department: form.department.trim() || null,
      password: form.password,
      is_admin: form.is_admin,
      active: form.active,
      crm_scope: form.crm_scope || null
    };
    let userErr = null;
    if (form.id) {
      const { error } = await supabase.from('app_users').update(payload).eq('id', form.id);
      userErr = error;
    } else {
      const { error } = await supabase.from('app_users').insert([payload]);
      userErr = error;
    }
    if (userErr) {
      setError('Napaka pri shranjevanju: ' + userErr.message);
      setSaving(false);
      return;
    }
    if (customAccess) {
      await supabase.from('module_access').upsert({ user_email: email, modules, updated_at: new Date().toISOString() }, { onConflict: 'user_email' });
    } else {
      await supabase.from('module_access').delete().eq('user_email', email);
    }
    setSaving(false);
    setShowEditor(false);
    await loadAll();
    if (onChanged) onChanged();
  };

  const remove = async (u) => {
    if (u.email === currentUser?.email) { alert('Sebe ne moreš izbrisati.'); return; }
    if (!confirm(`Res izbrišeš uporabnika "${u.name}"? Tega ni mogoče razveljaviti.`)) return;
    await supabase.from('app_users').delete().eq('id', u.id);
    await supabase.from('module_access').delete().eq('user_email', u.email);
    await loadAll();
    if (onChanged) onChanged();
  };

  const accessSummary = (u) => {
    if (u.is_admin) return 'Vse (admin)';
    const row = accessMap[u.email];
    if (row) return row.length ? `Po meri (${row.length})` : 'Nič';
    return 'Privzeto';
  };

  // === Nastavitve: akcije ===
  const toggleDisabled = (key) => {
    setDisabled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const setLabel = (key, val) => {
    setLabels(prev => {
      const next = { ...prev };
      if (val.trim()) next[key] = val; else delete next[key];
      return next;
    });
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg('');
    const results = await Promise.all([
      saveAppSetting('module_labels', labels),
      saveAppSetting('modules_disabled', disabled),
      saveAppSetting('departments', departments),
      saveAppSetting('areas', areas),
    ]);
    const err = results.find(r => r && r.error);
    setSavingSettings(false);
    if (err) {
      setSettingsMsg('Napaka: ' + err.error.message);
      return;
    }
    setSettingsMsg('Shranjeno ✓');
    if (onChanged) onChanged();
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-lg z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {tab === 'users' ? <Users className="w-5 h-5 text-red-700" /> : tab === 'departments' ? <Layers className="w-5 h-5 text-red-700" /> : <Settings className="w-5 h-5 text-red-700" />}
              {tab === 'users' ? 'Uporabniki in pravice' : tab === 'departments' ? 'Delovna mesta' : 'Nastavitve aplikacije'}
            </h2>
            <div className="flex items-center gap-2">
              {tab === 'users' && (
                <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm font-semibold"><UserPlus className="w-4 h-4" /> Nov uporabnik</button>
              )}
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Zavihki */}
          <div className="flex gap-1 mt-3 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setTab('users')}
              className="px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5"
              style={tab === 'users' ? { backgroundColor: '#C8102E', color: '#fff' } : { color: '#6B7280' }}
            >
              <Users className="w-4 h-4" /> Uporabniki
            </button>
            <button
              onClick={() => setTab('departments')}
              className="px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5"
              style={tab === 'departments' ? { backgroundColor: '#C8102E', color: '#fff' } : { color: '#6B7280' }}
            >
              <Layers className="w-4 h-4" /> Delovna mesta
            </button>
            <button
              onClick={() => setTab('settings')}
              className="px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5"
              style={tab === 'settings' ? { backgroundColor: '#C8102E', color: '#fff' } : { color: '#6B7280' }}
            >
              <Settings className="w-4 h-4" /> Nastavitve aplikacije
            </button>
          </div>
        </div>

        {/* === ZAVIHEK: UPORABNIKI === */}
        {tab === 'users' && (
          <div className="p-4">
            {loading ? (
              <div className="py-12 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Nalagam...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3 font-semibold">Ime</th>
                      <th className="py-2 pr-3 font-semibold hidden sm:table-cell">Uporabniško</th>
                      <th className="py-2 pr-3 font-semibold hidden md:table-cell">Oddelek</th>
                      <th className="py-2 pr-3 font-semibold">Geslo</th>
                      <th className="py-2 pr-3 font-semibold hidden sm:table-cell">Pravice</th>
                      <th className="py-2 pr-1 font-semibold text-right">Akcije</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={`border-b border-gray-100 ${u.active === false ? 'opacity-50' : ''}`}>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {u.name}
                            {u.is_admin && <Shield className="w-3.5 h-3.5 text-red-600" title="Admin" />}
                          </div>
                          <div className="text-xs text-gray-400 sm:hidden">{u.username}</div>
                        </td>
                        <td className="py-2 pr-3 text-gray-600 hidden sm:table-cell">{u.username}</td>
                        <td className="py-2 pr-3 text-gray-600 hidden md:table-cell">{u.department || '—'}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-gray-700">{revealRow === u.id ? u.password : '••••••••'}</span>
                            <button onClick={() => setRevealRow(revealRow === u.id ? null : u.id)} className="text-gray-400 hover:text-gray-700" title={revealRow === u.id ? 'Skrij' : 'Pokaži'}>
                              {revealRow === u.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{accessSummary(u)}</span></td>
                        <td className="py-2 pr-1">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Uredi"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => remove(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Izbriši"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-gray-500">Ni uporabnikov. Klikni "Nov uporabnik".</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === ZAVIHEK: DELOVNA MESTA === */}
        {tab === 'departments' && (
          <DepartmentsAdmin currentUser={currentUser} onChanged={onChanged} />
        )}

        {/* === ZAVIHEK: NASTAVITVE APLIKACIJE === */}
        {tab === 'settings' && (
          <div className="p-4 space-y-5">
            {/* Moduli: ime + vklop/izklop */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-gray-900 mb-1">Moduli v zgornji vrstici</div>
              <p className="text-xs text-gray-500 mb-3">Preimenuj gumb (prazno = privzeto ime) ali ga izklopi za vse uporabnike.</p>
              <div className="space-y-2">
                {MODULES.map(m => {
                  const off = disabled.includes(m.key);
                  return (
                    <div key={m.key} className={`flex items-center gap-3 p-2 rounded-lg border ${off ? 'bg-gray-50 border-gray-200' : 'border-gray-100'}`}>
                      <label className="flex items-center gap-2 cursor-pointer w-32 flex-shrink-0">
                        <input type="checkbox" checked={!off} onChange={() => toggleDisabled(m.key)} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                        <span className={`text-sm font-semibold ${off ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{m.label}</span>
                      </label>
                      <input
                        value={labels[m.key] || ''}
                        onChange={(e) => setLabel(m.key, e.target.value)}
                        placeholder={`Privzeto: ${m.label}`}
                        disabled={off}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Oddelki */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-gray-900 mb-1">Oddelki</div>
              <p className="text-xs text-gray-500 mb-3">Seznam v filtru nalog ("Vsi oddelki").</p>
              <TagList list={departments} setList={setDepartments} val={newDept} setVal={setNewDept} placeholder="Nov oddelek…" />
            </div>

            {/* Področja */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-gray-900 mb-1">Področja (predlogi v nalogi)</div>
              <p className="text-xs text-gray-500 mb-3">Predlogi za polje "Področje" pri novi nalogi.</p>
              <TagList list={areas} setList={setAreas} val={newArea} setVal={setNewArea} placeholder="Novo področje…" />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {settingsMsg && <span className={`text-sm ${settingsMsg.startsWith('Napaka') ? 'text-red-600' : 'text-green-600'}`}>{settingsMsg}</span>}
              <button onClick={loadSettings} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Razveljavi</button>
              <button onClick={saveSettings} disabled={savingSettings} className="px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 flex items-center gap-2">
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Shrani nastavitve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor uporabnika */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-start justify-center p-2 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setShowEditor(false); }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between rounded-t-lg">
              <h3 className="text-base font-bold text-gray-900">{form.id ? 'Uredi uporabnika' : 'Nov uporabnik'}</h3>
              <button onClick={() => setShowEditor(false)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ime in priimek *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Oddelek</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} list="ua-departments" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <datalist id="ua-departments">
                    {departments.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Uporabniško ime *</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Geslo *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" title={showPassword ? 'Skrij' : 'Pokaži'}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                  <span className="text-gray-700 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-red-600" /> Admin (vidi vse)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                  <span className="text-gray-700">Aktiven</span>
                </label>
              </div>

              {!form.is_admin && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 mb-2">
                    <input type="checkbox" checked={customAccess} onChange={(e) => onToggleCustom(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                    Pravice po meri (sicer privzeto po oddelku)
                  </label>
                  {customAccess && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[...MODULES, ...customModules].map(m => (
                        <label key={m.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                          <input type="checkbox" checked={modules.includes(m.key)} onChange={() => toggleModule(m.key)} className="w-4 h-4" style={{ accentColor: '#C8102E' }} />
                          <span className="text-gray-700">{labels[m.key] || m.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CRM vidnost — kdo čigave vnose vidi */}
              <div className="p-3 border border-gray-200 rounded-xl">
                <div className="font-semibold text-sm mb-2">CRM vidnost (obiski + pipeline)</div>
                <select
                  value={form.crm_scope?.mode || 'own'}
                  onChange={(e) => setForm({ ...form, crm_scope: e.target.value === 'own' ? null : { mode: e.target.value, users: form.crm_scope?.users || [] } })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2">
                  <option value="own">Vidi samo svoje vnose</option>
                  <option value="all">Vidi vse komercialiste</option>
                  <option value="selected">Vidi svoje + izbrane</option>
                </select>
                {form.crm_scope?.mode === 'selected' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                    {users.filter((u) => u.email !== form.email).map((u) => {
                      const sel = (form.crm_scope?.users || []).includes(u.email);
                      return (
                        <label key={u.email} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={sel} style={{ accentColor: '#C8102E' }}
                            onChange={() => {
                              const cur = form.crm_scope?.users || [];
                              const next = sel ? cur.filter((x) => x !== u.email) : [...cur, u.email];
                              setForm({ ...form, crm_scope: { mode: 'selected', users: next } });
                            }} />
                          {u.name} <span className="text-gray-400">({u.email})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            </div>

            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Prekliči</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Shrani
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
