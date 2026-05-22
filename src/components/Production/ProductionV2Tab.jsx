import { useState, useEffect, useMemo } from 'react';
import { Factory, Plus, Edit2, Trash2, Save, X, AlertCircle, TrendingUp, TrendingDown, Calendar, Clock, Package, User, FileText, AlertTriangle, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../supabase';
import { SEGMENTS, findMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

// Razlogi za ZASTOJ STROJA (iz starega modula)
const STOP_REASONS = [
  'Drugo',
  'Menjava',
  'Menjava orodja',
  'Menjava žice',
  'Nastavitev proge',
  'Nastavitev senzorja',
  'Nastavitev valjanja',
  'Razširilo progo',
  'Zatikanje na progi',
  'Zlomljene vzmeti',
  'Čiščenje stroja',
  'Servis stroja',
];

// Razlogi za ODPADEK (iz starega modula)
const WASTE_REASONS = [
  'Čiščenje stroja',
  'Drugo',
  'Odrez od špice',
  'Slab navoj',
  'Slabi izdelki - dimenzija',
  'Slabi izdelki - površina',
  'Slabi komadi',
  'Slabo rebričenje',
  'Zlomgalvač',
];

// Tipi žice (placeholder, lahko se kasneje uredi)
const WIRE_TYPES = ['Brez', 'Pocinkana', 'Nerjavna', 'Surova', 'Drugo'];

// Pretvori HH:MM v decimal ure
function timeStringToHours(timeStr) {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h + m / 60;
}

// Pretvori decimal ure v HH:MM
function hoursToTimeString(hours) {
  if (!hours || hours <= 0) return '00:00';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ProductionV2Tab({ currentUser, isAdmin }) {
  const [activeTab, setActiveTab] = useState('vnos'); // vnos | dnevno | mesecno
  const [vnosSection, setVnosSection] = useState('proizvodnja'); // proizvodnja | zastoj | odpadek

  // Data state
  const [entries, setEntries] = useState([]); // proizvodnja
  const [stops, setStops] = useState([]); // zastoji
  const [wastes, setWastes] = useState([]); // odpadki
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter state
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // ─── LOAD DATA ───
  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [e, s, w] = await Promise.all([
        supabase.from('production_v2_entries').select('*').order('date', { ascending: false }).limit(500),
        supabase.from('production_v2_stops').select('*').order('date', { ascending: false }).limit(500),
        supabase.from('production_v2_waste').select('*').order('date', { ascending: false }).limit(500),
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

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Factory size={28} color={AS_RED} />
        <h2 style={{ margin: 0, color: AS_RED }}>Proizvodnja v2</h2>
        <span style={{ fontSize: 12, padding: '2px 8px', background: '#fff3cd', color: '#856404', borderRadius: 12, fontWeight: 600 }}>BETA - testna verzija</span>
      </div>

      {/* Glavni tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #eee', flexWrap: 'wrap' }}>
        {[
          { id: 'vnos', label: '➕ Vnos' },
          { id: 'dnevno', label: '📅 Dnevno' },
          { id: 'mesecno', label: '📊 Mesečno' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: activeTab === t.id ? AS_RED : 'transparent',
              color: activeTab === t.id ? '#fff' : '#333',
              fontWeight: 600,
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 10, background: '#fee', border: '1px solid #fcc', borderRadius: 6, marginBottom: 12, color: '#900', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* VNOS TAB */}
      {activeTab === 'vnos' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <SectionButton active={vnosSection === 'proizvodnja'} onClick={() => setVnosSection('proizvodnja')} icon={<Package size={18} />} label="Proizvodnja" color="#27AE60" />
            <SectionButton active={vnosSection === 'zastoj'} onClick={() => setVnosSection('zastoj')} icon={<AlertTriangle size={18} />} label="Zastoj stroja" color="#F39C12" />
            <SectionButton active={vnosSection === 'odpadek'} onClick={() => setVnosSection('odpadek')} icon={<Trash size={18} />} label="Odpadek" color="#E74C3C" />
          </div>

          {vnosSection === 'proizvodnja' && <ProductionForm currentUser={currentUser} onSaved={loadAll} setError={setError} />}
          {vnosSection === 'zastoj' && <StopForm currentUser={currentUser} onSaved={loadAll} setError={setError} />}
          {vnosSection === 'odpadek' && <WasteForm currentUser={currentUser} onSaved={loadAll} setError={setError} />}
        </div>
      )}

      {/* DNEVNO TAB */}
      {activeTab === 'dnevno' && (
        <DailyView
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          entries={entries}
          stops={stops}
          wastes={wastes}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onReload={loadAll}
        />
      )}

      {/* MESEČNO TAB */}
      {activeTab === 'mesecno' && (
        <MonthlyView
          filterMonth={filterMonth}
          setFilterMonth={setFilterMonth}
          entries={entries}
          stops={stops}
          wastes={wastes}
        />
      )}
    </div>
  );
}

// ─── SECTION BUTTON ───
function SectionButton({ active, onClick, icon, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 20px',
        border: `2px solid ${color}`,
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        fontWeight: 700,
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
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
    setFormOperater('');
    setFormOpombe('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formPieces || !formTime || !formOperater) {
      setError('Izpolni stroj, število kosov, čas in delavca.');
      return;
    }
    if (machineInfo?.vOkvari) {
      setError('Ta stroj je V OKVARI.');
      return;
    }
    const hours = timeStringToHours(formTime);
    if (hours <= 0) {
      setError('Čas mora biti večji od 0.');
      return;
    }
    const pieces = parseInt(formPieces, 10);
    if (isNaN(pieces) || pieces < 0) {
      setError('Število kosov mora biti pozitivno.');
      return;
    }
    const efficiency = calculateEfficiency(pieces, hours, machineInfo.normativ_h);

    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.from('production_v2_entries').insert([{
        date: formDate,
        segment: selectedSegment,
        machine_id: selectedMachine,
        machine_name: machineInfo.stroj,
        operacija: machineInfo.operacija,
        normativ_kos_h: machineInfo.normativ_h,
        kosi: pieces,
        cas_ur: hours,
        tip_vijaka: formTipVijaka || null,
        operater: formOperater,
        opombe: formOpombe || null,
        ucinkovitost_pct: efficiency,
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
    <form onSubmit={handleSubmit} style={formCard}>
      <h3 style={{ marginTop: 0, color: '#27AE60' }}>Nov vnos proizvodnje</h3>

      <Row>
        <Field label="Datum *" icon={<Calendar size={14} />}>
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="Delavec / Operater *" icon={<User size={14} />}>
          <input type="text" value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required style={inputStyle} placeholder="Ime in priimek" />
        </Field>
      </Row>

      <Field label="Segment *">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEGMENTS.map((seg) => (
            <button key={seg.id} type="button" onClick={() => { setSelectedSegment(seg.id); setSelectedMachine(''); }} style={segmentBtn(seg, selectedSegment === seg.id)}>
              {seg.label}
            </button>
          ))}
        </div>
      </Field>

      {selectedSegment && (
        <Field label="Stroj *">
          <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required style={inputStyle}>
            <option value="">-- izberi stroj --</option>
            {filteredMachines.map((m) => (
              <option key={m.id} value={m.id} disabled={m.vOkvari}>
                {m.id} - {m.stroj} ({m.operacija}){m.vOkvari ? ' - V OKVARI' : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

      {machineInfo && !machineInfo.vOkvari && (
        <div style={infoBox}>
          <div><strong>Normativ:</strong> {machineInfo.normativ_min} kos/min = <strong>{machineInfo.normativ_h.toLocaleString('sl-SI')} kos/h</strong></div>
          <div><strong>Operacija:</strong> {machineInfo.operacija}</div>
          {machineInfo.tipi && <div><strong>Tipi:</strong> {machineInfo.tipi}</div>}
        </div>
      )}

      {machineInfo && !machineInfo.vOkvari && (
        <>
          <Row>
            <Field label="Število kosov *" icon={<Package size={14} />}>
              <input type="number" min="0" value={formPieces} onChange={(e) => setFormPieces(e.target.value)} required style={inputStyle} placeholder="npr. 50000" />
            </Field>
            <Field label="Čas (HH:MM) *" icon={<Clock size={14} />}>
              <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required style={inputStyle} placeholder="npr. 7:30" pattern="[0-9]+:[0-5][0-9]" />
            </Field>
          </Row>

          <Field label="Tip vijaka / izdelka (neobvezno)">
            <input type="text" value={formTipVijaka} onChange={(e) => setFormTipVijaka(e.target.value)} style={inputStyle} placeholder={machineInfo.tipi || ''} />
          </Field>

          <Field label="Opombe" icon={<FileText size={14} />}>
            <textarea value={formOpombe} onChange={(e) => setFormOpombe(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          {formPieces && formTime && (
            <div style={previewBox}>
              Pričakovano po normativu: <strong>{(machineInfo.normativ_h * timeStringToHours(formTime)).toLocaleString('sl-SI')} kos</strong> v {formTime}
              {(() => {
                const eff = calculateEfficiency(parseInt(formPieces) || 0, timeStringToHours(formTime), machineInfo.normativ_h);
                if (eff === null) return null;
                const color = eff >= 95 ? '#2ecc71' : eff >= 75 ? '#f39c12' : '#e74c3c';
                return <span style={{ marginLeft: 12, color, fontWeight: 700 }}>Učinkovitost: {eff}%</span>;
              })()}
            </div>
          )}
        </>
      )}

      <button type="submit" disabled={loading || !machineInfo || machineInfo?.vOkvari} style={{ ...primaryBtn, background: '#27AE60' }}>
        <Save size={16} style={{ display: 'inline', marginRight: 6 }} /> Shrani proizvodnjo
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
    setFormTime('');
    setSelectedMachine('');
    setFormReason('');
    setFormDescription('');
    setFormRepair('');
    setFormFrequency('1');
    setFormFixedBy('');
    setFormOperater('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formTime || !formOperater) {
      setError('Izpolni stroj, trajanje in delavca.');
      return;
    }
    const hours = timeStringToHours(formTime);
    if (hours <= 0) {
      setError('Trajanje mora biti večje od 0.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.from('production_v2_stops').insert([{
        date: formDate,
        duration_hours: hours,
        segment: machineInfo?.segment || null,
        machine_id: selectedMachine,
        machine_name: machineInfo?.stroj || null,
        reason_category: formReason || null,
        description: formDescription || null,
        repair_done: formRepair || null,
        frequency: parseInt(formFrequency) || 1,
        fixed_by: formFixedBy || null,
        operater: formOperater,
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
    <form onSubmit={handleSubmit} style={formCard}>
      <h3 style={{ marginTop: 0, color: '#F39C12' }}>Nov zastoj stroja</h3>

      <Row>
        <Field label="Datum *" icon={<Calendar size={14} />}>
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="Trajanje (HH:MM) *" icon={<Clock size={14} />}>
          <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required style={inputStyle} placeholder="npr. 1:30" pattern="[0-9]+:[0-5][0-9]" />
        </Field>
      </Row>

      <Field label="Stroj *">
        <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required style={inputStyle}>
          <option value="">-- izberi stroj --</option>
          {SEGMENTS.map((seg) => (
            <optgroup key={seg.id} label={seg.label}>
              {seg.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.stroj}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Razlog (kategorija)">
        <select value={formReason} onChange={(e) => setFormReason(e.target.value)} style={inputStyle}>
          <option value="">-- izberi razlog --</option>
          {STOP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>

      <Field label="Opis okvare">
        <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="npr. Zlomljene vzmeti na 5. postaji" />
      </Field>

      <Field label="Opravljeno delo / popravilo">
        <textarea value={formRepair} onChange={(e) => setFormRepair(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="npr. Menjava špancang, vzmeti, matrice, igle" />
      </Field>

      <Row>
        <Field label="Pogostost">
          <input type="number" min="1" value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Napako odpravil">
          <input type="text" value={formFixedBy} onChange={(e) => setFormFixedBy(e.target.value)} style={inputStyle} placeholder="npr. Augustinčič" />
        </Field>
      </Row>

      <Field label="Delavec / Operater *" icon={<User size={14} />}>
        <input type="text" value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required style={inputStyle} placeholder="Ime in priimek" />
      </Field>

      <button type="submit" disabled={loading} style={{ ...primaryBtn, background: '#F39C12' }}>
        <Save size={16} style={{ display: 'inline', marginRight: 6 }} /> Shrani zastoj
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
    setFormWeight('');
    setSelectedMachine('');
    setFormProduct('');
    setFormWire('Brez');
    setFormReason('');
    setFormLot('');
    setFormNalog('');
    setFormOperater('');
    setFormNotes('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formWeight || !formOperater) {
      setError('Izpolni stroj, težo in delavca.');
      return;
    }
    const weight = parseFloat(formWeight);
    if (isNaN(weight) || weight <= 0) {
      setError('Teža mora biti pozitivno število.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.from('production_v2_waste').insert([{
        date: formDate,
        weight_kg: weight,
        segment: machineInfo?.segment || null,
        machine_id: selectedMachine,
        machine_name: machineInfo?.stroj || null,
        product: formProduct || null,
        wire_type: formWire === 'Brez' ? null : formWire,
        reason_category: formReason || null,
        lot_zice: formLot || null,
        nalog: formNalog || null,
        operater: formOperater,
        notes: formNotes || null,
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
    <form onSubmit={handleSubmit} style={formCard}>
      <h3 style={{ marginTop: 0, color: '#E74C3C' }}>Nov odpadek</h3>

      <Row>
        <Field label="Datum *" icon={<Calendar size={14} />}>
          <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="Teža (kg) *" icon={<Package size={14} />}>
          <input type="number" step="0.01" min="0" value={formWeight} onChange={(e) => setFormWeight(e.target.value)} required style={inputStyle} placeholder="npr. 135" />
        </Field>
      </Row>

      <Field label="Stroj *">
        <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required style={inputStyle}>
          <option value="">-- izberi stroj --</option>
          {SEGMENTS.map((seg) => (
            <optgroup key={seg.id} label={seg.label}>
              {seg.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.stroj}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="Izdelek">
        <input type="text" value={formProduct} onChange={(e) => setFormProduct(e.target.value)} style={inputStyle} placeholder="npr. M4x8, Sidro M16 (kasneje dropdown)" />
      </Field>

      <Row>
        <Field label="Žica">
          <select value={formWire} onChange={(e) => setFormWire(e.target.value)} style={inputStyle}>
            {WIRE_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Razlog napake">
          <select value={formReason} onChange={(e) => setFormReason(e.target.value)} style={inputStyle}>
            <option value="">-- izberi --</option>
            {WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="LOT žice">
          <input type="text" value={formLot} onChange={(e) => setFormLot(e.target.value)} style={inputStyle} placeholder="npr. 503285" />
        </Field>
        <Field label="Nalog">
          <input type="text" value={formNalog} onChange={(e) => setFormNalog(e.target.value)} style={inputStyle} placeholder="npr. 20012" />
        </Field>
      </Row>

      <Field label="Delavec / Operater *" icon={<User size={14} />}>
        <input type="text" value={formOperater} onChange={(e) => setFormOperater(e.target.value)} required style={inputStyle} placeholder="Ime in priimek" />
      </Field>

      <Field label="Opombe">
        <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      <button type="submit" disabled={loading} style={{ ...primaryBtn, background: '#E74C3C' }}>
        <Save size={16} style={{ display: 'inline', marginRight: 6 }} /> Shrani odpadek
      </button>
    </form>
  );
}

// ─── DAILY VIEW ───
function DailyView({ filterDate, setFilterDate, entries, stops, wastes, isAdmin, currentUser, onReload }) {
  const dayEntries = entries.filter((e) => e.date === filterDate);
  const dayStops = stops.filter((e) => e.date === filterDate);
  const dayWastes = wastes.filter((e) => e.date === filterDate);

  const totalPieces = dayEntries.reduce((s, e) => s + Number(e.kosi || 0), 0);
  const totalHours = dayEntries.reduce((s, e) => s + Number(e.cas_ur || 0), 0);
  const totalStopHours = dayStops.reduce((s, e) => s + Number(e.duration_hours || 0), 0);
  const totalWasteKg = dayWastes.reduce((s, e) => s + Number(e.weight_kg || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 700, marginRight: 10, fontSize: 15 }}>Datum:</label>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, width: 200, display: 'inline-block' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Skupaj kosov" value={totalPieces.toLocaleString('sl-SI')} color="#27AE60" icon={<Package size={20} />} />
        <StatCard label="Skupaj ur dela" value={hoursToTimeString(totalHours)} color="#3498DB" icon={<Clock size={20} />} />
        <StatCard label="Zastoji (h)" value={hoursToTimeString(totalStopHours)} color="#F39C12" icon={<AlertTriangle size={20} />} />
        <StatCard label="Odpadek (kg)" value={totalWasteKg.toLocaleString('sl-SI')} color="#E74C3C" icon={<Trash size={20} />} />
      </div>

      <Collapsible title={`Proizvodnja (${dayEntries.length})`} color="#27AE60" defaultOpen>
        {dayEntries.length === 0 ? <Empty /> : <EntryTable entries={dayEntries} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
      </Collapsible>

      <Collapsible title={`Zastoji (${dayStops.length})`} color="#F39C12">
        {dayStops.length === 0 ? <Empty /> : <StopsTable rows={dayStops} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
      </Collapsible>

      <Collapsible title={`Odpadek (${dayWastes.length})`} color="#E74C3C">
        {dayWastes.length === 0 ? <Empty /> : <WasteTable rows={dayWastes} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />}
      </Collapsible>
    </div>
  );
}

// ─── MONTHLY VIEW ───
function MonthlyView({ filterMonth, setFilterMonth, entries, stops, wastes }) {
  const monthEntries = entries.filter((e) => e.date?.startsWith(filterMonth));
  const monthStops = stops.filter((e) => e.date?.startsWith(filterMonth));
  const monthWastes = wastes.filter((e) => e.date?.startsWith(filterMonth));

  const summary = useMemo(() => {
    const map = {};
    for (const e of monthEntries) {
      const k = e.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: e.machine_name, operacija: e.operacija, normativ_kos_h: e.normativ_kos_h, total_kosi: 0, total_ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0 };
      map[k].total_kosi += Number(e.kosi || 0);
      map[k].total_ur += Number(e.cas_ur || 0);
      map[k].vnosov += 1;
    }
    for (const s of monthStops) {
      const k = s.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: s.machine_name, operacija: '-', normativ_kos_h: 0, total_kosi: 0, total_ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0 };
      map[k].zastoj_ur += Number(s.duration_hours || 0);
    }
    for (const w of monthWastes) {
      const k = w.machine_id;
      if (!map[k]) map[k] = { machine_id: k, machine_name: w.machine_name, operacija: '-', normativ_kos_h: 0, total_kosi: 0, total_ur: 0, vnosov: 0, zastoj_ur: 0, odpadek_kg: 0 };
      map[k].odpadek_kg += Number(w.weight_kg || 0);
    }
    return Object.values(map).map((r) => ({ ...r, ucinkovitost: calculateEfficiency(r.total_kosi, r.total_ur, r.normativ_kos_h) })).sort((a, b) => a.machine_id.localeCompare(b.machine_id));
  }, [monthEntries, monthStops, monthWastes]);

  const totals = useMemo(() => ({
    pieces: monthEntries.reduce((s, e) => s + Number(e.kosi || 0), 0),
    hours: monthEntries.reduce((s, e) => s + Number(e.cas_ur || 0), 0),
    stops: monthStops.reduce((s, e) => s + Number(e.duration_hours || 0), 0),
    waste: monthWastes.reduce((s, e) => s + Number(e.weight_kg || 0), 0),
  }), [monthEntries, monthStops, monthWastes]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 700, marginRight: 10, fontSize: 15 }}>Mesec:</label>
        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ ...inputStyle, width: 200, display: 'inline-block' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Kosov v mesecu" value={totals.pieces.toLocaleString('sl-SI')} color="#27AE60" icon={<Package size={20} />} />
        <StatCard label="Ur dela" value={hoursToTimeString(totals.hours)} color="#3498DB" icon={<Clock size={20} />} />
        <StatCard label="Zastoji (h)" value={hoursToTimeString(totals.stops)} color="#F39C12" icon={<AlertTriangle size={20} />} />
        <StatCard label="Odpadek (kg)" value={totals.waste.toLocaleString('sl-SI')} color="#E74C3C" icon={<Trash size={20} />} />
      </div>

      {summary.length === 0 ? <p style={{ color: '#888', fontStyle: 'italic' }}>Ni vnosov za ta mesec.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={thStyle}>Stroj</th>
                <th style={thStyle}>Naziv</th>
                <th style={thStyle}>Operacija</th>
                <th style={thStyle}>Kosov</th>
                <th style={thStyle}>Ur</th>
                <th style={thStyle}>Normativ/h</th>
                <th style={thStyle}>Učinkovitost</th>
                <th style={thStyle}>Zastoji</th>
                <th style={thStyle}>Odpadek (kg)</th>
                <th style={thStyle}>Vnosov</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.machine_id}>
                  <td style={tdStyle}><strong>{row.machine_id}</strong></td>
                  <td style={tdStyle}>{row.machine_name}</td>
                  <td style={tdStyle}>{row.operacija}</td>
                  <td style={tdStyle}>{row.total_kosi.toLocaleString('sl-SI')}</td>
                  <td style={tdStyle}>{hoursToTimeString(row.total_ur)}</td>
                  <td style={tdStyle}>{Number(row.normativ_kos_h).toLocaleString('sl-SI')}</td>
                  <td style={tdStyle}><EfficiencyBadge value={row.ucinkovitost} /></td>
                  <td style={tdStyle}>{hoursToTimeString(row.zastoj_ur)}</td>
                  <td style={tdStyle}>{row.odpadek_kg.toLocaleString('sl-SI')}</td>
                  <td style={tdStyle}>{row.vnosov}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th style={thStyle}>Stroj</th>
            <th style={thStyle}>Operacija</th>
            <th style={thStyle}>Kosi</th>
            <th style={thStyle}>Čas</th>
            <th style={thStyle}>Učinkovitost</th>
            <th style={thStyle}>Delavec</th>
            <th style={thStyle}>Tip</th>
            <th style={thStyle}>Opombe</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            return (
              <tr key={e.id}>
                <td style={tdStyle}><strong>{e.machine_id}</strong><br /><span style={{ fontSize: 11, color: '#666' }}>{e.machine_name}</span></td>
                <td style={tdStyle}>{e.operacija}</td>
                <td style={tdStyle}>{Number(e.kosi).toLocaleString('sl-SI')}</td>
                <td style={tdStyle}>{hoursToTimeString(e.cas_ur)}</td>
                <td style={tdStyle}><EfficiencyBadge value={e.ucinkovitost_pct} /></td>
                <td style={tdStyle}>{e.operater || '-'}</td>
                <td style={tdStyle}>{e.tip_vijaka || '-'}</td>
                <td style={tdStyle}>{e.opombe || '-'}</td>
                <td style={tdStyle}>
                  {canEdit && <button onClick={() => handleDelete(e.id)} style={iconBtn('#e74c3c')}><Trash2 size={14} /></button>}
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
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th style={thStyle}>Stroj</th>
            <th style={thStyle}>Trajanje</th>
            <th style={thStyle}>Razlog</th>
            <th style={thStyle}>Opis</th>
            <th style={thStyle}>Popravilo</th>
            <th style={thStyle}>Pogostost</th>
            <th style={thStyle}>Odpravil</th>
            <th style={thStyle}>Delavec</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            return (
              <tr key={e.id}>
                <td style={tdStyle}><strong>{e.machine_id}</strong><br /><span style={{ fontSize: 11, color: '#666' }}>{e.machine_name}</span></td>
                <td style={tdStyle}>{hoursToTimeString(e.duration_hours)}</td>
                <td style={tdStyle}>{e.reason_category || '-'}</td>
                <td style={tdStyle}>{e.description || '-'}</td>
                <td style={tdStyle}>{e.repair_done || '-'}</td>
                <td style={tdStyle}>{e.frequency || 1}</td>
                <td style={tdStyle}>{e.fixed_by || '-'}</td>
                <td style={tdStyle}>{e.operater || '-'}</td>
                <td style={tdStyle}>
                  {canEdit && <button onClick={() => handleDelete(e.id)} style={iconBtn('#e74c3c')}><Trash2 size={14} /></button>}
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
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th style={thStyle}>Stroj</th>
            <th style={thStyle}>Teža (kg)</th>
            <th style={thStyle}>Izdelek</th>
            <th style={thStyle}>Žica</th>
            <th style={thStyle}>Razlog</th>
            <th style={thStyle}>LOT žice</th>
            <th style={thStyle}>Nalog</th>
            <th style={thStyle}>Delavec</th>
            <th style={thStyle}>Opombe</th>
            <th style={thStyle}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const canEdit = isAdmin || e.created_by === currentUser?.email;
            return (
              <tr key={e.id}>
                <td style={tdStyle}><strong>{e.machine_id}</strong><br /><span style={{ fontSize: 11, color: '#666' }}>{e.machine_name}</span></td>
                <td style={tdStyle}>{Number(e.weight_kg).toLocaleString('sl-SI')}</td>
                <td style={tdStyle}>{e.product || '-'}</td>
                <td style={tdStyle}>{e.wire_type || '-'}</td>
                <td style={tdStyle}>{e.reason_category || '-'}</td>
                <td style={tdStyle}>{e.lot_zice || '-'}</td>
                <td style={tdStyle}>{e.nalog || '-'}</td>
                <td style={tdStyle}>{e.operater || '-'}</td>
                <td style={tdStyle}>{e.notes || '-'}</td>
                <td style={tdStyle}>
                  {canEdit && <button onClick={() => handleDelete(e.id)} style={iconBtn('#e74c3c')}><Trash2 size={14} /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── HELPERS ───
function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ background: '#fff', border: `2px solid ${color}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>{icon} <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span></div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#222' }}>{value}</div>
    </div>
  );
}

function Collapsible({ title, color, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', padding: '10px 14px', background: open ? color : '#fff', color: open ? '#fff' : color, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 15 }}>
        <span>{title}</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div style={{ padding: 12, background: '#fff' }}>{children}</div>}
    </div>
  );
}

function Empty() { return <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Ni vnosov.</p>; }

function EfficiencyBadge({ value }) {
  if (value === null || value === undefined) return <span style={{ color: '#999' }}>-</span>;
  const color = value >= 95 ? '#2ecc71' : value >= 75 ? '#f39c12' : '#e74c3c';
  const Icon = value >= 95 ? TrendingUp : TrendingDown;
  return <span style={{ color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon size={14} /> {value}%</span>;
}

function Field({ label, icon, children }) {
  return (
    <div style={{ marginBottom: 12, flex: 1, minWidth: 0 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
        {icon && <span style={{ marginRight: 4, verticalAlign: 'middle' }}>{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>;
}

function segmentBtn(seg, active) {
  return {
    padding: '8px 14px',
    border: `2px solid ${seg.color}`,
    background: active ? seg.color : '#fff',
    color: active ? '#fff' : seg.color,
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  };
}

function iconBtn(bg) {
  return { padding: '4px 8px', background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' };
}

const inputStyle = { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, width: '100%', boxSizing: 'border-box' };
const primaryBtn = { padding: '12px 20px', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 15, color: '#fff', marginTop: 8 };
const formCard = { background: '#f9f9f9', padding: 18, borderRadius: 10 };
const infoBox = { background: '#e8f4fd', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 };
const previewBox = { background: '#f0f9ff', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' };
const thStyle = { padding: '10px 8px', textAlign: 'left', borderBottom: '2px solid #ccc', fontWeight: 700 };
const tdStyle = { padding: '8px 8px', borderBottom: '1px solid #eee' };
