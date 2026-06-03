// ProductionV2Tab.jsx — Glavni zavihek "Proizvodnja v2" (BETA)
// Dizajn usklajen z Montažo (AssemblyTab style)
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BarChart3, Package, AlertTriangle, Trash, Loader2, Download, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, TrendingUp, TrendingDown, Clock, User, FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { SEGMENTS, findMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

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

export default function ProductionV2Tab({ currentUser, isAdmin }) {
  const [view, setView] = useState('monthly');

  // Data state
  const [entries, setEntries] = useState([]);
  const [stops, setStops] = useState([]);
  const [wastes, setWastes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div>
      {/* Glavna vrstica: tabe levo, kontrole desno preko portala */}
      <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
            <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
            <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
            <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
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
    </div>
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
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formPieces, setFormPieces] = useState('');
  const [formTime, setFormTime] = useState('');
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
            {OPERATERJI.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormField>
      </div>

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
            <FormField label="Čas (HH:MM) *">
              <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required className={inputCls} placeholder="npr. 7:30" pattern="[0-9]+:[0-5][0-9]" />
            </FormField>
          </div>

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
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('');
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
        date: formDate, duration_hours: hours,
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
          {STOP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
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
            {OPERATERJI.map((d) => <option key={d} value={d}>{d}</option>)}
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
            {OPERATERJI.map((d) => <option key={d} value={d}>{d}</option>)}
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
  const overallEfficiency = totalExpected > 0 ? Math.round((totalPieces / totalExpected) * 100) : null;

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
  const overallEfficiency = totalExpected > 0 ? Math.round((totalPieces / totalExpected) * 100) : null;

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
        onClick={() => exportMonthlyCSV(year, month, byMachine, byStopReason, byWasteReason)}
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

          {/* Po delavcih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">👷 Po delavcih — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {byWorker.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Delavec</th>
                      <th className="text-right p-2">Kosov</th>
                      <th className="text-right p-2">Ur</th>
                      <th className="text-right p-2">Doseganje</th>
                      <th className="text-right p-2">Zastoji (h)</th>
                      <th className="text-right p-2">Odpadek (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byWorker.map((r) => {
                      const pct = r.ucinkovitost;
                      const color = pct === null ? '#9CA3AF' : pct >= 95 ? '#16A34A' : pct >= 75 ? '#D97706' : '#DC2626';
                      return (
                        <tr key={r.operater} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                          <td className="p-2 font-semibold">{r.operater}</td>
                          <td className="p-2 text-right font-semibold">{formatNumber(r.kosi)}</td>
                          <td className="p-2 text-right">{r.ur.toFixed(1)}</td>
                          <td className="p-2 text-right font-bold" style={{ color }}>{pct === null ? '—' : `${pct}%`}</td>
                          <td className="p-2 text-right">{r.zastoj_ur.toFixed(1)}</td>
                          <td className="p-2 text-right">{formatNumber(r.odpadek_kg)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
            <th className="text-right p-2">Kosi</th>
            <th className="text-right p-2">Čas</th>
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
                <td className="p-2 text-right font-semibold">{formatNumber(e.kosi)}</td>
                <td className="p-2 text-right">{hoursToTimeString(e.cas_ur)}</td>
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
  lines.push('Stroj;Naziv;Operacija;Kosi;Čas (h);Doseganje (%);Delavec;Tip;Opombe');
  entries.forEach((e) => {
    lines.push([e.machine_id, e.machine_name, e.operacija, e.kosi, Number(e.cas_ur).toFixed(2), e.ucinkovitost_pct ?? '', e.operater || '', e.tip_vijaka || '', e.opombe || ''].join(';'));
  });
  lines.push('');

  lines.push('ZASTOJI');
  lines.push('Stroj;Trajanje (h);Razlog;Opis;Popravilo;Pogostost;Odpravil;Delavec');
  stops.forEach((s) => {
    lines.push([s.machine_id, Number(s.duration_hours).toFixed(2), s.reason_category || '', s.description || '', s.repair_done || '', s.frequency || 1, s.fixed_by || '', s.operater || ''].join(';'));
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

function exportMonthlyCSV(year, month, byMachine, byStopReason, byWasteReason) {
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
