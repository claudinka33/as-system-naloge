import { useState, useEffect, useMemo } from 'react';
import { Factory, Plus, Edit2, Trash2, Save, X, AlertCircle, TrendingUp, TrendingDown, Calendar, Clock, Package, User, FileText } from 'lucide-react';
import { supabase } from '../../supabase';
import { SEGMENTS, findMachine, calculateEfficiency } from './productionV2Config';

const AS_RED = '#C8102E';

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

export default function ProductionV2Tab({ currentUser, currentUserName, isAdmin }) {
  const [activeTab, setActiveTab] = useState('vnos'); // vnos | dnevno | mesecno
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Vnos state
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formPieces, setFormPieces] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formTipVijaka, setFormTipVijaka] = useState('');
  const [formOperater, setFormOperater] = useState(currentUserName || '');
  const [formOpombe, setFormOpombe] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Filter state za pregled
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const machineInfo = useMemo(() => (selectedMachine ? findMachine(selectedMachine) : null), [selectedMachine]);

  const filteredMachines = useMemo(() => {
    if (!selectedSegment) return [];
    const seg = SEGMENTS.find((s) => s.id === selectedSegment);
    return seg ? seg.machines : [];
  }, [selectedSegment]);

  // Naloži zapise
  async function loadEntries() {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('production_v2_entries')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function resetForm() {
    setSelectedSegment('');
    setSelectedMachine('');
    setFormPieces('');
    setFormTime('');
    setFormTipVijaka('');
    setFormOpombe('');
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedMachine || !formPieces || !formTime) {
      setError('Izpolni stroj, število kosov in čas.');
      return;
    }
    if (machineInfo?.vOkvari) {
      setError('Ta stroj je označen kot V OKVARI. Vnosa ni mogoče opraviti.');
      return;
    }
    const hours = timeStringToHours(formTime);
    if (hours <= 0) {
      setError('Čas mora biti večji od 0.');
      return;
    }
    const pieces = parseInt(formPieces, 10);
    if (isNaN(pieces) || pieces < 0) {
      setError('Število kosov mora biti pozitivno celo število.');
      return;
    }

    const efficiency = calculateEfficiency(pieces, hours, machineInfo.normativ_h);

    const payload = {
      date: formDate,
      segment: selectedSegment,
      machine_id: selectedMachine,
      machine_name: machineInfo.stroj,
      operacija: machineInfo.operacija,
      normativ_kos_h: machineInfo.normativ_h,
      kosi: pieces,
      cas_ur: hours,
      tip_vijaka: formTipVijaka || null,
      operater: formOperater || null,
      opombe: formOpombe || null,
      ucinkovitost_pct: efficiency,
      created_by: currentUser?.email || null,
    };

    setLoading(true);
    setError('');
    try {
      if (editingId) {
        const { error } = await supabase.from('production_v2_entries').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('production_v2_entries').insert([payload]);
        if (error) throw error;
      }
      resetForm();
      await loadEntries();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(entry) {
    setActiveTab('vnos');
    setEditingId(entry.id);
    setSelectedSegment(entry.segment);
    setSelectedMachine(entry.machine_id);
    setFormDate(entry.date);
    setFormPieces(String(entry.kosi));
    setFormTime(hoursToTimeString(entry.cas_ur));
    setFormTipVijaka(entry.tip_vijaka || '');
    setFormOperater(entry.operater || '');
    setFormOpombe(entry.opombe || '');
  }

  async function handleDelete(id) {
    if (!confirm('Res želiš izbrisati ta vnos?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('production_v2_entries').delete().eq('id', id);
      if (error) throw error;
      await loadEntries();
    } catch (e) {
      setError(e.message || 'Napaka pri brisanju.');
    } finally {
      setLoading(false);
    }
  }

  // Filtri
  const dailyEntries = useMemo(() => entries.filter((e) => e.date === filterDate), [entries, filterDate]);
  const monthlyEntries = useMemo(() => entries.filter((e) => e.date && e.date.startsWith(filterMonth)), [entries, filterMonth]);

  // Mesečni povzetek po strojih
  const monthlySummary = useMemo(() => {
    const map = {};
    for (const e of monthlyEntries) {
      const key = e.machine_id;
      if (!map[key]) {
        map[key] = {
          machine_id: e.machine_id,
          machine_name: e.machine_name,
          segment: e.segment,
          operacija: e.operacija,
          normativ_kos_h: e.normativ_kos_h,
          total_kosi: 0,
          total_ur: 0,
          vnosov: 0,
        };
      }
      map[key].total_kosi += Number(e.kosi || 0);
      map[key].total_ur += Number(e.cas_ur || 0);
      map[key].vnosov += 1;
    }
    return Object.values(map)
      .map((row) => ({
        ...row,
        ucinkovitost: calculateEfficiency(row.total_kosi, row.total_ur, row.normativ_kos_h),
      }))
      .sort((a, b) => a.machine_id.localeCompare(b.machine_id));
  }, [monthlyEntries]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Factory size={28} color={AS_RED} />
        <h2 style={{ margin: 0, color: AS_RED }}>Proizvodnja v2</h2>
        <span style={{ fontSize: 12, padding: '2px 8px', background: '#fff3cd', color: '#856404', borderRadius: 12, fontWeight: 600 }}>BETA - testna verzija</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #eee' }}>
        {[
          { id: 'vnos', label: '➕ Vnos' },
          { id: 'dnevno', label: '📅 Dnevno' },
          { id: 'mesecno', label: '📊 Mesečno' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === t.id ? AS_RED : 'transparent',
              color: activeTab === t.id ? '#fff' : '#333',
              fontWeight: 600,
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: 10, background: '#fee', border: '1px solid #fcc', borderRadius: 6, marginBottom: 12, color: '#900', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* VNOS TAB */}
      {activeTab === 'vnos' && (
        <form onSubmit={handleSubmit} style={{ background: '#f9f9f9', padding: 16, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Uredi vnos' : 'Nov vnos'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
                Datum
              </label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                <User size={14} style={{ display: 'inline', marginRight: 4 }} />
                Operater
              </label>
              <input type="text" value={formOperater} onChange={(e) => setFormOperater(e.target.value)} placeholder="Ime in priimek" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Segment</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SEGMENTS.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => {
                    setSelectedSegment(seg.id);
                    setSelectedMachine('');
                  }}
                  style={{
                    padding: '8px 14px',
                    border: `2px solid ${seg.color}`,
                    background: selectedSegment === seg.id ? seg.color : '#fff',
                    color: selectedSegment === seg.id ? '#fff' : seg.color,
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {selectedSegment && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Stroj</label>
              <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} required style={inputStyle}>
                <option value="">-- izberi stroj --</option>
                {filteredMachines.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.vOkvari}>
                    {m.id} - {m.stroj} ({m.operacija}){m.vOkvari ? ' - V OKVARI' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {machineInfo && !machineInfo.vOkvari && (
            <div style={{ background: '#e8f4fd', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
              <div><strong>Normativ:</strong> {machineInfo.normativ_min} kos/min = <strong>{machineInfo.normativ_h.toLocaleString('sl-SI')} kos/h</strong></div>
              <div><strong>Operacija:</strong> {machineInfo.operacija}</div>
              {machineInfo.tipi && <div><strong>Tipi:</strong> {machineInfo.tipi}</div>}
            </div>
          )}

          {machineInfo && !machineInfo.vOkvari && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    <Package size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Število kosov
                  </label>
                  <input type="number" min="0" value={formPieces} onChange={(e) => setFormPieces(e.target.value)} required style={inputStyle} placeholder="npr. 50000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                    <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Čas (HH:MM)
                  </label>
                  <input type="text" value={formTime} onChange={(e) => setFormTime(e.target.value)} required style={inputStyle} placeholder="npr. 7:30" pattern="[0-9]+:[0-5][0-9]" />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Tip vijaka / izdelka (neobvezno)</label>
                <input type="text" value={formTipVijaka} onChange={(e) => setFormTipVijaka(e.target.value)} style={inputStyle} placeholder={machineInfo.tipi || ''} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: 4 }} />
                  Opombe (neobvezno)
                </label>
                <textarea value={formOpombe} onChange={(e) => setFormOpombe(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {formPieces && formTime && (
                <div style={{ background: '#f0f9ff', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                  Pričakovano po normativu: <strong>{(machineInfo.normativ_h * timeStringToHours(formTime)).toLocaleString('sl-SI')} kos</strong> v {formTime}
                  {(() => {
                    const eff = calculateEfficiency(parseInt(formPieces) || 0, timeStringToHours(formTime), machineInfo.normativ_h);
                    if (eff === null) return null;
                    const color = eff >= 95 ? '#2ecc71' : eff >= 75 ? '#f39c12' : '#e74c3c';
                    return (
                      <span style={{ marginLeft: 12, color, fontWeight: 700 }}>
                        Učinkovitost: {eff}%
                      </span>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading || !machineInfo || machineInfo.vOkvari} style={{ ...btnStyle, background: AS_RED, color: '#fff' }}>
              <Save size={16} style={{ display: 'inline', marginRight: 4 }} />
              {editingId ? 'Posodobi' : 'Shrani'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ ...btnStyle, background: '#999', color: '#fff' }}>
                <X size={16} style={{ display: 'inline', marginRight: 4 }} /> Prekliči
              </button>
            )}
          </div>
        </form>
      )}

      {/* DNEVNO TAB */}
      {activeTab === 'dnevno' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>Datum:</label>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={inputStyle} />
          </div>
          {dailyEntries.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Ni vnosov za ta dan.</p>
          ) : (
            <EntryTable entries={dailyEntries} onEdit={handleEdit} onDelete={handleDelete} isAdmin={isAdmin} currentUser={currentUser} />
          )}
        </div>
      )}

      {/* MESEČNO TAB */}
      {activeTab === 'mesecno' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>Mesec:</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={inputStyle} />
          </div>
          {monthlySummary.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Ni vnosov za ta mesec.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f4f4f4' }}>
                  <th style={thStyle}>Stroj</th>
                  <th style={thStyle}>Naziv</th>
                  <th style={thStyle}>Operacija</th>
                  <th style={thStyle}>Skupaj kosov</th>
                  <th style={thStyle}>Skupaj ur</th>
                  <th style={thStyle}>Normativ/h</th>
                  <th style={thStyle}>Učinkovitost</th>
                  <th style={thStyle}>Vnosov</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.map((row) => (
                  <tr key={row.machine_id}>
                    <td style={tdStyle}><strong>{row.machine_id}</strong></td>
                    <td style={tdStyle}>{row.machine_name}</td>
                    <td style={tdStyle}>{row.operacija}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.total_kosi.toLocaleString('sl-SI')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{hoursToTimeString(row.total_ur)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(row.normativ_kos_h).toLocaleString('sl-SI')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <EfficiencyBadge value={row.ucinkovitost} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.vnosov}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function EntryTable({ entries, onEdit, onDelete, isAdmin, currentUser }) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr style={{ background: '#f4f4f4' }}>
          <th style={thStyle}>Stroj</th>
          <th style={thStyle}>Operacija</th>
          <th style={thStyle}>Kosi</th>
          <th style={thStyle}>Čas</th>
          <th style={thStyle}>Učinkovitost</th>
          <th style={thStyle}>Operater</th>
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
              <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(e.kosi).toLocaleString('sl-SI')}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{hoursToTimeString(e.cas_ur)}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}><EfficiencyBadge value={e.ucinkovitost_pct} /></td>
              <td style={tdStyle}>{e.operater || '-'}</td>
              <td style={tdStyle}>{e.tip_vijaka || '-'}</td>
              <td style={tdStyle}>{e.opombe || '-'}</td>
              <td style={tdStyle}>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onEdit(e)} style={{ ...btnStyle, padding: '4px 8px', background: '#3498db', color: '#fff' }} title="Uredi">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(e.id)} style={{ ...btnStyle, padding: '4px 8px', background: '#e74c3c', color: '#fff' }} title="Izbriši">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function EfficiencyBadge({ value }) {
  if (value === null || value === undefined) return <span style={{ color: '#999' }}>-</span>;
  const color = value >= 95 ? '#2ecc71' : value >= 75 ? '#f39c12' : '#e74c3c';
  const Icon = value >= 95 ? TrendingUp : TrendingDown;
  return (
    <span style={{ color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={14} /> {value}%
    </span>
  );
}

const inputStyle = { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 14, width: '100%', boxSizing: 'border-box' };
const btnStyle = { padding: '8px 14px', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' };
const thStyle = { padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid #ccc', fontWeight: 700 };
const tdStyle = { padding: '8px 6px', borderBottom: '1px solid #eee' };
