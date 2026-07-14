// ProductionV2Tab.jsx — Glavni zavihek "Proizvodnja v2" (BETA)
// Dizajn usklajen z Montažo (AssemblyTab style)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BarChart3, Package, AlertTriangle, Trash, Loader2, Download, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, TrendingUp, TrendingDown, Clock, User, FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { calculateEfficiency, SEGMENTS_META, loadMachines, buildSegments, makeFindMachine } from './productionV2Config';
import ProductionAdmin from './ProductionAdmin';
import ProductionDetails from './ProductionDetails.jsx';
import WorkerHours from '../WorkerHours.jsx';

const AS_RED = '#C8102E';

const MachinesCtx = React.createContext({ segments: [], findMachine: () => null, reloadMachines: () => {} });
function useMachines() { return React.useContext(MachinesCtx); }
const PRODUCTION_USERS = [
  'boris.cernelc@as-system.si',
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
];
export function canAccessProduction(email) {
  return PRODUCTION_USERS.includes(email);
}

const MACHINE_ADMIN_EMAILS = ['boris.cernelc@as-system.si'];

const OPERATERJI = [
  'Janko Augustinčič',
  'Mitja Babić',
  'Dejan Čutić',
  'Danijel Korenini',
  'Gregor Koritnik',
  'Matija Postružin',
  'Danči Šolinc',
  'Boris Černelc',
];

function useStopReasons() {
  const [rs, setRs] = React.useState(STOP_REASONS);
  React.useEffect(() => {
    supabase.from('production_v2_stop_reasons').select('reason').eq('active', true).order('display_order')
      .then(({ data }) => {
        const names = (data || []).map((r) => r.reason).filter(Boolean);
        if (names.length) setRs(names);
      });
  }, []);
  return rs;
}

function useOperaterji() {
  const [ops, setOps] = React.useState(OPERATERJI);
  React.useEffect(() => {
    supabase.from('production_v2_workers').select('name').eq('active', true).order('display_order')
      .then(({ data }) => {
        const names = (data || []).map((w) => w.name).filter(Boolean);
        if (names.length) setOps(names);
      });
  }, []);
  return ops;
}

const STOP_REASONS = [
  'Drugo', 'Menjava', 'Menjava orodja', 'Menjava žice', 'Nastavitev proge',
  'Nastavitev senzorja', 'Nastavitev valjanja', 'Razširilo progo',
  'Zatikanje na progi', 'Zlomljene vzmeti', 'Čiščenje stroja', 'Servis stroja',
];

const WASTE_REASONS = [
  'Čiščenje stroja', 'Drugo', 'Odrez od špice', 'Slab navoj',
  'Slabi izdelki - dimenzija', 'Slabi izdelki - površina', 'Slabi komadi',
  'Slabo rebričenje', 'Zlomgalvač',
];

const WIRE_TYPES = ['Brez', 'Pocinkana', 'Nerjavna', 'Surova', 'Drugo'];

const SLOVENIAN_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

function timeStringToHours(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + m / 60;
}

function hoursToTimeString(hours) {
  if (!hours || hours <= 0) return '00:00';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('sl-SI');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI');
}

function shiftLabel(n) {
  return Number(n) === 2 ? 'Popoldanska' : Number(n) === 1 ? 'Dopoldanska' : '—';
}

export default function ProductionV2Tab({ currentUser, isAdmin }) {
  const [view, setView] = useState('monthly');

  // Data state
  const [entries, setEntries] = useState([]);
  const [stops, setStops] = useState([]);
  const [wastes, setWastes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [machineRows, setMachineRows] = useState([]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [e, s, w] = await Promise.all([
        supabase.from('production_v2_entries').select('*').order('date', { ascending: false }).limit(1000),
        supabase.from('production_v2_stops').select('*').order('date', { ascending: false }).limit(1000),
        supabase.from('production_v2_waste').select('*').order('date', { ascending: false }).limit(1000),
      ]);
      if (e.error) throw e.error;
      if (s.error) throw s.error;
      if (w.error) throw w.error;
      setEntries(e.data || []);
      setStops(s.data || []);
      setWastes(w.data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function reloadMachines() { const rows = await loadMachines(); setMachineRows(rows); }
  useEffect(() => { reloadMachines(); }, []);
  const segments = useMemo(() => buildSegments(machineRows, true), [machineRows]);
  const findMachine = useMemo(() => makeFindMachine(machineRows), [machineRows]);
  const canManageMachines = isAdmin || MACHINE_ADMIN_EMAILS.includes(currentUser?.email);

  return (
    <MachinesCtx.Provider value={{ segments, findMachine, reloadMachines }}>
    <div>
      {/* Glavna vrstica: tabe levo, kontrole desno preko portala */}
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
            <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
            <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
            <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
            {canManageMachines && (
              <SubTab active={view === 'machines'} onClick={() => setView('machines')} icon={<Package className="w-4 h-4" />} label="Stroji" />
            )}
            {canManageMachines && (
              <SubTab active={view === 'urejanje'} onClick={() => setView('urejanje')} icon={<FileText className="w-4 h-4" />} label="Urejanje" />
            )}
          </div>
        </div>
        <div id="productionv2-controls-slot" className="flex flex-wrap items-center gap-3 ml-auto"></div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {view === 'entry' && <EntryView currentUser={currentUser} onSaved={loadAll} setError={setError} />}
      {view === 'daily' && <DailyView entries={entries} stops={stops} wastes={wastes} isAdmin={isAdmin} currentUser={currentUser} onReload={loadAll} loading={loading} />}
      {view === 'monthly' && <MonthlyView entries={entries} stops={stops} wastes={wastes} loading={loading} />}
      {view === 'machines' && canManageMachines && (
        <MachinesAdmin rows={machineRows} onReload={reloadMachines} setError={setError} isAdmin={isAdmin} />
      )}
      {view === 'urejanje' && canManageMachines && (
        <ProductionAdmin />
      )}
    </div>
    </MachinesCtx.Provider>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: AS_RED } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── ENTRY VIEW (Vnos s 3 podtipi: Proizvodnja / Zastoj / Odpadek) ───
function EntryView({ currentUser, onSaved, setError }) {
  const [section, setSection] = useState('proizvodnja');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <SectionPill active={section === 'proizvodnja'} onClick={() => setSection('proizvodnja')}
          icon={<Package className="w-4 h-4" />} label="Proizvodnja" color="#0E7490" bgColor="#CFFAFE" />
        <SectionPill active={section === 'zastoj'} onClick={() => setSection('zastoj')}
          icon={<AlertTriangle className="w-4 h-4" />} label="Zastoj stroja" color="#7C2D12" bgColor="#FED7AA" />
        <SectionPill active={section === 'odpadek'} onClick={() => setSection('odpadek')}
          icon={<Trash className="w-4 h-4" />} label="Odpadek" color="#991B1B" bgColor="#FECACA" />
      </div>

      {section === 'proizvodnja' && <ProductionForm currentUser={currentUser} onSaved={onSaved} setError={setError} />}
      {section === 'zastoj' && <StopForm currentUser={currentUser} onSaved={onSaved} setError={setError} />}
      {section === 'odpadek' && <WasteForm currentUser={currentUser} onSaved={onSaved} setError={setError} />}
    </div>
  );
}

function SectionPill({ active, onClick, icon, label, color, bgColor }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition"
      style={{
        borderColor: active ? color : '#E5E7EB',
        background: active ? bgColor : '#fff',
        color: active ? color : '#6B7280',
      }}
    >
      {icon} {label}
    </button>
  );
}

// ─── PROIZVODNJA FORM ───
function ProductionForm({ currentUser, onSaved, setError }) {
  const operaterji = useOperaterji();
  const { segments: SEGMENTS, findMachine } = useMachines();
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formPieces, setFormPieces] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formDelavec, setFormDelavec] = useState('');
  const [formShift, setFormShift] = useState(1);
  const [formTipVijaka, setFormTipVijaka] = useState('');
  const [formOperater, setFormOperater] = useState('');
  const [formOpombe, setFormOpombe] = useState('');
  const [loading, setLoading] = useState(false);

  const machineInfo = useMemo(() => (selectedMachine ? findMachine(selectedMachine) : null), [selectedMachine]);
  const filteredMachines = useMemo(() => {
    if (!selectedSegment) return [];
    const seg = SEGMENTS.find((s) => s.id === selectedSegment);
    return seg ? seg.machines : [];
  }, [selectedSegment]);

  function reset() {
    setSelectedSegment('');
    setSelectedMachine('');
    setFormPieces('');
    setFormTime('');
    setFormDelavec('');
    setFormTipVijaka('');
    setFormOpombe('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formPieces || !formTime || !formOperater) {
      setError('Izpolni stroj, število kosov, čas in delavca.');
      return;
    }
    if (machineInfo?.vOkvari) { setError('Ta stroj je V OKVARI.'); return; }
    const hours = timeStringToHours(formTime);
    if (hours <= 0) { setError('Čas mora biti večji od 0.'); return; }
    const pieces = parseInt(formPieces, 10);
    if (isNaN(pieces) || pieces < 0) { setError('Število kosov mora biti pozitivno.'); return; }
    const efficiency = calculateEfficiency(pieces, hours, machineInfo.normativ_h);

    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('production_v2_entries').insert([{
        date: formDate, segment: selectedSegment, machine_id: selectedMachine,
        machine_name: machineInfo.stroj, operacija: machineInfo.operacija,
        normativ_kos_h: machineInfo.normativ_h, kosi: pieces, cas_ur: hours,
        delavec_ur: formDelavec ? timeStringToHours(formDelavec) : null,
        shift: Number(formShift) || 1,
        tip_vijaka: formTipVijaka || null, operater: formOperater,
        opombe: formOpombe || null, ucinkovitost_pct: efficiency,
        created_by: currentUser?.email || null,
      }]);
      if (error) throw error;
      reset();
      onSaved();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#CFFAFE', color: '#0E7490' }}>📦</span>
        Nov vnos proizvodnje
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Delavec / Operater *">
          <select value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required className={inputCls}>
            <option value="">— izberi delavca —</option>
            {operaterji.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormField>
      </div>

      <FormField label="Smena *">
        <select value={formShift} onChange={(e) => setFormShift(Number(e.target.value))} required className={inputCls}>
          <option value={1}>Dopoldanska</option>
          <option value={2}>Popoldanska</option>
        </select>
      </FormField>

      <FormField label="Segment *">
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map((seg) => (
            <button key={seg.id} type="button" onClick={() => { setSelectedSegment(seg.id); setSelectedMachine(''); }}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition"
              style={{
                borderColor: seg.color,
                background: selectedSegment === seg.id ? seg.color : '#fff',
                color: selectedSegment === seg.id ? '#fff' : seg.color,
              }}>
              {seg.label}
            </button>
          ))}
        </div>
      </FormField>

      {selectedSegment && (
        <FormField label="Stroj *">
          <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required className={inputCls}>
            <option value="">-- izberi stroj --</option>
            {filteredMachines.map((m) => (
              <option key={m.id} value={m.id} disabled={m.vOkvari}>
                {m.id} - {m.stroj} ({m.operacija}){m.vOkvari ? ' - V OKVARI' : ''}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {machineInfo && !machineInfo.vOkvari && (
        <div className="bg-as-gray-50 border border-as-gray-200 rounded-lg p-3 text-sm space-y-1">
          <div><span className="text-as-gray-500">Normativ:</span> <strong>{formatNumber(machineInfo.normativ_h)} kos/h</strong> ({machineInfo.normativ_min} kos/min)</div>
          <div><span className="text-as-gray-500">Operacija:</span> <strong>{machineInfo.operacija}</strong></div>
          {machineInfo.tipi && <div><span className="text-as-gray-500">Tipi:</span> {machineInfo.tipi}</div>}
        </div>
      )}

      {machineInfo && !machineInfo.vOkvari && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Število kosov *">
              <input type="number" min="0" value={formPieces} onChange={(e) => setFormPieces(e.target.value)} required className={inputCls} placeholder="npr. 50000" />
            </FormField>
            <FormField label="Mašina delala (HH:MM) *">
              <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required className={inputCls} placeholder="npr. 7:30" pattern="[0-9]+:[0-5][0-9]" />
            </FormField>
          </div>

          <FormField label="Delavec delal (HH:MM)">
            <input type="text" value={formDelavec} onChange={(e) => setFormDelavec(e.target.value)} className={inputCls} placeholder="npr. 7:30" pattern="[0-9]+:[0-5][0-9]" />
          </FormField>

          <FormField label="Tip vijaka / izdelka">
            <input type="text" value={formTipVijaka} onChange={(e) => setFormTipVijaka(e.target.value)} className={inputCls} placeholder={machineInfo.tipi || ''} />
          </FormField>

          <FormField label="Opombe">
            <textarea value={formOpombe} onChange={(e) => setFormOpombe(e.target.value)} rows={2} className={inputCls} />
          </FormField>

          {formPieces && formTime && (() => {
            const eff = calculateEfficiency(parseInt(formPieces) || 0, timeStringToHours(formTime), machineInfo.normativ_h);
            if (eff === null) return null;
            const color = eff >= 95 ? '#16A34A' : eff >= 75 ? '#D97706' : '#DC2626';
            const expected = machineInfo.normativ_h * timeStringToHours(formTime);
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <span className="text-as-gray-600">Pričakovano po normativu: </span>
                <strong>{formatNumber(expected)} kos</strong> v {formTime}
                <span className="ml-3 font-bold" style={{ color }}>· Učinkovitost: {eff}%</span>
              </div>
            );
          })()}
        </>
      )}

      <button type="submit" disabled={loading || !machineInfo || machineInfo?.vOkvari}
        className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50"
        style={{ background: '#0E7490' }}>
        <Save className="w-4 h-4" /> Shrani proizvodnjo
      </button>
    </form>
  );
}

// ─── ZASTOJ FORM ───
function StopForm({ currentUser, onSaved, setError }) {
  const operaterji = useOperaterji();
  const stopReasons = useStopReasons();
  const { segments: SEGMENTS, findMachine } = useMachines();
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('');
  const [formShift, setFormShift] = useState(1);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRepair, setFormRepair] = useState('');
  const [formFrequency, setFormFrequency] = useState('1');
  const [formFixedBy, setFormFixedBy] = useState('');
  const [formOperater, setFormOperater] = useState('');
  const [loading, setLoading] = useState(false);

  const machineInfo = useMemo(() => (selectedMachine ? findMachine(selectedMachine) : null), [selectedMachine]);

  function reset() {
    setFormTime(''); setSelectedMachine(''); setFormReason(''); setFormDescription('');
    setFormRepair(''); setFormFrequency('1'); setFormFixedBy('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formTime || !formOperater) { setError('Izpolni stroj, trajanje in delavca.'); return; }
    const hours = timeStringToHours(formTime);
    if (hours <= 0) { setError('Trajanje mora biti večje od 0.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('production_v2_stops').insert([{
        date: formDate, duration_hours: hours, shift: Number(formShift) || 1,
        segment: machineInfo?.segment || null, machine_id: selectedMachine,
        machine_name: machineInfo?.stroj || null,
        reason_category: formReason || null, description: formDescription || null,
        repair_done: formRepair || null, frequency: parseInt(formFrequency) || 1,
        fixed_by: formFixedBy || null, operater: formOperater,
        created_by: currentUser?.email || null,
      }]);
      if (error) throw error;
      reset();
      onSaved();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FED7AA', color: '#7C2D12' }}>⚠️</span>
        Nov zastoj stroja
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Trajanje (HH:MM) *">
          <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required className={inputCls} placeholder="npr. 1:30" pattern="[0-9]+:[0-5][0-9]" />
        </FormField>
      </div>

      <FormField label="Smena *">
        <select value={formShift} onChange={(e) => setFormShift(Number(e.target.value))} required className={inputCls}>
          <option value={1}>Dopoldanska</option>
          <option value={2}>Popoldanska</option>
        </select>
      </FormField>

      <FormField label="Stroj *">
        <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required className={inputCls}>
          <option value="">-- izberi stroj --</option>
          {SEGMENTS.map((seg) => (
            <optgroup key={seg.id} label={seg.label}>
              {seg.machines.map((m) => <option key={m.id} value={m.id}>{m.id} - {m.stroj}</option>)}
            </optgroup>
          ))}
        </select>
      </FormField>

      <FormField label="Razlog (kategorija)">
        <select value={formReason} onChange={(e) => setFormReason(e.target.value)} className={inputCls}>
          <option value="">-- izberi razlog --</option>
          {stopReasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </FormField>

      <FormField label="Opis okvare">
        <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} className={inputCls} placeholder="npr. Zlomljene vzmeti na 5. postaji" />
      </FormField>

      <FormField label="Opravljeno delo / popravilo">
        <textarea value={formRepair} onChange={(e) => setFormRepair(e.target.value)} rows={2} className={inputCls} placeholder="npr. Menjava špancang, vzmeti, matrice, igle" />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Pogostost">
          <input type="number" min="1" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} className={inputCls} />
        </FormField>
        <FormField label="Napako odpravil">
          <input type="text" value={formFixedBy} onChange={(e) => setFormFixedBy(e.target.value)} className={inputCls} placeholder="npr. Augustinčič" />
        </FormField>
      </div>

      <FormField label="Delavec / Operater *">
        <select value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required className={inputCls}>
            <option value="">— izberi delavca —</option>
            {operaterji.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
      </FormField>

      <button type="submit" disabled={loading}
        className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50"
        style={{ background: '#7C2D12' }}>
        <Save className="w-4 h-4" /> Shrani zastoj
      </button>
    </form>
  );
}

// ─── ODPADEK FORM ───
function WasteForm({ currentUser, onSaved, setError }) {
  const operaterji = useOperaterji();
  const { segments: SEGMENTS, findMachine } = useMachines();
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formWeight, setFormWeight] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formWire, setFormWire] = useState('Brez');
  const [formReason, setFormReason] = useState('');
  const [formLot, setFormLot] = useState('');
  const [formNalog, setFormNalog] = useState('');
  const [formOperater, setFormOperater] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const machineInfo = useMemo(() => (selectedMachine ? findMachine(selectedMachine) : null), [selectedMachine]);

  function reset() {
    setFormWeight(''); setSelectedMachine(''); setFormProduct(''); setFormWire('Brez');
    setFormReason(''); setFormLot(''); setFormNalog(''); setFormNotes('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formWeight || !formOperater) { setError('Izpolni stroj, težo in delavca.'); return; }
    const weight = parseFloat(formWeight);
    if (isNaN(weight) || weight <= 0) { setError('Teža mora biti pozitivno število.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('production_v2_waste').insert([{
        date: formDate, weight_kg: weight,
        segment: machineInfo?.segment || null, machine_id: selectedMachine,
        machine_name: machineInfo?.stroj || null, product: formProduct || null,
        wire_type: formWire === 'Brez' ? null : formWire,
        reason_category: formReason || null, lot_zice: formLot || null,
        nalog: formNalog || null, operater: formOperater, notes: formNotes || null,
        created_by: currentUser?.email || null,
      }]);
      if (error) throw error;
      reset();
      onSaved();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FECACA', color: '#991B1B' }}>🗑️</span>
        Nov odpadek
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Teža (kg) *">
          <input type="number" step="0.01" min="0" value={formWeight} onChange={(e) => setFormWeight(e.target.value)} required className={inputCls} placeholder="npr. 135" />
        </FormField>
      </div>

      <FormField label="Stroj *">
        <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required className={inputCls}>
          <option value="">-- izberi stroj --</option>
          {SEGMENTS.map((seg) => (
            <optgroup key={seg.id} label={seg.label}>
              {seg.machines.map((m) => <option key={m.id} value={m.id}>{m.id} - {m.stroj}</option>)}
            </optgroup>
          ))}
        </select>
      </FormField>

      <FormField label="Izdelek">
        <input type="text" value={formProduct} onChange={(e) => setFormProduct(e.target.value)} className={inputCls} placeholder="npr. M4x8, Sidro M16 (kasneje dropdown)" />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Žica">
          <select value={formWire} onChange={(e) => setFormWire(e.target.value)} className={inputCls}>
            {WIRE_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </FormField>
        <FormField label="Razlog napake">
          <select value={formReason} onChange={(e) => setFormReason(e.target.value)} className={inputCls}>
            <option value="">-- izberi --</option>
            {WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="LOT žice">
          <input type="text" value={formLot} onChange={(e) => setFormLot(e.target.value)} className={inputCls} placeholder="npr. 503285" />
        </FormField>
        <FormField label="Nalog">
          <input type="text" value={formNalog} onChange={(e) => setFormNalog(e.target.value)} className={inputCls} placeholder="npr. 20012" />
        </FormField>
      </div>

      <FormField label="Delavec / Operater *">
        <select value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required className={inputCls}>
            <option value="">— izberi delavca —</option>
            {operaterji.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
      </FormField>

      <FormField label="Opombe">
        <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className={inputCls} />
      </FormField>

      <button type="submit" disabled={loading}
        className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50"
        style={{ background: '#991B1B' }}>
        <Save className="w-4 h-4" /> Shrani odpadek
      </button>
    </form>
  );
}

// ─── DAILY VIEW ───
function DailyView({ entries, stops, wastes, isAdmin, currentUser, onReload, loading }) {
  const { segments: SEGMENTS, findMachine } = useMachines();
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('productionv2-controls-slot'));
  }, []);

  const dayEntries = entries.filter((e) => e.date === filterDate);
  const dayStops = stops.filter((e) => e.date === filterDate);
  const dayWastes = wastes.filter((e) => e.date === filterDate);

  const totalPieces = dayEntries.reduce((s, e) => s + Number(e.kosi || 0), 0);
  const totalHours = dayEntries.reduce((s, e) => s + Number(e.cas_ur || 0), 0);
  const totalStopHours = dayStops.reduce((s, e) => s + Number(e.duration_hours || 0), 0);
  const totalWasteKg = dayWastes.reduce((s, e) => s + Number(e.weight_kg || 0), 0);
  const totalExpected = dayEntries.reduce((s, e) => s + Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0), 0);
  const totalPiecesNorm = dayEntries.reduce((s, e) => s + (Number(e.normativ_kos_h || 0) > 0 ? Number(e.kosi || 0) : 0), 0);
  const overallEfficiency = totalExpected > 0 ? Math.round((totalPiecesNorm / totalExpected) * 100) : null;

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm" />
        <span className="text-sm text-as-gray-500 hidden sm:inline">{formatDate(filterDate)}</span>
      </div>
      <button
        onClick={() => exportDailyCSV(filterDate, dayEntries, dayStops, dayWastes)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> Izvoz v Excel
      </button>
    </>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon="📦" label="Skupaj kosov" value={formatNumber(totalPieces)} unit="kos" color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="⏱️" label="Skupne ure" value={hoursToTimeString(totalHours)} unit="h" color="#7C2D12" bgColor="#FED7AA" />
            <BigStat icon="⚠️" label="Zastoji" value={hoursToTimeString(totalStopHours)} unit="h" color="#854D0E" bgColor="#FEF08A" />
            <BigStat icon="🗑️" label="Odpadek" value={formatNumber(totalWasteKg)} unit="kg" color="#991B1B" bgColor="#FECACA" />
          </div>

          {overallEfficiency !== null && (
            <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-as-gray-700">🎯 Skupno doseganje normativa</span>
                <span className="text-2xl font-bold" style={{
                  color: overallEfficiency >= 95 ? '#16A34A' : overallEfficiency >= 75 ? '#D97706' : '#DC2626',
                }}>{overallEfficiency}%</span>
              </div>
              <div className="text-xs text-as-gray-500">
                Doseženo: <strong>{formatNumber(totalPieces)} kos</strong> · Pričakovano po normativu: <strong>{formatNumber(Math.round(totalExpected))} kos</strong>
              </div>
            </div>
          )}

          <ShiftAnalysis entries={dayEntries} stops={dayStops} />

          {/* Po skupinah (segmentih) - mini kartoni */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🏷️ Proizvodnja po skupinah</h3>
            {dayEntries.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(() => {
                  const bySeg = {};
                  dayEntries.forEach((e) => {
                    const m = findMachine(e.machine_id);
                    const segId = m?.segment || 'DRUGO';
                    if (!bySeg[segId]) bySeg[segId] = { id: segId, label: m?.segmentLabel || 'Drugo', color: m?.segmentColor || '#6B7280', kosi: 0, normativ: 0 };
                    bySeg[segId].kosi += Number(e.kosi || 0);
                    bySeg[segId].normativ += Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0);
                  });
                  const order = SEGMENTS.map((s) => s.id);
                  const segs = Object.values(bySeg).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
                  return segs.map((s) => {
                    const pct = s.normativ > 0 ? Math.round((s.kosi / s.normativ) * 100) : null;
                    const pctColor = pct === null ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
                    return (
                      <div key={s.id} className="rounded-lg p-3 border" style={{ borderColor: s.color + '40', backgroundColor: s.color + '0D' }}>
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</div>
                        <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(s.kosi)}</div>
                        {pct !== null && <div className="text-xs font-bold mt-1" style={{ color: pctColor }}>📈 {pct}% normativa</div>}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Po strojih - mini kartoni */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🏭 Proizvodnja po strojih</h3>
            {dayEntries.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov za stroje.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(() => {
                  const byMachine = {};
                  dayEntries.forEach((e) => {
                    if (!byMachine[e.machine_id]) byMachine[e.machine_id] = { id: e.machine_id, name: e.machine_name, kosi: 0, normativ: 0 };
                    byMachine[e.machine_id].kosi += Number(e.kosi || 0);
                    byMachine[e.machine_id].normativ += Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0);
                  });
                  return Object.values(byMachine).map((m) => {
                    const pct = m.normativ > 0 ? Math.round((m.kosi / m.normativ) * 100) : null;
                    const color = pct === null ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
                    return (
                      <div key={m.id} className="border border-as-gray-100 rounded-lg p-3">
                        <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{m.id} · {m.name}</div>
                        <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(m.kosi)}</div>
                        {pct !== null && <div className="text-xs font-bold mt-1" style={{ color }}>📈 {pct}% normativa</div>}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          <ProductionDetails entries={dayEntries} stops={dayStops} mode="day" />

          <WorkerHours source="production" mode="day" date={filterDate} />

          {/* Zastoji - mini kartoni po razlogih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">⚠️ Zastoji po razlogih</h3>
            {dayStops.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni zastojev.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(() => {
                  const byReason = {};
                  dayStops.forEach((s) => {
                    const r = s.reason_category || 'Drugo';
                    byReason[r] = (byReason[r] || 0) + Number(s.duration_hours || 0);
                  });
                  return Object.entries(byReason).map(([reason, hours]) => (
                    <div key={reason} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{reason}</div>
                      <div className="text-2xl font-bold text-as-gray-700 mt-1">{hours.toFixed(1)} h</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Odpadek - mini kartoni po razlogih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🗑️ Odpadek po razlogih</h3>
            {dayWastes.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni odpadka.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(() => {
                  const byReason = {};
                  dayWastes.forEach((w) => {
                    const r = w.reason_category || 'Drugo';
                    byReason[r] = (byReason[r] || 0) + Number(w.weight_kg || 0);
                  });
                  return Object.entries(byReason).map(([reason, kg]) => (
                    <div key={reason} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{reason}</div>
                      <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(kg)} kg</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Podrobni dnevni vnosi */}
          <SectionCard title="📋 Vsi vnosi - proizvodnja" count={dayEntries.length} defaultOpen>
            {dayEntries.length === 0 ? <Empty /> : <EntryTable entries={dayEntries} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
          </SectionCard>

          <SectionCard title="📋 Vsi vnosi - zastoji" count={dayStops.length}>
            {dayStops.length === 0 ? <Empty /> : <StopsTable rows={dayStops} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
          </SectionCard>

          <SectionCard title="📋 Vsi vnosi - odpadek" count={dayWastes.length}>
            {dayWastes.length === 0 ? <Empty /> : <WasteTable rows={dayWastes} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── MONTHLY VIEW ───
function MonthlyView({ entries, stops, wastes, loading }) {
  const { segments: SEGMENTS, findMachine } = useMachines();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expandedMachine, setExpandedMachine] = useState(null);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('productionv2-controls-slot'));
  }, []);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.date?.startsWith(monthStr));
  const monthStops = stops.filter((e) => e.date?.startsWith(monthStr));
  const monthWastes = wastes.filter((e) => e.date?.startsWith(monthStr));

  // Skupne vsote
  const totalPieces = monthEntries.reduce((s, e) => s + Number(e.kosi || 0), 0);
  const totalHours = monthEntries.reduce((s, e) => s + Number(e.cas_ur || 0), 0);
  const totalStopHours = monthStops.reduce((s, e) => s + Number(e.duration_hours || 0), 0);
  const totalWasteKg = monthWastes.reduce((s, e) => s + Number(e.weight_kg || 0), 0);

  // Pričakovan output po normativu (skupaj)
  const totalExpected = monthEntries.reduce((s, e) => s + Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0), 0);
  const totalPiecesNorm = monthEntries.reduce((s, e) => s + (Number(e.normativ_kos_h || 0) > 0 ? Number(e.kosi || 0) : 0), 0);
  const overallEfficiency = totalExpected > 0 ? Math.round((totalPiecesNorm / totalExpected) * 100) : null;

  // Po strojih
  const byMachine = useMemo(() => {
    const map = {};
    for (const e of monthEntries) {
      const k = e.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: e.machine_name, operacija: e.operacija, normativ_kos_h: e.normativ_kos_h, kosi: 0, ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0, segment: e.segment };
      map[k].kosi += Number(e.kosi || 0);
      map[k].ur += Number(e.cas_ur || 0);
      map[k].vnosov += 1;
    }
    for (const s of monthStops) {
      const k = s.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: s.machine_name, operacija: '-', normativ_kos_h: 0, kosi: 0, ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0, segment: s.segment };
      map[k].zastoj_ur += Number(s.duration_hours || 0);
    }
    for (const w of monthWastes) {
      const k = w.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: w.machine_name, operacija: '-', normativ_kos_h: 0, kosi: 0, ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0, segment: w.segment };
      map[k].odpadek_kg += Number(w.weight_kg || 0);
    }
    return Object.values(map).map((r) => ({ ...r, ucinkovitost: calculateEfficiency(r.kosi, r.ur, r.normativ_kos_h) })).sort((a, b) => a.machine_id.localeCompare(b.machine_id));
  }, [monthEntries, monthStops, monthWastes]);

  // Po segmentih (za bar chart)
  const bySegment = useMemo(() => {
    const map = {};
    SEGMENTS.forEach((s) => { map[s.id] = { id: s.id, label: s.label, color: s.color, kosi: 0, normativ: 0 }; });
    for (const e of monthEntries) {
      if (map[e.segment]) {
        map[e.segment].kosi += Number(e.kosi || 0);
        map[e.segment].normativ += Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0);
      }
    }
    return Object.values(map);
  }, [monthEntries]);

  // Po delavcih (operater)
  const byWorker = useMemo(() => {
    const key = (x) => (x.operater && String(x.operater).trim()) ? String(x.operater).trim() : '—';
    const map = {};
    const ensure = (k) => { if (!map[k]) map[k] = { operater: k, kosi: 0, ur: 0, expected: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0 }; return map[k]; };
    for (const e of monthEntries) {
      const r = ensure(key(e));
      r.kosi += Number(e.kosi || 0);
      r.ur += Number(e.cas_ur || 0);
      r.expected += Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0);
      r.vnosov += 1;
    }
    for (const s of monthStops) ensure(key(s)).zastoj_ur += Number(s.duration_hours || 0);
    for (const w of monthWastes) ensure(key(w)).odpadek_kg += Number(w.weight_kg || 0);
    return Object.values(map)
      .map((r) => ({ ...r, ucinkovitost: r.expected > 0 ? Math.round((r.kosi / r.expected) * 100) : null }))
      .sort((a, b) => b.kosi - a.kosi);
  }, [monthEntries, monthStops, monthWastes]);

  // Po razlogih zastojev
  const byStopReason = useMemo(() => {
    const map = {};
    STOP_REASONS.forEach((r) => { map[r] = 0; });
    for (const s of monthStops) {
      const r = s.reason_category || 'Drugo';
      map[r] = (map[r] || 0) + Number(s.duration_hours || 0);
    }
    return Object.entries(map).map(([reason, hours]) => ({ reason, hours }));
  }, [monthStops]);

  // Po razlogih odpadka
  const byWasteReason = useMemo(() => {
    const map = {};
    WASTE_REASONS.forEach((r) => { map[r] = 0; });
    for (const w of monthWastes) {
      const r = w.reason_category || 'Drugo';
      map[r] = (map[r] || 0) + Number(w.weight_kg || 0);
    }
    return Object.entries(map).map(([reason, kg]) => ({ reason, kg }));
  }, [monthWastes]);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm">
          {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button
        onClick={() => exportMonthlyCSV(year, month, byMachine, byStopReason, byWasteReason, monthEntries, monthStops)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> Izvoz v Excel
      </button>
    </>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStat icon="📦" label="Skupaj kosov" value={formatNumber(totalPieces)} unit="kos" color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="⏱️" label="Skupne ure" value={hoursToTimeString(totalHours)} unit="h" color="#7C2D12" bgColor="#FED7AA" />
            <BigStat icon="⚠️" label="Zastoji" value={hoursToTimeString(totalStopHours)} unit="h" color="#854D0E" bgColor="#FEF08A" />
            <BigStat icon="🗑️" label="Odpadek" value={formatNumber(totalWasteKg)} unit="kg" color="#991B1B" bgColor="#FECACA" />
          </div>

          {overallEfficiency !== null && (
            <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-as-gray-700">🎯 Skupno doseganje normativa</span>
                <span className="text-2xl font-bold" style={{
                  color: overallEfficiency >= 95 ? '#16A34A' : overallEfficiency >= 75 ? '#D97706' : '#DC2626',
                }}>{overallEfficiency}%</span>
              </div>
              <div className="text-xs text-as-gray-500">
                Doseženo: <strong>{formatNumber(totalPieces)} kos</strong> · Pričakovano po normativu: <strong>{formatNumber(Math.round(totalExpected))} kos</strong>
              </div>
            </div>
          )}

          <ShiftAnalysis entries={monthEntries} stops={monthStops} />

          {/* Po skupinah */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🏷️ Proizvodnja po skupinah</h3>
            {bySegment.every((s) => s.kosi === 0) ? <Empty /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {bySegment.filter((s) => s.kosi > 0).map((s) => {
                  const pct = s.normativ > 0 ? Math.round((s.kosi / s.normativ) * 100) : null;
                  const pctColor = pct === null ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
                  return (
                    <div key={s.id} className="rounded-lg p-3 border" style={{ borderColor: s.color + '40', backgroundColor: s.color + '0D' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</div>
                      <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(s.kosi)}</div>
                      {pct !== null && <div className="text-xs font-bold mt-1" style={{ color: pctColor }}>📈 {pct}% normativa</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Po strojih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🏭 Po strojih — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {byMachine.length === 0 ? <Empty /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {byMachine.map((m) => {
                  const pct = m.ucinkovitost;
                  const color = pct === null ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
                  return (
                    <div key={m.machine_id} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{m.machine_id} · {m.machine_name}</div>
                      <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(m.kosi)}</div>
                      {pct !== null && <div className="text-xs font-bold mt-1" style={{ color }}>📈 {pct}% normativa</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <ProductionDetails entries={monthEntries} stops={monthStops} mode="month" periodLabel={`${SLOVENIAN_MONTHS[month - 1]} ${year}`} />

          <WorkerHours source="production" mode="month" year={year} month={month} />

          {/* Zastoji po razlogih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">⚠️ Zastoji po razlogih</h3>
            {byStopReason.every((r) => r.hours === 0) ? <Empty /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {byStopReason.filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours).map((r) => (
                  <div key={r.reason} className="border border-as-gray-100 rounded-lg p-3">
                    <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{r.reason}</div>
                    <div className="text-2xl font-bold text-as-gray-700 mt-1">{r.hours.toFixed(1)} h</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Odpadek po razlogih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-3">🗑️ Odpadek po razlogih</h3>
            {byWasteReason.every((r) => r.kg === 0) ? <Empty /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {byWasteReason.filter((r) => r.kg > 0).sort((a, b) => b.kg - a.kg).map((r) => (
                  <div key={r.reason} className="border border-as-gray-100 rounded-lg p-3">
                    <div className="text-xs text-as-gray-500 font-semibold uppercase tracking-wider">{r.reason}</div>
                    <div className="text-2xl font-bold text-as-gray-700 mt-1">{formatNumber(r.kg)} kg</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── TABLES ───
function EntryTable({ entries, isAdmin, currentUser, onReload }) {
  async function handleDelete(id) {
    if (!confirm('Izbrišem ta vnos proizvodnje?')) return;
    await supabase.from('production_v2_entries').delete().eq('id', id);
    onReload();
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left p-2">Stroj</th>
            <th className="text-left p-2">Operacija</th>
            <th className="text-center p-2">Smena</th>
            <th className="text-right p-2">Kosi</th>
            <th className="text-right p-2">Mašina</th>
            <th className="text-right p-2">Delavec ur</th>
            <th className="text-right p-2">Doseganje</th>
            <th className="text-left p-2">Delavec</th>
            <th className="text-left p-2">Tip</th>
            <th className="text-left p-2">Opombe</th>
            <th className="text-right p-2"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            const pct = e.ucinkovitost_pct;
            const color = pct === null || pct === undefined ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
            return (
              <tr key={e.id} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                <td className="p-2"><strong>{e.machine_id}</strong><div className="text-xs text-as-gray-500">{e.machine_name}</div></td>
                <td className="p-2 text-xs text-as-gray-500">{e.operacija}</td>
                <td className="p-2 text-center">{shiftLabel(e.shift)}</td>
                <td className="p-2 text-right font-semibold">{formatNumber(e.kosi)}</td>
                <td className="p-2 text-right">{hoursToTimeString(e.cas_ur)}</td>
                <td className="p-2 text-right text-as-gray-500">{e.delavec_ur ? hoursToTimeString(e.delavec_ur) : '—'}</td>
                <td className="p-2 text-right font-bold" style={{ color }}>{pct === null || pct === undefined ? '—' : `${pct}%`}</td>
                <td className="p-2">{e.operater || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.tip_vijaka || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.opombe || '—'}</td>
                <td className="p-2 text-right">
                  {canEdit && (
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StopsTable({ rows, isAdmin, currentUser, onReload }) {
  async function handleDelete(id) {
    if (!confirm('Izbrišem ta zastoj?')) return;
    await supabase.from('production_v2_stops').delete().eq('id', id);
    onReload();
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left p-2">Stroj</th>
            <th className="text-center p-2">Smena</th>
            <th className="text-right p-2">Trajanje</th>
            <th className="text-left p-2">Razlog</th>
            <th className="text-left p-2">Opis</th>
            <th className="text-left p-2">Popravilo</th>
            <th className="text-right p-2">Pogostost</th>
            <th className="text-left p-2">Odpravil</th>
            <th className="text-left p-2">Delavec</th>
            <th className="text-right p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            return (
              <tr key={e.id} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                <td className="p-2"><strong>{e.machine_id}</strong><div className="text-xs text-as-gray-500">{e.machine_name}</div></td>
                <td className="p-2 text-center">{shiftLabel(e.shift)}</td>
                <td className="p-2 text-right">{hoursToTimeString(e.duration_hours)}</td>
                <td className="p-2">{e.reason_category || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.description || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.repair_done || '—'}</td>
                <td className="p-2 text-right">{e.frequency || 1}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.fixed_by || '—'}</td>
                <td className="p-2">{e.operater || '—'}</td>
                <td className="p-2 text-right">
                  {canEdit && (
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WasteTable({ rows, isAdmin, currentUser, onReload }) {
  async function handleDelete(id) {
    if (!confirm('Izbrišem ta odpadek?')) return;
    await supabase.from('production_v2_waste').delete().eq('id', id);
    onReload();
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
          <tr>
            <th className="text-left p-2">Stroj</th>
            <th className="text-right p-2">Teža (kg)</th>
            <th className="text-left p-2">Izdelek</th>
            <th className="text-left p-2">Žica</th>
            <th className="text-left p-2">Razlog</th>
            <th className="text-left p-2">LOT</th>
            <th className="text-left p-2">Nalog</th>
            <th className="text-left p-2">Delavec</th>
            <th className="text-right p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            return (
              <tr key={e.id} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                <td className="p-2"><strong>{e.machine_id}</strong><div className="text-xs text-as-gray-500">{e.machine_name}</div></td>
                <td className="p-2 text-right font-semibold">{formatNumber(e.weight_kg)}</td>
                <td className="p-2">{e.product || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.wire_type || '—'}</td>
                <td className="p-2">{e.reason_category || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.lot_zice || '—'}</td>
                <td className="p-2 text-xs text-as-gray-500">{e.nalog || '—'}</td>
                <td className="p-2">{e.operater || '—'}</td>
                <td className="p-2 text-right">
                  {canEdit && (
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── BUILDING BLOCKS ───
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div>
        <span className="text-3xl font-bold text-as-gray-700">{value}</span>
        <span className="text-sm text-as-gray-400 ml-2">{unit}</span>
      </div>
    </div>
  );
}

function ShiftAnalysis({ entries, stops }) {
  const shifts = [
    { key: 1, label: 'Dopoldanska', emoji: '🌅', color: '#B45309' },
    { key: 2, label: 'Popoldanska', emoji: '🌙', color: '#3730A3' },
  ];
  const data = { 1: { kosi: 0, masina: 0, delavec: 0, zastoj: 0, vnosov: 0, expected: 0 },
                 2: { kosi: 0, masina: 0, delavec: 0, zastoj: 0, vnosov: 0, expected: 0 } };
  (entries || []).forEach((e) => {
    const k = Number(e.shift) === 2 ? 2 : 1;
    data[k].kosi += Number(e.kosi || 0);
    data[k].masina += Number(e.cas_ur || 0);
    data[k].delavec += Number(e.delavec_ur || 0);
    data[k].expected += Number(e.normativ_kos_h || 0) * Number(e.cas_ur || 0);
    data[k].vnosov += 1;
  });
  (stops || []).forEach((s) => {
    const k = Number(s.shift) === 2 ? 2 : 1;
    data[k].zastoj += Number(s.duration_hours || 0);
  });
  const hasData = shifts.some((s) => data[s.key].vnosov > 0 || data[s.key].zastoj > 0);
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <h3 className="font-bold text-as-gray-700 mb-4">🌓 Analiza po smenah</h3>
      {!hasData ? <Empty /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shifts.map((s) => {
            const d = data[s.key];
            const eff = d.expected > 0 ? Math.round((d.kosi / d.expected) * 100) : null;
            const util = (d.masina + d.zastoj) > 0 ? Math.round((d.masina / (d.masina + d.zastoj)) * 100) : null;
            const effColor = eff === null ? '#9CA3AF' : eff >= 95 ? '#16A34A' : eff >= 75 ? '#D97706' : '#DC2626';
            return (
              <div key={s.key} className="border border-as-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3 font-bold" style={{ color: s.color }}>
                  <span className="text-lg">{s.emoji}</span> {s.label}
                  <span className="ml-auto text-xs font-normal text-as-gray-400">{d.vnosov} vnosov</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <ShiftRow label="📦 Proizvedeno" value={`${formatNumber(d.kosi)} kos`} />
                  <ShiftRow label="⚙️ Mašina delala" value={hoursToTimeString(d.masina)} />
                  <ShiftRow label="👷 Delavec delal" value={hoursToTimeString(d.delavec)} />
                  <ShiftRow label="⚠️ Zastoj" value={hoursToTimeString(d.zastoj)} />
                  {eff !== null && (
                    <div className="flex justify-between pt-1">
                      <span className="text-as-gray-500">🎯 Doseganje normativa</span>
                      <span className="font-bold" style={{ color: effColor }}>{eff}%</span>
                    </div>
                  )}
                  {util !== null && (
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-as-gray-500 mb-1">
                        <span>Izkoriščenost stroja</span><strong style={{ color: s.color }}>{util}%</strong>
                      </div>
                      <div className="w-full h-2 bg-as-gray-100 rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${util}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShiftRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-as-gray-500">{label}</span>
      <span className="font-semibold text-as-gray-700">{value}</span>
    </div>
  );
}

function SectionCard({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between p-4 hover:bg-as-gray-50 transition">
        <div className="flex items-center gap-2 font-bold text-as-gray-700">
          {open ? <ChevronDown className="w-4 h-4 text-as-gray-400" /> : <ChevronRight className="w-4 h-4 text-as-gray-400" />}
          <span>{title}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-500">{count}</span>
        </div>
      </button>
      {open && <div className="p-4 border-t border-as-gray-100">{children}</div>}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-center py-6 text-as-gray-400 text-sm">Ni vnosov.</div>;
}

function LoadingBox() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
      <span className="ml-2 text-as-gray-500">Nalagam...</span>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:border-as-red-600";

// ─── EXCEL EXPORT ───
function exportDailyCSV(date, entries, stops, wastes) {
  const lines = [];
  lines.push(`Dnevno poročilo PROIZVODNJA v2 - ${date}`);
  lines.push('');

  lines.push('PROIZVODNJA');
  lines.push('Stroj;Naziv;Operacija;Smena;Kosi;Mašina (h);Delavec (h);Doseganje (%);Delavec;Tip;Opombe');
  entries.forEach((e) => {
    lines.push([e.machine_id, e.machine_name, e.operacija, shiftLabel(e.shift), e.kosi, Number(e.cas_ur).toFixed(2), e.delavec_ur != null ? Number(e.delavec_ur).toFixed(2) : '', e.ucinkovitost_pct ?? '', e.operater || '', e.tip_vijaka || '', e.opombe || ''].join(';'));
  });
  lines.push('');

  lines.push('ZASTOJI');
  lines.push('Stroj;Smena;Trajanje (h);Razlog;Opis;Popravilo;Pogostost;Odpravil;Delavec');
  stops.forEach((s) => {
    lines.push([s.machine_id, shiftLabel(s.shift), Number(s.duration_hours).toFixed(2), s.reason_category || '', s.description || '', s.repair_done || '', s.frequency || 1, s.fixed_by || '', s.operater || ''].join(';'));
  });
  lines.push('');

  lines.push('ODPADEK');
  lines.push('Stroj;Teža (kg);Izdelek;Žica;Razlog;LOT;Nalog;Delavec;Opombe');
  wastes.forEach((w) => {
    lines.push([w.machine_id, w.weight_kg, w.product || '', w.wire_type || '', w.reason_category || '', w.lot_zice || '', w.nalog || '', w.operater || '', w.notes || ''].join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proizvodnja-v2-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMonthlyCSV(year, month, byMachine, byStopReason, byWasteReason, monthEntries, monthStops) {
  const lines = [];
  lines.push(`Mesečno poročilo PROIZVODNJA v2 - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PO STROJIH');
  lines.push('Stroj;Naziv;Operacija;Kosov;Ur;Doseganje (%);Zastoji (h);Odpadek (kg);Vnosov');
  byMachine.forEach((r) => {
    lines.push([r.machine_id, r.machine_name, r.operacija, r.kosi, r.ur.toFixed(1), r.ucinkovitost ?? '', r.zastoj_ur.toFixed(1), r.odpadek_kg, r.vnosov].join(';'));
  });
  lines.push('');

  lines.push('ZASTOJI PO RAZLOGIH');
  lines.push('Razlog;Ur');
  byStopReason.filter((r) => r.hours > 0).forEach((r) => lines.push(`${r.reason};${r.hours.toFixed(1)}`));
  lines.push('');

  lines.push('ODPADEK PO RAZLOGIH');
  lines.push('Razlog;Kg');
  byWasteReason.filter((r) => r.kg > 0).forEach((r) => lines.push(`${r.reason};${r.kg}`));
  lines.push('');

  lines.push('ANALIZA PO SMENAH');
  lines.push('Smena;Proizvedeno (kos);Mašina (h);Delavec (h);Zastoj (h)');
  [1, 2].forEach((sh) => {
    const ents = (monthEntries || []).filter((e) => (Number(e.shift) === 2 ? 2 : 1) === sh);
    const stps = (monthStops || []).filter((s) => (Number(s.shift) === 2 ? 2 : 1) === sh);
    const kosi = ents.reduce((a, e) => a + Number(e.kosi || 0), 0);
    const masina = ents.reduce((a, e) => a + Number(e.cas_ur || 0), 0);
    const delavec = ents.reduce((a, e) => a + Number(e.delavec_ur || 0), 0);
    const zastoj = stps.reduce((a, s) => a + Number(s.duration_hours || 0), 0);
    lines.push([shiftLabel(sh), kosi, masina.toFixed(2), delavec.toFixed(2), zastoj.toFixed(2)].join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proizvodnja-v2-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── STROJI (admin/Boris): dodajanje, urejanje, "v okvari" ───
function MachinesAdmin({ rows, onReload, setError, isAdmin }) {
  const [editing, setEditing] = useState(null); // DB-vrstica (uredi) | {} (nov) | null
  const [busy, setBusy] = useState(false);

  const grouped = SEGMENTS_META.map((sg) => ({
    ...sg,
    items: (rows || [])
      .filter((r) => r.segment === sg.id)
      .sort((a, b) => (a.sort_order - b.sort_order) || String(a.machine_id).localeCompare(String(b.machine_id))),
  }));

  async function toggleOkvara(r) {
    setBusy(true);
    const { error } = await supabase.from('production_v2_machines')
      .update({ v_okvari: !r.v_okvari, updated_at: new Date().toISOString() }).eq('id', r.id);
    setBusy(false);
    if (error) { setError(error.message); return; }
    onReload();
  }

  async function remove(r) {
    if (!window.confirm(`Izbrišem stroj ${r.machine_id} – ${r.stroj}?\n\nVnosi v zgodovini ostanejo, a se naziv stroja ne bo več prikazoval v analizi.\nČe je stroj samo pokvarjen, raje uporabi "V okvari".`)) return;
    setBusy(true);
    const { error } = await supabase.from('production_v2_machines').delete().eq('id', r.id);
    setBusy(false);
    if (error) { setError(error.message); return; }
    onReload();
  }

  async function save(form) {
    const mid = (form.machine_id || '').trim();
    if (!mid) { setError('Vpiši številko stroja.'); return; }
    if (!form.segment) { setError('Izberi segment.'); return; }
    if (!(form.stroj || '').trim()) { setError('Vpiši naziv stroja.'); return; }
    setBusy(true);
    const payload = {
      machine_id: mid,
      segment: form.segment,
      stroj: form.stroj.trim(),
      operacija: (form.operacija || '').trim(),
      normativ_h: Number(form.normativ_h) || 0,
      normativ_min: Number(form.normativ_min) || 0,
      tipi: (form.tipi || '').trim(),
      v_okvari: !!form.v_okvari,
      sort_order: Number(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };
    const res = form.id
      ? await supabase.from('production_v2_machines').update(payload).eq('id', form.id)
      : await supabase.from('production_v2_machines').insert(payload);
    setBusy(false);
    if (res.error) {
      const dup = (res.error.message || '').toLowerCase().includes('duplicate');
      setError(dup ? `Stroj s številko "${mid}" že obstaja.` : res.error.message);
      return;
    }
    setEditing(null);
    onReload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-as-gray-500">
          Skupaj strojev: <strong>{(rows || []).length}</strong>. Spremembe se takoj poznajo pri vnosu in na tablicah.
        </div>
        <button onClick={() => setEditing({ segment: 'VIJAKI', v_okvari: false, sort_order: 0 })}
          className="px-4 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
          style={{ background: AS_RED }}>
          <Plus className="w-4 h-4" /> Dodaj stroj
        </button>
      </div>

      {editing && (
        <MachineEditor initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={save} />
      )}

      {grouped.map((g) => (
        <SectionCard key={g.id} title={`${g.label} (${g.items.length})`} defaultOpen={g.items.length > 0}>
          {g.items.length === 0 ? <Empty /> : (
            <div className="divide-y divide-as-gray-100">
              {g.items.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-mono font-semibold text-sm w-14">{r.machine_id}</span>
                  <span className="text-sm flex-1 min-w-[140px]">{r.stroj}<span className="text-as-gray-400"> · {r.operacija}</span></span>
                  <span className="text-xs text-as-gray-500 w-24 text-right">{formatNumber(r.normativ_h)} kos/h</span>
                  {r.v_okvari
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#fee', color: '#900' }}>V OKVARI</span>
                    : <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: '#e8f5e9', color: '#1b5e20' }}>OK</span>}
                  <button onClick={() => setEditing(r)} className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50">Uredi</button>
                  <button onClick={() => toggleOkvara(r)} disabled={busy}
                    className="text-xs px-2 py-1 rounded border border-as-gray-200 hover:bg-as-gray-50 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{r.v_okvari ? 'Vklopi' : 'V okvari'}
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(r)} disabled={busy} className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50" title="Izbriši">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}

function MachineEditor({ initial, busy, onCancel, onSave }) {
  const [f, setF] = useState({
    id: initial.id,
    machine_id: initial.machine_id || '',
    segment: initial.segment || 'VIJAKI',
    stroj: initial.stroj || '',
    operacija: initial.operacija || '',
    normativ_h: initial.normativ_h ?? '',
    normativ_min: initial.normativ_min ?? '',
    tipi: initial.tipi || '',
    v_okvari: !!initial.v_okvari,
    sort_order: initial.sort_order ?? 0,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const editRef = useRef(null);
  useEffect(() => { editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);

  return (
    <div ref={editRef} className="border-2 rounded-xl p-4 space-y-3" style={{ borderColor: AS_RED }}>
      <div className="font-semibold">{f.id ? `Uredi stroj ${f.machine_id}` : 'Nov stroj'}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Segment *">
          <select value={f.segment} onChange={(e) => set('segment', e.target.value)} className={inputCls}>
            {SEGMENTS_META.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </FormField>
        <FormField label="Številka stroja *">
          <input value={f.machine_id} onChange={(e) => set('machine_id', e.target.value)} className={inputCls} placeholder="npr. 207" />
        </FormField>
        <FormField label="Naziv stroja *">
          <input value={f.stroj} onChange={(e) => set('stroj', e.target.value)} className={inputCls} placeholder="npr. SACMA SP01" />
        </FormField>
        <FormField label="Operacija">
          <input value={f.operacija} onChange={(e) => set('operacija', e.target.value)} className={inputCls} placeholder="KOVANJE / VALJANJE / STRUŽENJE ..." />
        </FormField>
        <FormField label="Normativ (kos/h) *">
          <input type="number" value={f.normativ_h} onChange={(e) => {
            const h = e.target.value; set('normativ_h', h);
            if (!f.normativ_min) set('normativ_min', h ? Math.round((Number(h) / 60) * 10) / 10 : '');
          }} className={inputCls} placeholder="npr. 9000" />
        </FormField>
        <FormField label="Normativ (kos/min)">
          <input type="number" value={f.normativ_min} onChange={(e) => set('normativ_min', e.target.value)} className={inputCls} placeholder="npr. 150" />
        </FormField>
        <FormField label="Tipi / opombe">
          <input value={f.tipi} onChange={(e) => set('tipi', e.target.value)} className={inputCls} placeholder="npr. M4x8, 4x15 ..." />
        </FormField>
        <FormField label="Vrstni red">
          <input type="number" value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={inputCls} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.v_okvari} onChange={(e) => set('v_okvari', e.target.checked)} />
        <span>Stroj je <strong>v okvari</strong> (skrit delavcem, ostane v analizi)</span>
      </label>
      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={busy}
          className="px-4 py-2 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50" style={{ background: AS_RED }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Shrani
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold rounded-lg border border-as-gray-200 inline-flex items-center gap-2">
          <X className="w-4 h-4" /> Prekliči
        </button>
      </div>
    </div>
  );
}
