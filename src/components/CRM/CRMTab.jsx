// CRMTab.jsx — CRM modul za komercialiste (obiski strank + kilometrina + ponudbe)
// Mobilno/tablično prijazno: privzeti pogled je Vnos, živ izračun časa, jasna potrditev shranjevanja,
// analiza z zgodovino po posamezni stranki.
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Calendar, BarChart3, Loader2, Download, Trash2, ChevronDown, ChevronRight, Save, X, AlertCircle, Home, MapPin, Clock, Car, FileText, User, Briefcase, Phone, Mail, CheckCircle2, TrendingUp, Target } from 'lucide-react';
import { supabase } from '../../supabase';
import { syncTaskWebhook } from '../../webhooks.js';
import CalendarView from '../CalendarView';

// Pošlje email + Outlook obvestilo odgovorni osebi (znova uporabi obstoječi task-sync n8n flow).
// Vrne outlook_event_id (ali null). Napaka ne prekine shranjevanja.
async function crmNotifyResponsible({ kind, customerName, dateTimeISO, descLines, responsibleEmail, responsibleName, createdByName, employees }) {
  if (!responsibleEmail) return null;
  const titlePrefix = kind === 'call' ? 'CRM klic / email' : 'CRM obisk';
  const pseudoTask = {
    id: `crm-${kind}-${Date.now()}`,
    title: `${titlePrefix}: ${customerName || 'stranka'}`,
    description: (descLines || []).filter(Boolean).join(' · ').replace(/[\r\n\t]+/g, ' ').replace(/"/g, "'"),
    due_date: dateTimeISO,
    priority: 'medium',
    assigned_to_emails: [responsibleEmail],
    add_to_calendar: true,
    outlook_event_id: null,
  };
  try {
    const res = await syncTaskWebhook('create', pseudoTask, employees || [], createdByName);
    return res?.outlook_event_id || null;
  } catch (e) {
    console.error('[crm] obvestilo napaka:', e);
    return null;
  }
}

const AS_RED = '#C8102E';
const CRM_COLOR = '#7C2D12';
const CRM_BG = '#FED7AA';

// Dovoljeni uporabniki (komercialistka pride pozneje)
export const CRM_ALLOWED_EMAILS = [
  'ales.seidl@as-system.si',
  'claudia.seidl@as-system.si',
  'sara.jagodic@as-system.si',
  'hermina.leskovec@as-system.si',
  'alen.drofenik@as-system.si',
  'tjasa.mihevc@as-system.si',
  'zan.seidl@as-system.si',
];

// Komercialista, ki poleg svojih vidita tudi Herminine vnose
const CRM_TEAM_LEADS = ['alen.drofenik@as-system.si', 'tjasa.mihevc@as-system.si'];
const CRM_TEAM_MEMBER = 'hermina.leskovec@as-system.si';

export function canAccessCRM(email) {
  return CRM_ALLOWED_EMAILS.includes(email);
}

const SLOVENIAN_MONTHS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI');
}

function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5);
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('sl-SI');
}

// Izračun časa med dvema HH:MM v minutah
function diffMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatMinutes(min) {
  if (min === null || min === undefined || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

// 7-dnevni zaklep za nove vnose
function isLocked(entryDate, createdBy, currentUserEmail, isAdmin) {
  if (isAdmin) return false;
  if (createdBy !== currentUserEmail) return true;
  const d = new Date(entryDate);
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays > 7;
}

export default function CRMTab({ currentUser, isAdmin, employees }) {
  const [view, setView] = useState('entry'); // privzeto: takojšen vnos
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const isTeamLead = !isAdmin && CRM_TEAM_LEADS.includes(currentUser?.email);
  const [personFilter, setPersonFilter] = useState((isAdmin || isTeamLead) ? 'all' : (currentUser?.email || 'all'));

  // Zelena potrditev se sama skrije
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      let qy = supabase
        .from('crm_visits')
        .select('*')
        .order('visit_date', { ascending: false })
        .order('arrival_time', { ascending: true })
        .limit(2000);
      if (!isAdmin) {
        if (isTeamLead) {
          qy = qy.in('created_by', [currentUser?.email, CRM_TEAM_MEMBER]);
        } else {
          qy = qy.eq('created_by', currentUser?.email);
        }
      }
      const { data, error } = await qy;
      if (error) throw error;
      setVisits(data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // Skupna funkcija po shranjevanju: osveži + pokaži zeleno potrditev
  function handleSaved(msg) {
    loadAll();
    setFlash(msg || '✓ Shranjeno');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const scopedVisits = (personFilter === 'all') ? visits : visits.filter((v) => v.created_by === personFilter);

  return (
    <div>
      {/* Navigacija + filtri */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <div className="grid grid-cols-2 sm:flex gap-1.5 bg-as-gray-100 rounded-xl p-1.5 border border-as-gray-200">
          <SubTab active={view === 'entry'} onClick={() => setView('entry')} icon={<Plus className="w-4 h-4" />} label="Vnos" />
          <SubTab active={view === 'pipeline'} onClick={() => setView('pipeline')} icon={<Target className="w-4 h-4" />} label="Pipeline" />
          <SubTab active={view === 'daily'} onClick={() => setView('daily')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
          <SubTab active={view === 'monthly'} onClick={() => setView('monthly')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
          <SubTab active={view === 'reports'} onClick={() => setView('reports')} icon={<TrendingUp className="w-4 h-4" />} label="Poročila" />
          <SubTab active={view === 'analysis'} onClick={() => setView('analysis')} icon={<User className="w-4 h-4" />} label="Stranke" />
          <SubTab active={view === 'planning'} onClick={() => setView('planning')} icon={<span className="text-sm">🗓️</span>} label="Planiranje" />
        </div>
        {(isAdmin || isTeamLead) && (
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}
            className="px-3 py-2.5 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
            <option value="all">Vsi komercialisti</option>
            {(employees || [])
              .filter((e) => isAdmin ? canAccessCRM(e.email) : [currentUser?.email, CRM_TEAM_MEMBER].includes(e.email))
              .map((e) => (
              <option key={e.email} value={e.email}>{e.name}</option>
            ))}
          </select>
        )}
        <div id="crm-controls-slot" className="flex flex-wrap items-center gap-2 sm:ml-auto"></div>
      </div>

      {/* Zelena potrditev */}
      {flash && (
        <div className="flex items-center gap-2 p-3.5 mb-4 rounded-xl border shadow-sm animate-pulse"
          style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold flex-1">{flash}</span>
          <button onClick={() => setFlash('')} className="text-green-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {view === 'entry' && <EntryView currentUser={currentUser} employees={employees} onSaved={handleSaved} setError={setError} />}
      {view === 'pipeline' && <PipelineView currentUser={currentUser} isAdmin={isAdmin} employees={employees} />}
      {view === 'daily' && <DailyView visits={scopedVisits} isAdmin={isAdmin} currentUser={currentUser} onReload={loadAll} loading={loading} />}
      {view === 'monthly' && <MonthlyView visits={scopedVisits} loading={loading} />}
      {view === 'reports' && <ReportsView visits={scopedVisits} loading={loading} />}
      {view === 'analysis' && <StrankeView visits={scopedVisits} loading={loading} isAdmin={isAdmin} />}
      {view === 'planning' && <PlanningView currentUser={currentUser} isAdmin={isAdmin} employees={employees} />}
    </div>
  );
}

function SubTab({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 text-sm font-semibold rounded-lg transition ${
        active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'
      }`}
      style={active ? { backgroundColor: AS_RED } : {}}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── ENTRY VIEW ───
function EntryView({ currentUser, employees, onSaved, setError }) {
  const [entryType, setEntryType] = useState('visit'); // takoj pripravljen vnos stranke

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <SectionPill active={entryType === 'home_start'} onClick={() => setEntryType('home_start')}
          icon={<Home className="w-4 h-4" />} label="Začetek (doma)" color="#1E40AF" bgColor="#DBEAFE" />
        <SectionPill active={entryType === 'visit'} onClick={() => setEntryType('visit')}
          icon={<MapPin className="w-4 h-4" />} label="Obisk stranke" color={CRM_COLOR} bgColor={CRM_BG} />
        <SectionPill active={entryType === 'call'} onClick={() => setEntryType('call')}
          icon={<Phone className="w-4 h-4" />} label="Klic / Email" color="#6D28D9" bgColor="#EDE9FE" />
        <SectionPill active={entryType === 'malica'} onClick={() => setEntryType('malica')}
          icon={<span className="text-sm">🍴</span>} label="Malica" color="#B45309" bgColor="#FEF3C7" />
        <SectionPill active={entryType === 'private'} onClick={() => setEntryType('private')}
          icon={<span className="text-sm">🔒</span>} label="Zasebno" color="#475569" bgColor="#E2E8F0" />
        <SectionPill active={entryType === 'home_end'} onClick={() => setEntryType('home_end')}
          icon={<Home className="w-4 h-4" />} label="Konec (doma)" color="#065F46" bgColor="#A7F3D0" />
      </div>

      {entryType === 'home_start' && (
        <HomeStartForm currentUser={currentUser} onSaved={onSaved} setError={setError}
          onAfterSave={() => setEntryType('visit')} />
      )}
      {entryType === 'visit' && <VisitForm currentUser={currentUser} employees={employees} onSaved={onSaved} setError={setError} />}
      {entryType === 'call' && <CallForm currentUser={currentUser} employees={employees} onSaved={onSaved} setError={setError} />}
      {entryType === 'malica' && <BreakForm kind="malica" currentUser={currentUser} onSaved={onSaved} setError={setError} />}
      {entryType === 'private' && <BreakForm kind="private" currentUser={currentUser} onSaved={onSaved} setError={setError} />}
      {entryType === 'home_end' && <HomeEndForm currentUser={currentUser} onSaved={onSaved} setError={setError} />}
    </div>
  );
}

function SectionPill({ active, onClick, icon, label, color, bgColor }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition"
      style={{
        borderColor: active ? color : '#E5E7EB',
        background: active ? bgColor : '#fff',
        color: active ? color : '#6B7280',
      }}
    >
      {icon} <span className="truncate">{label}</span>
    </button>
  );
}

// ─── HOME START FORM ───
function HomeStartForm({ currentUser, onSaved, setError, onAfterSave }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!km) { setError('Vnesi km stanje.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'home_start',
        departure_time: time,
        odometer_km: parseInt(km),
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setKm('');
      onSaved('✓ Začetek dneva shranjen — zdaj vnesi prvo stranko 👇');
      if (onAfterSave) onAfterSave();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#DBEAFE', color: '#1E40AF' }}>🏠</span>
        Začetek dneva (zjutraj doma)
      </h3>
      <p className="text-xs text-as-gray-500 italic">💡 Vnesi km stanje, preden zapustiš dom. Po shranjevanju te program preusmeri na vnos stranke.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas odhoda *">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45230" />
        </FormField>
      </div>

      <SubmitBtn loading={loading} color="#1E40AF" label="Shrani začetek dneva" />
    </form>
  );
}

// ─── MALICA / ZASEBNO ───
function BreakForm({ kind, currentUser, onSaved, setError }) {
  const isPrivate = kind === 'private';
  const cfg = isPrivate
    ? { emoji: '🔒', title: 'Zasebno (privatni čas)', color: '#475569', bg: '#E2E8F0', hint: 'Označi zasebni čas (npr. osebna opravila). Drugi vidijo le »Zasebno«, brez podrobnosti.' }
    : { emoji: '🍴', title: 'Malica', color: '#B45309', bg: '#FEF3C7', hint: 'Vnesi čas malice (od–do).' };
  const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [od, setOd] = useState(now);
  const [doCas, setDoCas] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!od) { setError('Vnesi čas (od).'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: kind,
        arrival_time: od,
        departure_time: doCas || null,
        notes: note.trim() || null,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setNote(''); setDoCas('');
      onSaved(isPrivate ? '✓ Zasebni čas shranjen' : '✓ Malica shranjena');
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg, color: cfg.color }}>{cfg.emoji}</span>
        {cfg.title}
      </h3>
      <p className="text-xs text-as-gray-500 italic">💡 {cfg.hint}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Od *">
          <input type="time" value={od} onChange={(e) => setOd(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Do">
          <input type="time" value={doCas} onChange={(e) => setDoCas(e.target.value)} className={inputCls} />
        </FormField>
      </div>
      <FormField label={isPrivate ? 'Opomba (vidi le zate/admin)' : 'Opomba (neobvezno)'}>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder={isPrivate ? 'npr. zdravnik' : 'npr. malica'} />
      </FormField>
      <SubmitBtn loading={loading} color={cfg.color} label={isPrivate ? 'Shrani zasebni čas' : 'Shrani malico'} />
    </form>
  );
}

// ─── VISIT FORM ───
function VisitForm({ currentUser, employees, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customer, setCustomer] = useState(null);
  const [outcome, setOutcome] = useState('nic');
  const [arrivalTime, setArrivalTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [departureTime, setDepartureTime] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [createOffer, setCreateOffer] = useState(false);
  const [offerDescription, setOfferDescription] = useState('');
  const [offerAssignedTo, setOfferAssignedTo] = useState('');
  const [offerDueDate, setOfferDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [notify, setNotify] = useState(false);
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // ŽIV IZRAČUN ČASA pri stranki
  const liveDuration = diffMinutes(arrivalTime, departureTime);

  function reset() {
    setNotify(false);
    setResponsibleEmail('');
    setCustomer(null);
    setOutcome('nic');
    setCustomerName('');
    setCustomerAddress('');
    setArrivalTime(() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    setDepartureTime('');
    setKm('');
    setNotes('');
    setCreateOffer(false);
    setOfferDescription('');
    setOfferAssignedTo('');
    setOfferDueDate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim()) { setError('Vnesi ime stranke.'); return; }
    if (!arrivalTime) { setError('Vnesi čas prihoda.'); return; }
    if (!km) { setError('Vnesi km stanje.'); return; }
    if (createOffer) {
      if (!offerDescription.trim()) { setError('Vnesi opis ponudbe.'); return; }
      if (!offerAssignedTo) { setError('Izberi komu dodeliš pripravo ponudbe.'); return; }
    }
    if (notify && !responsibleEmail) { setError('Izberi odgovorno osebo za obvestilo.'); return; }

    setLoading(true); setError('');
    try {
      let offerTaskId = null;

      // Najprej kreiraj nalogo, če je ponudba
      if (createOffer) {
        const assignedEmp = employees.find((emp) => emp.email === offerAssignedTo);
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            title: `Pripravi ponudbo: ${customerName}`,
            description: `Iz obiska ${formatDate(date)}.\n\nOpis ponudbe:\n${offerDescription}\n\nDogovor s stranko:\n${notes || '—'}`,
            assigned_to_emails: [offerAssignedTo],
            responsible_email: offerAssignedTo,
            responsible_name: assignedEmp?.name || null,
            department: assignedEmp?.department || 'Komerciala',
            company: customerName,
            area: 'Ponudba',
            priority: 'medium',
            due_date: new Date(offerDueDate).toISOString(),
            status: 'pending',
            recurring_type: 'none',
            created_by_email: currentUser?.email,
            created_by_name: currentUser?.name,
          }])
          .select()
          .single();
        if (taskError) throw taskError;
        offerTaskId = taskData.id;
      }

      // Obvesti odgovorno osebo (email + Outlook), če je označeno
      let outlookEventId = null;
      const respEmp = employees.find((e) => e.email === responsibleEmail);
      if (notify && responsibleEmail) {
        outlookEventId = await crmNotifyResponsible({
          kind: 'visit',
          customerName,
          dateTimeISO: new Date(`${date}T${arrivalTime || '09:00'}:00`).toISOString(),
          descLines: [
            customerAddress ? `Lokacija: ${customerAddress}` : '',
            notes ? `Dogovor: ${notes}` : '',
            createOffer ? `Ponudba: ${offerDescription} (rok ${formatDate(offerDueDate)})` : '',
            `Vneseno iz CRM (${currentUser?.name || ''}).`,
          ],
          responsibleEmail,
          responsibleName: respEmp?.name || responsibleEmail,
          createdByName: currentUser?.name,
          employees,
        });
      }

      // Potem shrani obisk (čas pri stranki se izračuna samodejno)
      const computedMin = (liveDuration != null && liveDuration >= 0) ? liveDuration : null;
      const { error: visitError } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'visit',
        customer_name: customerName.trim(),
        customer_address: customerAddress.trim() || null,
        arrival_time: arrivalTime,
        departure_time: departureTime || null,
        odometer_km: parseInt(km),
        customer_id: customer?.id || null,
        outcome,
        visit_duration_min: computedMin,
        notes: notes || null,
        create_offer: createOffer,
        offer_description: createOffer ? offerDescription : null,
        offer_assigned_to_email: createOffer ? offerAssignedTo : null,
        offer_due_date: createOffer ? offerDueDate : null,
        offer_task_id: offerTaskId,
        notify_responsible: notify,
        responsible_email: notify ? responsibleEmail : null,
        responsible_name: notify ? (respEmp?.name || null) : null,
        add_to_calendar: notify,
        outlook_event_id: outlookEventId,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (visitError) throw visitError;

      const savedName = customerName.trim();
      reset();
      onSaved(`✓ Obisk shranjen: ${savedName}${createOffer ? ' + naloga za ponudbo' : ''}. Vnesi naslednjo stranko 👇`);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: CRM_BG, color: CRM_COLOR }}>📍</span>
        Nov obisk stranke
      </h3>

      {/* STRANKA — najprej, ker je najpomembnejše */}
      <FormField label="Stranka *">
        <CustomerPicker
          selected={customer}
          onSelect={(c) => { setCustomer(c); setCustomerName(c.naziv); setCustomerAddress([c.ulica, c.posta].filter(Boolean).join(', ')); }}
          onClear={() => { setCustomer(null); setCustomerName(''); setCustomerAddress(''); }}
        />
      </FormField>

      {/* ČASI + ŽIV IZRAČUN */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Čas prihoda *">
          <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas odhoda">
          <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className={inputCls} />
        </FormField>
      </div>

      {/* Živ prikaz trajanja */}
      {departureTime && (
        liveDuration != null && liveDuration >= 0 ? (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold" style={{ background: '#CFFAFE', color: '#0E7490' }}>
            <Clock className="w-5 h-5" /> Čas pri stranki: {formatMinutes(liveDuration)}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            <AlertCircle className="w-5 h-5" /> Čas odhoda je pred prihodom — preveri ure.
          </div>
        )
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec ob prihodu *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45255" />
        </FormField>
      </div>

      <FormField label="Izid obiska *">
        <OutcomePicker value={outcome} onChange={setOutcome} />
      </FormField>

      <FormField label="Dogovori / kaj se je dogovorilo">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls + ' resize-none'}
          placeholder="O čem ste se pogovarjali, kaj je bilo dogovorjeno, naslednji koraki..." />
      </FormField>

      {/* PONUDBA */}
      <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: createOffer ? '#FEF3C7' : '#fafafa' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createOffer}
            onChange={(e) => setCreateOffer(e.target.checked)}
            className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0"
            style={{ accentColor: CRM_COLOR }}
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              Naredi ponudbo za to stranko
            </div>
            <p className="text-xs text-as-gray-500 mt-0.5">
              Avtomatsko ustvari nalogo "Pripravi ponudbo" za izbrano osebo.
            </p>
          </div>
        </label>

        {createOffer && (
          <div className="space-y-3 pt-2 border-t border-as-gray-200">
            <FormField label="Opis ponudbe *">
              <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'}
                placeholder="Kaj naj se ponudi? Količine, izdelki, posebnosti..." />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Komu dodeli pripravo *">
                <select value={offerAssignedTo} onChange={(e) => setOfferAssignedTo(e.target.value)} required className={inputCls}>
                  <option value="">-- izberi osebo --</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rok za ponudbo *">
                <input type="date" value={offerDueDate} onChange={(e) => setOfferDueDate(e.target.value)} required className={inputCls} />
              </FormField>
            </div>
          </div>
        )}
      </div>

      <NotifyBlock notify={notify} setNotify={setNotify} responsibleEmail={responsibleEmail} setResponsibleEmail={setResponsibleEmail} employees={employees} />

      <SubmitBtn loading={loading} color={CRM_COLOR} label={`Shrani obisk${createOffer ? ' + kreiraj nalogo' : ''}`} />
    </form>
  );
}

// ─── HOME END FORM ───
function HomeEndForm({ currentUser, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!km) { setError('Vnesi km stanje.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'home_end',
        arrival_time: time,
        odometer_km: parseInt(km),
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setKm('');
      onSaved('✓ Konec dneva shranjen. Lep dan!');
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#A7F3D0', color: '#065F46' }}>🏠</span>
        Konec dneva (zvečer doma)
      </h3>
      <p className="text-xs text-as-gray-500 italic">💡 Vnesi km stanje, ko prideš domov.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas prihoda *">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Km števec *">
          <input type="number" inputMode="numeric" min="0" value={km} onChange={(e) => setKm(e.target.value)} required className={inputCls} placeholder="npr. 45310" />
        </FormField>
      </div>

      <SubmitBtn loading={loading} color="#065F46" label="Shrani konec dneva" />
    </form>
  );
}

// ─── NOTIFY BLOCK (obvestilo odgovorni osebi: email + Outlook) ───
function NotifyBlock({ notify, setNotify, responsibleEmail, setResponsibleEmail, employees }) {
  return (
    <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: notify ? '#EFF6FF' : '#fafafa' }}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
          className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0" style={{ accentColor: '#1E40AF' }} />
        <div className="flex-1">
          <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
            <Mail className="w-4 h-4" /> Obvesti odgovorno osebo (email + Outlook)
          </div>
          <p className="text-xs text-as-gray-500 mt-0.5">
            Izbrani osebi pride email iz naloge@as-system.si in dogodek v Outlook koledar.
          </p>
        </div>
      </label>
      {notify && (
        <div className="pt-2 border-t border-as-gray-200">
          <FormField label="Odgovorna oseba *">
            <select value={responsibleEmail} onChange={(e) => setResponsibleEmail(e.target.value)} required className={inputCls}>
              <option value="">-- izberi osebo --</option>
              {(employees || []).map((emp) => (
                <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
              ))}
            </select>
          </FormField>
        </div>
      )}
    </div>
  );
}

// ─── CALL / EMAIL FORM ───
function CallForm({ currentUser, employees, onSaved, setError }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [customerName, setCustomerName] = useState('');
  const [channel, setChannel] = useState('phone');
  const [customer, setCustomer] = useState(null);
  const [outcome, setOutcome] = useState('nic');
  const [durationMin, setDurationMin] = useState('');
  const [notes, setNotes] = useState('');
  const [createOffer, setCreateOffer] = useState(false);
  const [offerDescription, setOfferDescription] = useState('');
  const [offerAssignedTo, setOfferAssignedTo] = useState('');
  const [offerDueDate, setOfferDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  });
  const [notify, setNotify] = useState(false);
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setCustomer(null); setOutcome('nic');
    setCustomerName(''); setChannel('phone'); setDurationMin(''); setNotes('');
    setCreateOffer(false); setOfferDescription(''); setOfferAssignedTo('');
    setOfferDueDate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); });
    setNotify(false); setResponsibleEmail('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim()) { setError('Vnesi ime stranke.'); return; }
    if (createOffer) {
      if (!offerDescription.trim()) { setError('Vnesi opis ponudbe.'); return; }
      if (!offerAssignedTo) { setError('Izberi komu dodeliš pripravo ponudbe.'); return; }
    }
    if (notify && !responsibleEmail) { setError('Izberi odgovorno osebo za obvestilo.'); return; }

    setLoading(true); setError('');
    try {
      let offerTaskId = null;
      if (createOffer) {
        const assignedEmp = employees.find((emp) => emp.email === offerAssignedTo);
        const kanalTxt = channel === 'email' ? 'email-a' : 'klica';
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            title: `Pripravi ponudbo: ${customerName}`,
            description: `Iz ${kanalTxt} ${formatDate(date)}.\n\nOpis ponudbe:\n${offerDescription}\n\nDogovor:\n${notes || '—'}`,
            assigned_to_emails: [offerAssignedTo],
            responsible_email: offerAssignedTo,
            responsible_name: assignedEmp?.name || null,
            department: assignedEmp?.department || 'Komerciala',
            company: customerName,
            area: 'Ponudba',
            priority: 'medium',
            due_date: new Date(offerDueDate).toISOString(),
            status: 'pending',
            recurring_type: 'none',
            created_by_email: currentUser?.email,
            created_by_name: currentUser?.name,
          }])
          .select()
          .single();
        if (taskError) throw taskError;
        offerTaskId = taskData.id;
      }

      let outlookEventId = null;
      const respEmp = employees.find((e) => e.email === responsibleEmail);
      if (notify && responsibleEmail) {
        outlookEventId = await crmNotifyResponsible({
          kind: 'call',
          customerName,
          dateTimeISO: new Date(`${date}T${time || '09:00'}:00`).toISOString(),
          descLines: [
            `Kanal: ${channel === 'email' ? 'Email' : 'Telefonski klic'}`,
            (channel === 'phone' && durationMin) ? `Trajanje: ${durationMin} min` : '',
            notes ? `Dogovor: ${notes}` : '',
            createOffer ? `Ponudba: ${offerDescription} (rok ${formatDate(offerDueDate)})` : '',
            `Vneseno iz CRM (${currentUser?.name || ''}).`,
          ],
          responsibleEmail,
          responsibleName: respEmp?.name || responsibleEmail,
          createdByName: currentUser?.name,
          employees,
        });
      }

      const { error: callError } = await supabase.from('crm_visits').insert([{
        visit_date: date,
        entry_type: 'call',
        customer_name: customerName.trim(),
        arrival_time: time || null,
        channel,
        call_duration_min: channel === 'phone' && durationMin ? parseInt(durationMin) : null,
        customer_id: customer?.id || null,
        outcome,
        visit_duration_min: channel === 'phone' && durationMin ? parseInt(durationMin) : null,
        notes: notes || null,
        create_offer: createOffer,
        offer_description: createOffer ? offerDescription : null,
        offer_assigned_to_email: createOffer ? offerAssignedTo : null,
        offer_due_date: createOffer ? offerDueDate : null,
        offer_task_id: offerTaskId,
        notify_responsible: notify,
        responsible_email: notify ? responsibleEmail : null,
        responsible_name: notify ? (respEmp?.name || null) : null,
        add_to_calendar: notify,
        outlook_event_id: outlookEventId,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (callError) throw callError;

      const savedName = customerName.trim();
      const kanal = channel === 'email' ? 'Email' : 'Klic';
      reset();
      onSaved(`✓ ${kanal} shranjen: ${savedName}${createOffer ? ' + naloga za ponudbo' : ''}.`);
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-bold text-as-gray-700 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#EDE9FE', color: '#6D28D9' }}>📞</span>
        Klic / Email stranke
      </h3>

      <FormField label="Stranka *">
        <CustomerPicker
          selected={customer}
          onSelect={(c) => { setCustomer(c); setCustomerName(c.naziv); }}
          onClear={() => { setCustomer(null); setCustomerName(''); }}
        />
      </FormField>

      <FormField label="Vrsta stika *">
        <div className="flex gap-2">
          <button type="button" onClick={() => setChannel('phone')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: channel === 'phone' ? '#6D28D9' : '#E5E7EB', background: channel === 'phone' ? '#EDE9FE' : '#fff', color: channel === 'phone' ? '#6D28D9' : '#6B7280' }}>
            <Phone className="w-4 h-4" /> Klic
          </button>
          <button type="button" onClick={() => setChannel('email')}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: channel === 'email' ? '#6D28D9' : '#E5E7EB', background: channel === 'email' ? '#EDE9FE' : '#fff', color: channel === 'email' ? '#6D28D9' : '#6B7280' }}>
            <Mail className="w-4 h-4" /> Email
          </button>
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Datum *">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </FormField>
        <FormField label="Čas">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </FormField>
      </div>

      {channel === 'phone' && (
        <FormField label="Trajanje klica (min)">
          <input type="number" inputMode="numeric" min="0" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={inputCls} placeholder="npr. 15" />
        </FormField>
      )}

      <FormField label="Izid *">
        <OutcomePicker value={outcome} onChange={setOutcome} />
      </FormField>

      <FormField label="Dogovori / kaj se je dogovorilo">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls + ' resize-none'}
          placeholder="O čem ste se pogovarjali, kaj je bilo dogovorjeno, naslednji koraki..." />
      </FormField>

      {/* PONUDBA */}
      <div className="border-2 border-dashed border-as-gray-200 rounded-xl p-4 space-y-3" style={{ background: createOffer ? '#FEF3C7' : '#fafafa' }}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={createOffer} onChange={(e) => setCreateOffer(e.target.checked)}
            className="w-6 h-6 rounded border-as-gray-300 cursor-pointer flex-shrink-0" style={{ accentColor: CRM_COLOR }} />
          <div className="flex-1">
            <div className="text-sm font-bold text-as-gray-700 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> Naredi ponudbo za to stranko
            </div>
            <p className="text-xs text-as-gray-500 mt-0.5">Avtomatsko ustvari nalogo "Pripravi ponudbo" za izbrano osebo.</p>
          </div>
        </label>
        {createOffer && (
          <div className="space-y-3 pt-2 border-t border-as-gray-200">
            <FormField label="Opis ponudbe *">
              <textarea value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'}
                placeholder="Kaj naj se ponudi? Količine, izdelki, posebnosti..." />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Komu dodeli pripravo *">
                <select value={offerAssignedTo} onChange={(e) => setOfferAssignedTo(e.target.value)} required className={inputCls}>
                  <option value="">-- izberi osebo --</option>
                  {(employees || []).map((emp) => (
                    <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Rok za ponudbo *">
                <input type="date" value={offerDueDate} onChange={(e) => setOfferDueDate(e.target.value)} required className={inputCls} />
              </FormField>
            </div>
          </div>
        )}
      </div>

      <NotifyBlock notify={notify} setNotify={setNotify} responsibleEmail={responsibleEmail} setResponsibleEmail={setResponsibleEmail} employees={employees} />

      <SubmitBtn loading={loading} color="#6D28D9" label={`Shrani ${channel === 'email' ? 'email' : 'klic'}${createOffer ? ' + kreiraj nalogo' : ''}`} />
    </form>
  );
}

// ─── DAILY VIEW ───
function DailyView({ visits, isAdmin, currentUser, onReload, loading }) {
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterUser, setFilterUser] = useState('all');
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('crm-controls-slot'));
  }, []);

  // Vsi vnosi tega dne, filtrirani po uporabniku
  const dayVisits = visits
    .filter((v) => v.visit_date === filterDate)
    .filter((v) => filterUser === 'all' || v.created_by === filterUser)
    .sort((a, b) => {
      // Razvrsti: home_start prvi, potem obiski po času prihoda, home_end zadnji
      const order = { home_start: 0, visit: 1, home_end: 2 };
      const ao = order[a.entry_type] ?? 1;
      const bo = order[b.entry_type] ?? 1;
      if (ao !== bo) return ao - bo;
      const at = a.arrival_time || a.departure_time || '00:00';
      const bt = b.arrival_time || b.departure_time || '00:00';
      return at.localeCompare(bt);
    });

  // Unikatni uporabniki za filter
  const uniqueUsers = useMemo(() => {
    const map = {};
    visits.forEach((v) => {
      if (v.created_by) map[v.created_by] = v.created_by_name || v.created_by;
    });
    return Object.entries(map).map(([email, name]) => ({ email, name }));
  }, [visits]);

  // Izračun kilometrine — zaporedne razlike
  const kmData = useMemo(() => {
    const withKm = dayVisits.filter((v) => v.odometer_km != null);
    if (withKm.length < 2) return { segments: [], totalKm: 0 };
    const segments = [];
    for (let i = 1; i < withKm.length; i++) {
      const from = withKm[i - 1];
      const to = withKm[i];
      const km = to.odometer_km - from.odometer_km;
      segments.push({ from, to, km });
    }
    const totalKm = segments.reduce((s, x) => s + (x.km > 0 ? x.km : 0), 0);
    return { segments, totalKm };
  }, [dayVisits]);

  // Statistike
  const visitCount = dayVisits.filter((v) => v.entry_type === 'visit').length;
  const callCount = dayVisits.filter((v) => v.entry_type === 'call').length;
  const offerCount = dayVisits.filter((v) => (v.entry_type === 'visit' || v.entry_type === 'call') && v.create_offer).length;
  const orderCount = dayVisits.filter((v) => v.outcome === 'narocilo').length;
  const totalTimeAtCustomers = dayVisits
    .filter((v) => v.entry_type === 'visit' && v.arrival_time && v.departure_time)
    .reduce((s, v) => s + (diffMinutes(v.arrival_time, v.departure_time) || 0), 0);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm" />
      </div>
      {isAdmin && uniqueUsers.length > 1 && (
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          <option value="all">Vsi komercialisti</option>
          {uniqueUsers.map((u) => <option key={u.email} value={u.email}>{u.name}</option>)}
        </select>
      )}
      <button
        onClick={() => exportDailyCSV(filterDate, dayVisits, kmData)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> CSV
      </button>
    </>
  );

  async function handleDelete(visit) {
    if (!confirm('Izbrišem ta vnos?')) return;
    // Če je obisk z ustvarjeno nalogo, vprašaj
    if (visit.offer_task_id) {
      if (!confirm('Ta obisk je ustvaril nalogo. Naj se naloga ohrani? (klik OK ohrani, Prekliči izbriše tudi nalogo)')) {
        await supabase.from('tasks').delete().eq('id', visit.offer_task_id);
      }
    }
    await supabase.from('crm_visits').delete().eq('id', visit.id);
    onReload();
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-1">📅 {formatLongDate(filterDate)}</h3>
            <p className="text-xs text-as-gray-500">Vnosov: {dayVisits.length}</p>
          </div>

          {/* Statistike */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <BigStat icon="📍" label="Obiski" value={visitCount} unit="" color={CRM_COLOR} bgColor={CRM_BG} />
            <BigStat icon="📞" label="Klici / emaili" value={callCount} unit="" color="#6D28D9" bgColor="#EDE9FE" />
            <BigStat icon="🚗" label="Skupaj km" value={formatNumber(kmData.totalKm)} unit="km" color="#1E40AF" bgColor="#DBEAFE" />
            <BigStat icon="⏱️" label="Čas pri strankah" value={formatMinutes(totalTimeAtCustomers)} unit="" color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="📝" label="Ponudbe" value={offerCount} unit="" color="#854D0E" bgColor="#FEF3C7" />
            <BigStat icon="✅" label="Naročila" value={orderCount} unit="" color="#16A34A" bgColor="#DCFCE7" />
          </div>

          {/* Časovnica dneva */}
          {dayVisits.length === 0 ? (
            <div className="bg-white border border-as-gray-200 rounded-2xl p-12 text-center">
              <p className="text-as-gray-500">Ni vnosov za ta dan.</p>
            </div>
          ) : (
            <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-as-gray-700 mb-4">🕐 Časovnica dneva</h3>
              <div className="space-y-3">
                {dayVisits.map((v, idx) => {
                  // Razdalja od prejšnjega vnosa
                  const prevWithKm = dayVisits.slice(0, idx).reverse().find((x) => x.odometer_km != null);
                  const segmentKm = (v.odometer_km != null && prevWithKm) ? v.odometer_km - prevWithKm.odometer_km : null;

                  return (
                    <div key={v.id}>
                      {segmentKm != null && segmentKm > 0 && (
                        <div className="ml-12 my-1 flex items-center gap-2 text-xs text-as-gray-500">
                          <Car className="w-3 h-3" />
                          <span className="italic">{segmentKm} km vožnje</span>
                        </div>
                      )}
                      <VisitTimelineCard
                        visit={v}
                        isAdmin={isAdmin}
                        currentUser={currentUser}
                        onDelete={() => handleDelete(v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VisitTimelineCard({ visit, isAdmin, currentUser, onDelete }) {
  const [open, setOpen] = useState(false);
  const canDelete = isAdmin || (visit.created_by === currentUser?.email && !isLocked(visit.visit_date, visit.created_by, currentUser?.email, isAdmin));

  let icon, color, bg, label, timeStr;
  if (visit.entry_type === 'home_start') {
    icon = '🏠';
    color = '#1E40AF';
    bg = '#DBEAFE';
    label = `Začetek dneva doma`;
    timeStr = formatTime(visit.departure_time);
  } else if (visit.entry_type === 'home_end') {
    icon = '🏠';
    color = '#065F46';
    bg = '#A7F3D0';
    label = `Konec dneva doma`;
    timeStr = formatTime(visit.arrival_time);
  } else if (visit.entry_type === 'call') {
    icon = visit.channel === 'email' ? '✉️' : '📞';
    color = '#6D28D9';
    bg = '#EDE9FE';
    label = visit.customer_name || '(brez imena)';
    timeStr = formatTime(visit.arrival_time);
  } else if (visit.entry_type === 'malica') {
    icon = '🍴';
    color = '#B45309';
    bg = '#FEF3C7';
    label = 'Malica';
    timeStr = `${formatTime(visit.arrival_time)}${visit.departure_time ? ' – ' + formatTime(visit.departure_time) : ''}`;
  } else if (visit.entry_type === 'private') {
    icon = '🔒';
    color = '#475569';
    bg = '#E2E8F0';
    const mine = isAdmin || visit.created_by === currentUser?.email;
    label = mine && visit.notes ? `Zasebno — ${visit.notes}` : 'Zasebno';
    timeStr = `${formatTime(visit.arrival_time)}${visit.departure_time ? ' – ' + formatTime(visit.departure_time) : ''}`;
  } else {
    icon = '📍';
    color = CRM_COLOR;
    bg = CRM_BG;
    label = visit.customer_name || '(brez imena)';
    timeStr = `${formatTime(visit.arrival_time)}${visit.departure_time ? ' – ' + formatTime(visit.departure_time) : ''}`;
  }

  const duration = visit.entry_type === 'visit' && visit.arrival_time && visit.departure_time
    ? diffMinutes(visit.arrival_time, visit.departure_time)
    : null;
  const privateHidden = visit.entry_type === 'private' && !(isAdmin || visit.created_by === currentUser?.email);

  return (
    <div className="border border-as-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3" style={{ background: bg + '40' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg" style={{ background: bg, color }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-as-gray-700">{label}</div>
          <div className="text-xs text-as-gray-500 flex items-center gap-3 flex-wrap mt-0.5">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeStr}</span>
            {visit.odometer_km != null && <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {formatNumber(visit.odometer_km)} km</span>}
            {duration != null && duration >= 0 && <span className="font-semibold" style={{ color: '#0E7490' }}>{formatMinutes(duration)} pri stranki</span>}
            {visit.entry_type === 'call' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
                {visit.channel === 'email' ? '✉️ Email' : '📞 Klic'}{visit.channel === 'phone' && visit.call_duration_min != null ? ` · ${formatMinutes(visit.call_duration_min)}` : ''}
              </span>
            )}
            {visit.outcome === 'narocilo' && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DCFCE7', color: '#16A34A' }}>✓ Naročilo</span>}
            {visit.outcome === 'ponudba' && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF3C7', color: '#D97706' }}>Ponudba</span>}
            {visit.create_offer && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF3C7', color: '#854D0E' }}>
                📝 Naloga
              </span>
            )}
            {visit.notify_responsible && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                📧 {visit.responsible_name || visit.responsible_email}
              </span>
            )}
          </div>
        </div>
        {(!privateHidden && (visit.notes || visit.customer_address || visit.offer_description)) && (
          <button onClick={() => setOpen((o) => !o)} className="p-2 hover:bg-white rounded transition text-as-gray-400">
            {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} className="p-2 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      {open && (
        <div className="p-4 border-t border-as-gray-100 space-y-3 text-sm">
          {visit.customer_address && (
            <div>
              <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Naslov</div>
              <div className="text-as-gray-700">{visit.customer_address}</div>
            </div>
          )}
          {visit.notes && (
            <div>
              <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Dogovori</div>
              <div className="text-as-gray-700 whitespace-pre-wrap">{visit.notes}</div>
            </div>
          )}
          {visit.create_offer && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">📝 Ponudba</div>
              <div className="text-sm text-as-gray-700 whitespace-pre-wrap">{visit.offer_description}</div>
              <div className="text-xs text-as-gray-500 mt-2">
                Dodeljeno: <strong>{visit.offer_assigned_to_email}</strong> · Rok: <strong>{formatDate(visit.offer_due_date)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MONTHLY VIEW ───
function MonthlyView({ visits, loading }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [slotEl, setSlotEl] = useState(null);

  useEffect(() => {
    setSlotEl(document.getElementById('crm-controls-slot'));
  }, []);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthVisits = visits.filter((v) => v.visit_date?.startsWith(monthStr));

  // Skupaj statistike
  const totalVisits = monthVisits.filter((v) => v.entry_type === 'visit').length;
  const totalCalls = monthVisits.filter((v) => v.entry_type === 'call').length;
  const totalOffers = monthVisits.filter((v) => (v.entry_type === 'visit' || v.entry_type === 'call') && v.create_offer).length;
  const totalOrders = monthVisits.filter((v) => v.outcome === 'narocilo').length;
  const uniqueDays = new Set(monthVisits.map((v) => v.visit_date)).size;
  const uniqueCustomers = new Set(monthVisits.filter((v) => v.entry_type === 'visit' || v.entry_type === 'call').map((v) => v.customer_name)).size;

  // Skupna kilometrina (po dnevih)
  const totalKm = useMemo(() => {
    const byDay = {};
    monthVisits.forEach((v) => {
      if (!byDay[v.visit_date]) byDay[v.visit_date] = [];
      byDay[v.visit_date].push(v);
    });
    let sum = 0;
    Object.values(byDay).forEach((dayVisits) => {
      const sorted = [...dayVisits].sort((a, b) => {
        const order = { home_start: 0, visit: 1, home_end: 2 };
        const ao = order[a.entry_type] ?? 1;
        const bo = order[b.entry_type] ?? 1;
        if (ao !== bo) return ao - bo;
        return (a.arrival_time || a.departure_time || '00:00').localeCompare(b.arrival_time || b.departure_time || '00:00');
      });
      const withKm = sorted.filter((v) => v.odometer_km != null);
      if (withKm.length >= 2) {
        const dayKm = withKm[withKm.length - 1].odometer_km - withKm[0].odometer_km;
        if (dayKm > 0) sum += dayKm;
      }
    });
    return sum;
  }, [monthVisits]);

  // Top stranke
  const topCustomers = useMemo(() => {
    const map = {};
    monthVisits.filter((v) => v.entry_type === 'visit' && v.customer_name).forEach((v) => {
      const key = v.customer_name.trim();
      if (!map[key]) map[key] = { name: key, count: 0, offers: 0 };
      map[key].count += 1;
      if (v.create_offer) map[key].offers += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [monthVisits]);

  // Po dnevih
  const byDay = useMemo(() => {
    const map = {};
    monthVisits.forEach((v) => {
      if (!map[v.visit_date]) map[v.visit_date] = { date: v.visit_date, visits: 0, offers: 0, kmStart: null, kmEnd: null };
      if (v.entry_type === 'visit') {
        map[v.visit_date].visits += 1;
        if (v.create_offer) map[v.visit_date].offers += 1;
      }
      if (v.odometer_km != null) {
        if (map[v.visit_date].kmStart == null || v.odometer_km < map[v.visit_date].kmStart) {
          map[v.visit_date].kmStart = v.odometer_km;
        }
        if (map[v.visit_date].kmEnd == null || v.odometer_km > map[v.visit_date].kmEnd) {
          map[v.visit_date].kmEnd = v.odometer_km;
        }
      }
    });
    return Object.values(map).map((d) => ({
      ...d,
      km: (d.kmStart != null && d.kmEnd != null) ? d.kmEnd - d.kmStart : null,
    })).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthVisits]);

  const controls = (
    <>
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-as-gray-400" />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm">
          {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button
        onClick={() => exportMonthlyCSV(year, month, byDay, topCustomers)}
        className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
      >
        <Download className="w-4 h-4" /> CSV
      </button>
    </>
  );

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {slotEl && createPortal(controls, slotEl)}

      {loading ? (
        <LoadingBox />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <BigStat icon="📍" label="Obiski" value={totalVisits} unit="" color={CRM_COLOR} bgColor={CRM_BG} />
            <BigStat icon="📞" label="Klici / emaili" value={totalCalls} unit="" color="#6D28D9" bgColor="#EDE9FE" />
            <BigStat icon="🚗" label="Skupaj km" value={formatNumber(totalKm)} unit="km" color="#1E40AF" bgColor="#DBEAFE" />
            <BigStat icon="📝" label="Ponudbe" value={totalOffers} unit="" color="#854D0E" bgColor="#FEF3C7" />
            <BigStat icon="✅" label="Naročila" value={totalOrders} unit="" color="#16A34A" bgColor="#DCFCE7" />
            <BigStat icon="🏢" label="Strank" value={uniqueCustomers} unit="" color="#065F46" bgColor="#A7F3D0" />
            <BigStat icon="📅" label="Aktivnih dni" value={uniqueDays} unit="" color="#0E7490" bgColor="#CFFAFE" />
          </div>

          {/* Top stranke */}
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">🏆 Top stranke — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {topCustomers.length === 0 ? <Empty /> : (
              <div className="space-y-2">
                {topCustomers.map((c) => {
                  const max = Math.max(...topCustomers.map((x) => x.count), 1);
                  const pct = (c.count / max) * 100;
                  return (
                    <div key={c.name} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-4 text-as-gray-700 truncate" title={c.name}>{c.name}</div>
                      <div className="col-span-6 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: CRM_COLOR }} />
                      </div>
                      <div className="col-span-2 text-right font-semibold text-as-gray-700">
                        {c.count}× {c.offers > 0 && <span className="text-xs text-amber-600">({c.offers} pon.)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Po dnevih */}
          <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">📅 Po dnevih</h3>
            {byDay.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left p-2">Datum</th>
                      <th className="text-right p-2">Obiskov</th>
                      <th className="text-right p-2">Ponudb</th>
                      <th className="text-right p-2">Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map((d) => (
                      <tr key={d.date} className="border-t border-as-gray-100 hover:bg-as-gray-50">
                        <td className="p-2 font-semibold">{formatDate(d.date)}</td>
                        <td className="p-2 text-right">{d.visits}</td>
                        <td className="p-2 text-right">{d.offers > 0 ? <strong>{d.offers}</strong> : '—'}</td>
                        <td className="p-2 text-right">{d.km != null ? formatNumber(d.km) + ' km' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BUILDING BLOCKS ───
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider leading-tight">{label}</div>
      </div>
      <div>
        <span className="text-2xl sm:text-3xl font-bold text-as-gray-700">{value}</span>
        {unit && <span className="text-sm text-as-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SubmitBtn({ loading, color, label }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full sm:w-auto justify-center px-6 py-3.5 text-white text-base font-semibold rounded-xl shadow-sm inline-flex items-center gap-2 transition disabled:opacity-50 active:scale-[0.99]"
      style={{ background: color }}>
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
      {label}
    </button>
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

const inputCls = "w-full px-3 py-3 border border-as-gray-200 rounded-xl bg-white text-base focus:outline-none focus:border-as-red-600 focus:ring-2 focus:ring-red-100 disabled:bg-as-gray-50 disabled:text-as-gray-400";

// ─── CSV EXPORT ───
function exportDailyCSV(date, visits, kmData) {
  const lines = [];
  lines.push(`Dnevno poročilo CRM - ${date}`);
  lines.push('');
  lines.push(`Skupaj km: ${kmData.totalKm}`);
  lines.push('');
  lines.push('Tip;Čas prihoda;Čas odhoda;Km števec;Stranka;Naslov;Dogovori;Ponudba?;Opis ponudbe;Dodeljeno;Rok ponudbe');
  visits.forEach((v) => {
    const tip = v.entry_type === 'home_start' ? 'Začetek doma' : v.entry_type === 'home_end' ? 'Konec doma' : v.entry_type === 'malica' ? 'Malica' : v.entry_type === 'private' ? 'Zasebno' : v.entry_type === 'call' ? (v.channel === 'email' ? 'Email' : 'Klic') : 'Obisk';
    lines.push([
      tip,
      v.arrival_time || '',
      v.departure_time || '',
      v.odometer_km ?? '',
      (v.customer_name || '').replace(/[\r\n;]/g, ' '),
      (v.customer_address || '').replace(/[\r\n;]/g, ' '),
      (v.notes || '').replace(/[\r\n;]/g, ' '),
      v.create_offer ? 'DA' : '',
      (v.offer_description || '').replace(/[\r\n;]/g, ' '),
      v.offer_assigned_to_email || '',
      v.offer_due_date || '',
    ].join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMonthlyCSV(year, month, byDay, topCustomers) {
  const lines = [];
  lines.push(`Mesečno poročilo CRM - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PO DNEVIH');
  lines.push('Datum;Obiskov;Ponudb;Km');
  byDay.forEach((d) => {
    lines.push(`${d.date};${d.visits};${d.offers};${d.km ?? ''}`);
  });
  lines.push('');

  lines.push('TOP STRANKE');
  lines.push('Stranka;Obiskov;Ponudb');
  topCustomers.forEach((c) => lines.push(`${c.name};${c.count};${c.offers}`));

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── IZBIRA STRANKE (iskalni dropdown nad crm_customers) ───
function CustomerPicker({ selected, onSelect, onClear }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [branches, setBranches] = useState([]);
  // Dodajanje nove stranke
  const [adding, setAdding] = useState(false);
  const [nNaziv, setNNaziv] = useState('');
  const [nUlica, setNUlica] = useState('');
  const [nPosta, setNPosta] = useState('');
  const [nDavcna, setNDavcna] = useState('');
  const [nPanoga, setNPanoga] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addErr, setAddErr] = useState('');

  function startAdd() {
    setNNaziv(q.trim());
    setNUlica(''); setNPosta(''); setNDavcna(''); setNPanoga('');
    setAddErr('');
    setOpen(false);
    setAdding(true);
  }

  async function saveNewCustomer() {
    const naziv = nNaziv.trim();
    if (!naziv) { setAddErr('Vnesi naziv stranke.'); return; }
    setSavingNew(true); setAddErr('');
    try {
      const davcna = nDavcna.trim() || null;
      if (davcna) {
        const { data: ex } = await supabase
          .from('crm_customers')
          .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
          .eq('davcna', davcna)
          .order('poslovalnica', { ascending: true })
          .limit(1);
        if (ex && ex.length > 0) { setAdding(false); onSelect(ex[0]); return; }
      }
      const { data, error } = await supabase
        .from('crm_customers')
        .insert([{
          naziv,
          ulica: nUlica.trim() || null,
          posta: nPosta.trim() || null,
          davcna,
          panoga: nPanoga.trim() || null,
          poslovalnica: 0,
        }])
        .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
        .single();
      if (error) throw error;
      setAdding(false);
      onSelect(data);
    } catch (e) {
      setAddErr(e.message || 'Napaka pri shranjevanju stranke.');
    } finally {
      setSavingNew(false);
    }
  }

  useEffect(() => {
    if (selected || chosen) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const safe = term.replace(/[(),%]/g, ' ').trim();
      const pat = `%${safe}%`;
      const { data } = await supabase
        .from('crm_customers')
        .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
        .or(`naziv.ilike.${pat},ulica.ilike.${pat},posta.ilike.${pat},davcna.ilike.${pat}`)
        .order('poslovalnica', { ascending: true })
        .limit(200);
      const map = {};
      (data || []).forEach((c) => {
        const key = (c.davcna && String(c.davcna).trim()) ? `d:${c.davcna}` : `id:${c.id}`;
        if (!map[key]) map[key] = { key, davcna: c.davcna || null, naziv: c.naziv, panoga: c.panoga, sampleId: c.id, count: 0 };
        map[key].count += 1;
        if (c.poslovalnica === 0) map[key].naziv = c.naziv;
      });
      const arr = Object.values(map).sort((a, b) => a.naziv.localeCompare(b.naziv)).slice(0, 30);
      if (active) { setResults(arr); setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q, selected, chosen]);

  async function chooseCustomer(cust) {
    setOpen(false);
    let qy = supabase.from('crm_customers').select('id,naziv,ulica,posta,davcna,panoga,poslovalnica');
    qy = cust.davcna ? qy.eq('davcna', cust.davcna) : qy.eq('id', cust.sampleId);
    const { data } = await qy.order('poslovalnica', { ascending: true });
    const list = data || [];
    if (list.length <= 1) { onSelect(list[0] || null); return; }
    setChosen(cust);
    setBranches(list);
  }

  function resetAll() { setChosen(null); setBranches([]); setQ(''); setResults([]); onClear(); }

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-3 border border-as-gray-200 rounded-xl p-3 bg-as-gray-50">
        <div className="text-sm">
          <div className="font-bold text-as-gray-800">{selected.naziv}</div>
          <div className="text-as-gray-500">{selected.poslovalnica ? `Posl. ${selected.poslovalnica} · ` : ''}{[selected.ulica, selected.posta].filter(Boolean).join(', ') || '—'}</div>
          <div className="text-xs text-as-gray-400 mt-0.5">Davčna: {selected.davcna || '—'} · Panoga: {selected.panoga || '—'}</div>
        </div>
        <button type="button" onClick={resetAll} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold whitespace-nowrap">Zamenjaj</button>
      </div>
    );
  }

  if (chosen) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-as-gray-800">{chosen.naziv}</div>
          <button type="button" onClick={() => { setChosen(null); setBranches([]); }} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold whitespace-nowrap">Druga stranka</button>
        </div>
        <select className={inputCls} defaultValue="" onChange={(e) => { const b = branches.find((x) => String(x.id) === e.target.value); if (b) onSelect(b); }}>
          <option value="" disabled>— izberi poslovalnico ({branches.length}) —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.poslovalnica != null ? `Posl. ${b.poslovalnica} — ` : ''}{[b.ulica, b.posta].filter(Boolean).join(', ')}</option>
          ))}
        </select>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="border border-as-gray-200 rounded-xl p-4 bg-as-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-as-gray-800">➕ Nova stranka</div>
          <button type="button" onClick={() => setAdding(false)} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold">Prekliči</button>
        </div>
        {addErr && <div className="text-xs text-red-600">{addErr}</div>}
        <div>
          <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Naziv *</label>
          <input type="text" value={nNaziv} onChange={(e) => setNNaziv(e.target.value)} className={inputCls} placeholder="Naziv stranke" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Ulica</label>
            <input type="text" value={nUlica} onChange={(e) => setNUlica(e.target.value)} className={inputCls} placeholder="Ulica in hišna št." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Pošta</label>
            <input type="text" value={nPosta} onChange={(e) => setNPosta(e.target.value)} className={inputCls} placeholder="npr. 3000 Celje" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Davčna</label>
            <input type="text" value={nDavcna} onChange={(e) => setNDavcna(e.target.value)} className={inputCls} placeholder="brez SI" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Panoga</label>
            <input type="text" value={nPanoga} onChange={(e) => setNPanoga(e.target.value)} className={inputCls} placeholder="neobvezno" />
          </div>
        </div>
        <button type="button" onClick={saveNewCustomer} disabled={savingNew}
          className="w-full sm:w-auto justify-center px-4 py-3 text-white text-base font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>
          {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Shrani stranko in izberi
        </button>
        <p className="text-xs text-as-gray-400">Če davčna že obstaja, se izbere obstoječa stranka (brez podvajanja).</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        className={inputCls} placeholder="Išči stranko po nazivu, naslovu ali davčni (min. 2 znaka)..." />
      {open && q.trim().length >= 2 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-as-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-sm text-as-gray-400">Iščem…</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-sm text-as-gray-400">Ni zadetkov.</div>}
          {results.map((c) => (
            <button key={c.key} type="button" onClick={() => chooseCustomer(c)}
              className="w-full text-left px-3 py-3 hover:bg-as-gray-50 border-b border-as-gray-100 last:border-0">
              <div className="text-sm font-semibold text-as-gray-800">{c.naziv}</div>
              <div className="text-xs text-as-gray-500">{c.davcna ? `Davčna ${c.davcna}` : ''}{c.count > 1 ? ` · ${c.count} poslovalnic` : ''} · {c.panoga || '—'}</div>
            </button>
          ))}
          {!loading && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={startAdd}
              className="w-full text-left px-3 py-3 hover:bg-orange-50 border-t border-as-gray-200 text-sm font-semibold flex items-center gap-2" style={{ color: CRM_COLOR }}>
              <Plus className="w-4 h-4" /> Dodaj novo stranko{q.trim() ? `: "${q.trim()}"` : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── IZBIRA IZIDA (Naročilo / Ponudba / Nič) ───
function OutcomePicker({ value, onChange }) {
  const opts = [
    { id: 'narocilo', label: 'Naročilo', color: '#16A34A', bg: '#DCFCE7' },
    { id: 'ponudba', label: 'Ponudba', color: '#D97706', bg: '#FEF3C7' },
    { id: 'nic', label: 'Nič', color: '#6B7280', bg: '#F3F4F6' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className="flex-1 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: active ? o.color : '#E5E7EB', background: active ? o.bg : '#fff', color: active ? o.color : '#6B7280' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── PIPELINE / POSLI ───
const DEAL_STAGES = [
  { id: 'nov_stik', name: 'Nov stik', color: '#6B7280', bg: '#F3F4F6', prob: 10 },
  { id: 'ponudba', name: 'Ponudba', color: '#D97706', bg: '#FEF3C7', prob: 40 },
  { id: 'pogajanja', name: 'Pogajanja', color: '#1E40AF', bg: '#DBEAFE', prob: 70 },
  { id: 'narocilo', name: 'Naročilo', color: '#16A34A', bg: '#DCFCE7', prob: 100 },
  { id: 'izgubljeno', name: 'Izgubljeno', color: '#DC2626', bg: '#FEE2E2', prob: 0 },
];
const stageById = (id) => DEAL_STAGES.find((s) => s.id === id) || DEAL_STAGES[0];
function statusForStage(stage) {
  if (stage === 'narocilo') return 'won';
  if (stage === 'izgubljeno') return 'lost';
  return 'open';
}
function formatEur(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('sl-SI', { maximumFractionDigits: 0 }) + ' €';
}

function PipelineView({ currentUser, isAdmin, employees }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isTeamLead = !isAdmin && CRM_TEAM_LEADS.includes(currentUser?.email);

  async function load() {
    setLoading(true); setError('');
    try {
      let qy = supabase.from('crm_deals').select('*').order('created_at', { ascending: false }).limit(2000);
      if (!isAdmin) {
        if (isTeamLead) qy = qy.in('created_by', [currentUser?.email, CRM_TEAM_MEMBER]);
        else qy = qy.eq('created_by', currentUser?.email);
      }
      const { data, error } = await qy;
      if (error) throw error;
      setDeals(data || []);
    } catch (e) {
      setError(e.message || 'Napaka pri nalaganju poslov.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // KPI
  const open = deals.filter((d) => d.status === 'open');
  const valueOpen = open.reduce((s, d) => s + (Number(d.value_eur) || 0), 0);
  const forecast = open.reduce((s, d) => s + (Number(d.value_eur) || 0) * ((d.probability ?? stageById(d.stage).prob) / 100), 0);
  const won = deals.filter((d) => d.status === 'won');
  const valueWon = won.reduce((s, d) => s + (Number(d.value_eur) || 0), 0);

  const byStage = DEAL_STAGES.map((st) => ({
    ...st,
    items: deals.filter((d) => d.stage === st.id),
  }));

  async function moveStage(deal, newStage) {
    const st = stageById(newStage);
    let lost_reason = deal.lost_reason || null;
    if (newStage === 'izgubljeno') {
      const r = window.prompt('Razlog izgube posla:', lost_reason || '');
      if (r === null) return;
      lost_reason = r || null;
    }
    try {
      const { error } = await supabase.from('crm_deals').update({
        stage: newStage,
        status: statusForStage(newStage),
        probability: st.prob,
        lost_reason,
        updated_at: new Date().toISOString(),
      }).eq('id', deal.id);
      if (error) throw error;
      load();
    } catch (e) { setError(e.message || 'Napaka pri premiku.'); }
  }

  async function saveEdit(deal, patch) {
    try {
      const { error } = await supabase.from('crm_deals').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', deal.id);
      if (error) throw error;
      load();
    } catch (e) { setError(e.message || 'Napaka pri shranjevanju.'); }
  }

  async function removeDeal(deal) {
    if (!confirm('Izbrišem ta posel?')) return;
    try {
      const { error } = await supabase.from('crm_deals').delete().eq('id', deal.id);
      if (error) throw error;
      load();
    } catch (e) { setError(e.message || 'Napaka pri brisanju.'); }
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat icon="📂" label="Odprti posli" value={open.length} unit="" color="#1E40AF" bgColor="#DBEAFE" />
        <BigStat icon="💼" label="Vrednost odprtih" value={formatEur(valueOpen)} unit="" color={CRM_COLOR} bgColor={CRM_BG} />
        <BigStat icon="🎯" label="Forecast (tehtan)" value={formatEur(Math.round(forecast))} unit="" color="#854D0E" bgColor="#FEF3C7" />
        <BigStat icon="✓" label="Dobljeno" value={formatEur(valueWon)} unit="" color="#16A34A" bgColor="#DCFCE7" />
      </div>

      {/* Nov posel */}
      <div>
        <button onClick={() => setShowForm((s) => !s)}
          className="w-full sm:w-auto justify-center px-5 py-3 text-white text-base font-semibold rounded-xl inline-flex items-center gap-2"
          style={{ background: CRM_COLOR }}>
          <Plus className="w-5 h-5" /> Nov posel
        </button>
      </div>
      {showForm && <DealForm currentUser={currentUser} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} setError={setError} />}

      {loading ? <LoadingBox /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {byStage.map((col) => {
            const sum = col.items.reduce((s, d) => s + (Number(d.value_eur) || 0), 0);
            return (
              <div key={col.id} className="bg-as-gray-50 border border-as-gray-200 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm font-bold" style={{ color: col.color }}>{col.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: col.bg, color: col.color }}>{col.items.length}</span>
                </div>
                {sum > 0 && <div className="text-xs text-as-gray-500 mb-2 px-1">{formatEur(sum)}</div>}
                <div className="space-y-2">
                  {col.items.length === 0 ? (
                    <div className="text-xs text-as-gray-400 px-1 py-3 text-center">—</div>
                  ) : col.items.map((d) => (
                    <DealCard key={d.id} deal={d} onMove={moveStage} onSave={saveEdit} onDelete={removeDeal} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, onMove, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(deal.value_eur ?? '');
  const [prob, setProb] = useState(deal.probability ?? stageById(deal.stage).prob);
  const [close, setClose] = useState(deal.expected_close || '');
  const [notes, setNotes] = useState(deal.notes || '');
  const st = stageById(deal.stage);

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-3">
        <div className="font-semibold text-as-gray-800 text-sm leading-tight">{deal.naziv}</div>
        {deal.customer_name && <div className="text-xs text-as-gray-500 mt-0.5 truncate">{deal.customer_name}</div>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {deal.value_eur != null && deal.value_eur !== '' && (
            <span className="text-xs font-bold" style={{ color: CRM_COLOR }}>{formatEur(deal.value_eur)}</span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{deal.probability ?? st.prob}%</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-as-gray-100 space-y-2.5">
          {/* Premik faze */}
          <div>
            <label className="block text-xs font-semibold text-as-gray-500 uppercase mb-1">Faza</label>
            <select value={deal.stage} onChange={(e) => onMove(deal, e.target.value)} className={inputCls}>
              {DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {deal.stage === 'izgubljeno' && deal.lost_reason && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">Razlog: {deal.lost_reason}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-as-gray-500 uppercase mb-1">Vrednost €</label>
              <input type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="npr. 5000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-as-gray-500 uppercase mb-1">Verjetnost %</label>
              <input type="number" inputMode="numeric" min="0" max="100" value={prob} onChange={(e) => setProb(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-500 uppercase mb-1">Pričakovan zaključek</label>
            <input type="date" value={close} onChange={(e) => setClose(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-500 uppercase mb-1">Opombe</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls + ' resize-none'} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onSave(deal, { value_eur: value === '' ? null : Number(value), probability: prob === '' ? null : Number(prob), expected_close: close || null, notes: notes || null })}
              className="flex-1 justify-center px-3 py-2.5 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2" style={{ background: CRM_COLOR }}>
              <Save className="w-4 h-4" /> Shrani
            </button>
            <button onClick={() => onDelete(deal)} className="p-2.5 text-as-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          {deal.created_by_name && <div className="text-xs text-as-gray-400">Lastnik: {deal.created_by_name}</div>}
        </div>
      )}
    </div>
  );
}

function DealForm({ currentUser, onClose, onSaved, setError }) {
  const [naziv, setNaziv] = useState('');
  const [customer, setCustomer] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState('nov_stik');
  const [close, setClose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!naziv.trim()) { setError('Vnesi naziv posla.'); return; }
    setLoading(true); setError('');
    try {
      const st = stageById(stage);
      const { error } = await supabase.from('crm_deals').insert([{
        naziv: naziv.trim(),
        customer_id: customer?.id ? String(customer.id) : null,
        customer_name: customerName || customer?.naziv || null,
        stage,
        status: statusForStage(stage),
        value_eur: value === '' ? null : Number(value),
        probability: st.prob,
        expected_close: close || null,
        notes: notes || null,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      onSaved();
    } catch (e) {
      setError(e.message || 'Napaka pri shranjevanju posla.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-as-gray-700">Nov posel</h3>
        <button type="button" onClick={onClose} className="text-as-gray-400 hover:text-as-gray-700"><X className="w-5 h-5" /></button>
      </div>
      <FormField label="Naziv posla *">
        <input type="text" value={naziv} onChange={(e) => setNaziv(e.target.value)} className={inputCls} placeholder="npr. Sidra za projekt XY" />
      </FormField>
      <FormField label="Stranka">
        <CustomerPicker
          selected={customer}
          onSelect={(c) => { setCustomer(c); setCustomerName(c.naziv); }}
          onClear={() => { setCustomer(null); setCustomerName(''); }}
        />
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Vrednost € (neobvezno)">
          <input type="number" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="npr. 5000" />
        </FormField>
        <FormField label="Pričakovan zaključek">
          <input type="date" value={close} onChange={(e) => setClose(e.target.value)} className={inputCls} />
        </FormField>
      </div>
      <FormField label="Faza">
        <select value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
          {DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </FormField>
      <FormField label="Opombe">
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls + ' resize-none'} placeholder="Kratek opis posla, dogovori..." />
      </FormField>
      <SubmitBtn loading={loading} color={CRM_COLOR} label="Shrani posel" />
    </form>
  );
}

// ─── POROČILA / DASHBOARD (analitika iz obstoječih podatkov) ───
function ReportsView({ visits, loading }) {
  const [period, setPeriod] = useState('3m'); // 'month' | '3m' | 'year' | 'all'
  const [custMap, setCustMap] = useState({});

  // panoga iz crm_customers
  useEffect(() => {
    const ids = [...new Set((visits || []).map((v) => v.customer_id).filter(Boolean))];
    if (ids.length === 0) { setCustMap({}); return; }
    let active = true;
    (async () => {
      const map = {};
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase.from('crm_customers').select('id,naziv,panoga').in('id', chunk);
        (data || []).forEach((c) => { map[c.id] = c; });
      }
      if (active) setCustMap(map);
    })();
    return () => { active = false; };
  }, [visits]);

  const fromDate = useMemo(() => {
    const now = new Date();
    if (period === 'all') return '0000-01-01';
    if (period === 'year') return `${now.getFullYear()}-01-01`;
    if (period === 'month') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const d = new Date(now); d.setMonth(d.getMonth() - 2); d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, [period]);

  // kontakti (obiski + klici) v obdobju
  const contacts = useMemo(() =>
    (visits || []).filter((v) => (v.entry_type === 'visit' || v.entry_type === 'call') && (v.visit_date || '') >= fromDate),
  [visits, fromDate]);

  // vsi vnosi v obdobju (za km)
  const periodAll = useMemo(() =>
    (visits || []).filter((v) => (v.visit_date || '') >= fromDate),
  [visits, fromDate]);

  // LIJAK / izidi
  const funnel = useMemo(() => {
    const kontakti = contacts.length;
    const obiski = contacts.filter((v) => v.entry_type === 'visit').length;
    const klici = contacts.filter((v) => v.entry_type === 'call').length;
    const ponudbe = contacts.filter((v) => v.outcome === 'ponudba' || v.create_offer).length;
    const narocila = contacts.filter((v) => v.outcome === 'narocilo').length;
    const konvPonudba = kontakti ? Math.round((ponudbe / kontakti) * 100) : 0;
    const konvNarocilo = kontakti ? Math.round((narocila / kontakti) * 100) : 0;
    const winRate = (narocila + ponudbe) ? Math.round((narocila / (narocila + ponudbe)) * 100) : 0;
    return { kontakti, obiski, klici, ponudbe, narocila, konvPonudba, konvNarocilo, winRate };
  }, [contacts]);

  // PO PRODAJALCU
  const bySales = useMemo(() => {
    const g = {};
    contacts.forEach((v) => {
      const key = v.created_by || '—';
      if (!g[key]) g[key] = { email: key, name: v.created_by_name || key, kontakti: 0, obiski: 0, klici: 0, narocila: 0, ponudbe: 0, minutes: 0, km: 0 };
      const r = g[key];
      r.kontakti += 1;
      if (v.entry_type === 'visit') r.obiski += 1; else r.klici += 1;
      if (v.outcome === 'narocilo') r.narocila += 1;
      if (v.outcome === 'ponudba' || v.create_offer) r.ponudbe += 1;
      r.minutes += Number(v.visit_duration_min || v.call_duration_min || diffMinutes(v.arrival_time, v.departure_time) || 0);
    });
    // km: po (prodajalec + dan), max - min
    const dayMap = {};
    periodAll.forEach((v) => {
      if (v.odometer_km == null) return;
      const k = `${v.created_by}|${v.visit_date}`;
      if (!dayMap[k]) dayMap[k] = { email: v.created_by, min: v.odometer_km, max: v.odometer_km };
      dayMap[k].min = Math.min(dayMap[k].min, v.odometer_km);
      dayMap[k].max = Math.max(dayMap[k].max, v.odometer_km);
    });
    Object.values(dayMap).forEach((d) => {
      const km = d.max - d.min;
      if (km > 0 && g[d.email]) g[d.email].km += km;
    });
    return Object.values(g).sort((a, b) => b.narocila - a.narocila || b.kontakti - a.kontakti);
  }, [contacts, periodAll]);

  // TREND po mesecih (zadnjih do 12)
  const trend = useMemo(() => {
    const m = {};
    contacts.forEach((v) => {
      const key = (v.visit_date || '').slice(0, 7);
      if (!key) return;
      if (!m[key]) m[key] = { month: key, kontakti: 0, ponudbe: 0, narocila: 0 };
      m[key].kontakti += 1;
      if (v.outcome === 'ponudba' || v.create_offer) m[key].ponudbe += 1;
      if (v.outcome === 'narocilo') m[key].narocila += 1;
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [contacts]);

  // PO PANOGI
  const byPanoga = useMemo(() => {
    const g = {};
    contacts.forEach((v) => {
      const pan = (v.customer_id && custMap[v.customer_id]?.panoga) || '—';
      if (!g[pan]) g[pan] = { panoga: pan, kontakti: 0, narocila: 0 };
      g[pan].kontakti += 1;
      if (v.outcome === 'narocilo') g[pan].narocila += 1;
    });
    return Object.values(g).sort((a, b) => b.kontakti - a.kontakti).slice(0, 8);
  }, [contacts, custMap]);

  if (loading) return <LoadingBox />;

  const periods = [
    { id: 'month', label: 'Ta mesec' },
    { id: '3m', label: '3 mesece' },
    { id: 'year', label: 'Letos' },
    { id: 'all', label: 'Vse' },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Obdobje */}
      <div className="grid grid-cols-4 gap-2">
        {periods.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className="px-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition"
            style={{ borderColor: period === p.id ? CRM_COLOR : '#E5E7EB', background: period === p.id ? CRM_BG : '#fff', color: period === p.id ? CRM_COLOR : '#6B7280' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat icon="📞" label="Kontakti" value={funnel.kontakti} unit="" color="#6D28D9" bgColor="#EDE9FE" />
        <BigStat icon="📝" label="Ponudbe" value={funnel.ponudbe} unit="" color="#854D0E" bgColor="#FEF3C7" />
        <BigStat icon="✓" label="Naročila" value={funnel.narocila} unit="" color="#16A34A" bgColor="#DCFCE7" />
        <BigStat icon="🎯" label="Uspešnost" value={funnel.winRate} unit="%" color={CRM_COLOR} bgColor={CRM_BG} />
      </div>

      {/* LIJAK */}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-as-gray-700 mb-4">📊 Prodajni lijak</h3>
        <FunnelBar label="Kontakti" value={funnel.kontakti} max={funnel.kontakti} color="#6D28D9" pct={100} />
        <FunnelBar label="Ponudbe" value={funnel.ponudbe} max={funnel.kontakti} color="#D97706" pct={funnel.konvPonudba} />
        <FunnelBar label="Naročila" value={funnel.narocila} max={funnel.kontakti} color="#16A34A" pct={funnel.konvNarocilo} />
        <p className="text-xs text-as-gray-500 mt-3">
          Kontakt → ponudba: <strong>{funnel.konvPonudba}%</strong> · kontakt → naročilo: <strong>{funnel.konvNarocilo}%</strong> · uspešnost: <strong>{funnel.winRate}%</strong> (naročila / naročila+ponudbe)
        </p>
      </div>

      {/* PO PRODAJALCU */}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-as-gray-700 mb-4">🏅 Po prodajalcu</h3>
        {bySales.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Prodajalec</th>
                  <th className="text-right p-2">Kont.</th>
                  <th className="text-right p-2">Naročila</th>
                  <th className="text-right p-2">Ponudbe</th>
                  <th className="text-right p-2">Čas (h)</th>
                  <th className="text-right p-2">Km</th>
                </tr>
              </thead>
              <tbody>
                {bySales.map((r) => (
                  <tr key={r.email} className="border-t border-as-gray-100">
                    <td className="p-2 font-semibold text-as-gray-800">{r.name}</td>
                    <td className="p-2 text-right">{r.kontakti}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: r.narocila > 0 ? '#16A34A' : '#9CA3AF' }}>{r.narocila}</td>
                    <td className="p-2 text-right" style={{ color: r.ponudbe > 0 ? '#D97706' : '#9CA3AF' }}>{r.ponudbe}</td>
                    <td className="p-2 text-right">{(r.minutes / 60).toFixed(1)}</td>
                    <td className="p-2 text-right">{formatNumber(r.km)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TREND */}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-as-gray-700 mb-4">📈 Trend po mesecih</h3>
        {trend.length === 0 ? <Empty /> : (
          <div className="space-y-2.5">
            {(() => {
              const maxK = Math.max(...trend.map((t) => t.kontakti), 1);
              return trend.map((t) => {
                const [y, mo] = t.month.split('-');
                const label = `${(SLOVENIAN_MONTHS[Number(mo) - 1] || '').slice(0, 3)} ${y.slice(2)}`;
                return (
                  <div key={t.month} className="flex items-center gap-3 text-sm">
                    <div className="w-14 text-xs text-as-gray-500 flex-shrink-0">{label}</div>
                    <div className="flex-1 bg-as-gray-100 rounded h-6 overflow-hidden relative">
                      <div className="h-full" style={{ width: `${(t.kontakti / maxK) * 100}%`, backgroundColor: '#EDE9FE' }} />
                      <div className="absolute inset-0 flex items-center px-2 gap-3 text-xs">
                        <span className="text-as-gray-600">{t.kontakti} kont.</span>
                        {t.ponudbe > 0 && <span style={{ color: '#D97706' }}>{t.ponudbe} pon.</span>}
                        {t.narocila > 0 && <span style={{ color: '#16A34A' }} className="font-semibold">{t.narocila} nar.</span>}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* PO PANOGI */}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-as-gray-700 mb-4">🏢 Po panogi</h3>
        {byPanoga.length === 0 ? <Empty /> : (
          <div className="space-y-2">
            {(() => {
              const maxK = Math.max(...byPanoga.map((p) => p.kontakti), 1);
              return byPanoga.map((p) => (
                <div key={p.panoga} className="grid grid-cols-12 gap-2 items-center text-sm">
                  <div className="col-span-4 text-as-gray-700 truncate" title={p.panoga}>{p.panoga}</div>
                  <div className="col-span-6 bg-as-gray-100 rounded h-5 overflow-hidden">
                    <div className="h-full" style={{ width: `${(p.kontakti / maxK) * 100}%`, backgroundColor: CRM_COLOR }} />
                  </div>
                  <div className="col-span-2 text-right font-semibold text-as-gray-700">
                    {p.kontakti}{p.narocila > 0 && <span className="text-xs ml-1" style={{ color: '#16A34A' }}>({p.narocila}✓)</span>}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, color, pct }) {
  const width = max ? Math.max((value / max) * 100, value > 0 ? 6 : 0) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-semibold text-as-gray-700">{label}</span>
        <span className="text-as-gray-500">{value} <span className="text-xs">({pct}%)</span></span>
      </div>
      <div className="bg-as-gray-100 rounded-lg h-7 overflow-hidden">
        <div className="h-full rounded-lg transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── ANALIZA PO STRANKAH (z zgodovino vsake stranke) ───
// Prednastavljeni tagi za stranke (lahko se dodajo lastni)
const CUSTOMER_TAGS = ['vroč lead', 'obstoječa stranka', 'potencial', 'neaktivna', 'VIP', 'cenovno občutljiva'];

function AnalysisView({ visits, loading }) {
  const [q, setQ] = useState('');
  const [custMap, setCustMap] = useState({});
  const [openKey, setOpenKey] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);

  useEffect(() => {
    const ids = [...new Set((visits || []).map((v) => v.customer_id).filter(Boolean))];
    if (ids.length === 0) { setCustMap({}); return; }
    let active = true;
    (async () => {
      const map = {};
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data } = await supabase.from('crm_customers').select('id,naziv,panoga,ulica,posta,davcna,kontakt_oseba,email,telefon,splet,opombe,tags').in('id', chunk);
        (data || []).forEach((c) => { map[c.id] = c; });
      }
      if (active) setCustMap(map);
    })();
    return () => { active = false; };
  }, [visits]);

  function applyCustomerUpdate(id, patch) {
    setCustMap((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch, id } }));
  }

  const rows = useMemo(() => {
    const g = {};
    for (const v of (visits || [])) {
      if (v.entry_type !== 'visit' && v.entry_type !== 'call') continue;
      const cust = v.customer_id ? custMap[v.customer_id] : null;
      const key = (cust && cust.davcna) ? `d:${cust.davcna}` : (v.customer_id ? `id:${v.customer_id}` : `n:${(v.customer_name || '—').toLowerCase()}`);
      if (!g[key]) g[key] = { key, custId: null, naziv: cust?.naziv || v.customer_name || '—', panoga: cust?.panoga || '—', kontakti: 0, minutes: 0, narocila: 0, ponudbe: 0, zadnji: null, entries: [], cust: null };
      const r = g[key];
      if (!r.custId && v.customer_id) { r.custId = v.customer_id; }
      if (cust) { r.cust = cust; if (cust.naziv) r.naziv = cust.naziv; if (cust.panoga) r.panoga = cust.panoga; }
      r.kontakti += 1;
      r.minutes += Number(v.visit_duration_min || v.call_duration_min || diffMinutes(v.arrival_time, v.departure_time) || 0);
      if (v.outcome === 'narocilo') r.narocila += 1;
      else if (v.outcome === 'ponudba') r.ponudbe += 1;
      else if (v.create_offer && !v.outcome) r.ponudbe += 1;
      if (!r.zadnji || (v.visit_date && v.visit_date > r.zadnji)) r.zadnji = v.visit_date;
      r.entries.push(v);
    }
    let arr = Object.values(g);
    arr.forEach((r) => {
      r.tags = (r.cust && Array.isArray(r.cust.tags)) ? r.cust.tags : [];
      r.entries.sort((a, b) => {
        const d = (b.visit_date || '').localeCompare(a.visit_date || '');
        if (d !== 0) return d;
        return (b.arrival_time || '').localeCompare(a.arrival_time || '');
      });
    });
    const term = q.trim().toLowerCase();
    if (term) arr = arr.filter((r) => r.naziv.toLowerCase().includes(term) || (r.panoga || '').toLowerCase().includes(term));
    if (tagFilter) arr = arr.filter((r) => (r.tags || []).includes(tagFilter));
    arr.sort((a, b) => b.kontakti - a.kontakti || b.minutes - a.minutes);
    return arr;
  }, [visits, custMap, q, tagFilter]);

  const allTags = useMemo(() => {
    const s = new Set();
    Object.values(custMap).forEach((c) => (c?.tags || []).forEach((t) => s.add(t)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [custMap]);

  const totals = useMemo(() => rows.reduce((a, r) => {
    a.kontakti += r.kontakti; a.minutes += r.minutes; a.narocila += r.narocila; a.ponudbe += r.ponudbe;
    return a;
  }, { kontakti: 0, minutes: 0, narocila: 0, ponudbe: 0 }), [rows]);

  if (loading) return <div className="text-center py-10 text-as-gray-400">Nalagam…</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Strank z aktivnostjo</div><div className="text-2xl font-bold text-as-gray-700 mt-1">{rows.length}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Skupaj kontaktov</div><div className="text-2xl font-bold text-as-gray-700 mt-1">{totals.kontakti}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Naročila</div><div className="text-2xl font-bold mt-1" style={{ color: '#16A34A' }}>{totals.narocila}</div></div>
        <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm"><div className="text-xs text-as-gray-500 font-semibold uppercase">Ponudbe</div><div className="text-2xl font-bold mt-1" style={{ color: '#D97706' }}>{totals.ponudbe}</div></div>
      </div>

      <div className="bg-white border border-as-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h3 className="font-bold text-as-gray-700">👤 Stranke — klikni za profil in zgodovino</h3>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Išči stranko ali panogo…" className={inputCls + ' max-w-xs'} />
        </div>

        {/* Filter po tagih */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setTagFilter(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
              style={{ borderColor: tagFilter === null ? CRM_COLOR : '#E5E7EB', background: tagFilter === null ? CRM_BG : '#fff', color: tagFilter === null ? CRM_COLOR : '#6B7280' }}>
              Vsi
            </button>
            {allTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                style={{ borderColor: tagFilter === t ? CRM_COLOR : '#E5E7EB', background: tagFilter === t ? CRM_BG : '#fff', color: tagFilter === t ? CRM_COLOR : '#6B7280' }}>
                {t}
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-center py-8 text-as-gray-400 text-sm">Ni podatkov. Vnosi z izbrano stranko se bodo prikazali tukaj.</div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const naroca = r.narocila > 0;
              const ponudbeBrez = r.ponudbe > 0 && r.narocila === 0;
              const badge = naroca
                ? { t: 'Naroča', c: '#16A34A', b: '#DCFCE7' }
                : ponudbeBrez
                  ? { t: 'Ponudbe, brez naročila', c: '#DC2626', b: '#FEE2E2' }
                  : { t: 'Brez izida', c: '#6B7280', b: '#F3F4F6' };
              const isOpen = openKey === r.key;
              return (
                <div key={r.key} className="border border-as-gray-200 rounded-xl overflow-hidden">
                  {/* Glava stranke */}
                  <button type="button" onClick={() => setOpenKey(isOpen ? null : r.key)}
                    className="w-full text-left p-4 hover:bg-as-gray-50 transition flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-as-gray-800">{r.naziv}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: badge.c, background: badge.b }}>{badge.t}</span>
                      </div>
                      <div className="text-xs text-as-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span>📞 {r.kontakti} kontaktov</span>
                        <span>⏱️ {(r.minutes / 60).toFixed(1)} h</span>
                        <span style={{ color: r.narocila > 0 ? '#16A34A' : undefined }}>✓ {r.narocila} naročil</span>
                        <span style={{ color: r.ponudbe > 0 ? '#D97706' : undefined }}>📝 {r.ponudbe} ponudb</span>
                        <span>🗓️ zadnji: {r.zadnji ? formatDate(r.zadnji) : '—'}</span>
                        {r.panoga && r.panoga !== '—' && <span className="text-as-gray-400">{r.panoga}</span>}
                      </div>
                    </div>
                    <div className="text-as-gray-400 flex-shrink-0 mt-0.5">
                      {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                  </button>

                  {/* Profil + zgodovina stranke */}
                  {isOpen && (
                    <div className="border-t border-as-gray-100 bg-as-gray-50/50 p-3 sm:p-4 space-y-3">
                      {r.custId ? (
                        <CustomerProfileEditor customer={r.cust || { id: r.custId, naziv: r.naziv }} onSaved={(patch) => applyCustomerUpdate(r.custId, patch)} />
                      ) : (
                        <div className="text-xs text-as-gray-400 bg-white border border-as-gray-200 rounded-lg p-3">Stranka ni povezana s šifrantom — profil ni na voljo. Pri vnosu jo izberi iz iskalnika strank.</div>
                      )}
                      <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider mb-1">Zgodovina ({r.entries.length})</div>
                      {r.entries.map((e) => {
                        const isCall = e.entry_type === 'call';
                        const eIcon = isCall ? (e.channel === 'email' ? '✉️' : '📞') : '📍';
                        const dur = isCall
                          ? (e.call_duration_min != null ? e.call_duration_min : null)
                          : diffMinutes(e.arrival_time, e.departure_time);
                        const oc = e.outcome === 'narocilo'
                          ? { t: 'Naročilo', c: '#16A34A', b: '#DCFCE7' }
                          : e.outcome === 'ponudba'
                            ? { t: 'Ponudba', c: '#D97706', b: '#FEF3C7' }
                            : null;
                        return (
                          <div key={e.id} className="bg-white border border-as-gray-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-lg flex-shrink-0">{eIcon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap text-sm">
                                  <span className="font-semibold text-as-gray-800">{formatDate(e.visit_date)}</span>
                                  <span className="text-as-gray-500 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatTime(e.arrival_time)}{e.departure_time ? ' – ' + formatTime(e.departure_time) : ''}
                                  </span>
                                  {dur != null && dur >= 0 && <span className="text-xs font-semibold" style={{ color: '#0E7490' }}>{formatMinutes(dur)}</span>}
                                  {oc && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: oc.c, background: oc.b }}>{oc.t}</span>}
                                  {e.create_offer && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: '#854D0E', background: '#FEF3C7' }}>📝 Naloga</span>}
                                </div>
                                {e.notes && <div className="text-sm text-as-gray-600 mt-1.5 whitespace-pre-wrap">{e.notes}</div>}
                                {e.offer_description && (
                                  <div className="text-xs text-as-gray-500 mt-1.5 bg-yellow-50 border border-yellow-200 rounded p-2">
                                    <strong>Ponudba:</strong> {e.offer_description}
                                    {e.offer_due_date && <> · rok {formatDate(e.offer_due_date)}</>}
                                  </div>
                                )}
                                <div className="text-xs text-as-gray-400 mt-1">Vnesel: {e.created_by_name || e.created_by || '—'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROFIL STRANKE (urejanje + tagi) ───
function CustomerProfileEditor({ customer, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [kontakt, setKontakt] = useState(customer.kontakt_oseba || '');
  const [email, setEmail] = useState(customer.email || '');
  const [telefon, setTelefon] = useState(customer.telefon || '');
  const [splet, setSplet] = useState(customer.splet || '');
  const [opombe, setOpombe] = useState(customer.opombe || '');
  const [tags, setTags] = useState(Array.isArray(customer.tags) ? customer.tags : []);
  const [newTag, setNewTag] = useState('');

  function toggleTag(t) {
    setTags((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]);
  }
  function addCustomTag() {
    const t = newTag.trim();
    if (!t) return;
    setTags((arr) => arr.includes(t) ? arr : [...arr, t]);
    setNewTag('');
  }

  async function save() {
    setSaving(true); setErr('');
    const patch = {
      kontakt_oseba: kontakt.trim() || null,
      email: email.trim() || null,
      telefon: telefon.trim() || null,
      splet: splet.trim() || null,
      opombe: opombe.trim() || null,
      tags,
    };
    try {
      const { error } = await supabase.from('crm_customers').update(patch).eq('id', customer.id);
      if (error) throw error;
      onSaved(patch);
      setEditing(false);
    } catch (e) {
      setErr(e.message || 'Napaka pri shranjevanju.');
    } finally {
      setSaving(false);
    }
  }

  const hasData = customer.kontakt_oseba || customer.email || customer.telefon || customer.splet || customer.opombe || (customer.tags && customer.tags.length);

  if (!editing) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider">Profil stranke</div>
          <button onClick={() => setEditing(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: CRM_BG, color: CRM_COLOR }}>Uredi</button>
        </div>
        {(customer.tags && customer.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {customer.tags.map((t) => <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: CRM_BG, color: CRM_COLOR }}>{t}</span>)}
          </div>
        )}
        {hasData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <ProfRow label="Kontakt" value={customer.kontakt_oseba} />
            <ProfRow label="Telefon" value={customer.telefon} href={customer.telefon ? `tel:${customer.telefon}` : null} />
            <ProfRow label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : null} />
            <ProfRow label="Splet" value={customer.splet} href={customer.splet ? (customer.splet.startsWith('http') ? customer.splet : `https://${customer.splet}`) : null} />
            {[customer.ulica, customer.posta].filter(Boolean).length > 0 && <ProfRow label="Naslov" value={[customer.ulica, customer.posta].filter(Boolean).join(', ')} />}
            {customer.davcna && <ProfRow label="Davčna" value={customer.davcna} />}
            {customer.opombe && <div className="sm:col-span-2"><span className="text-as-gray-400 text-xs">Opombe: </span><span className="text-as-gray-700 whitespace-pre-wrap">{customer.opombe}</span></div>}
          </div>
        ) : (
          <div className="text-xs text-as-gray-400">Ni podatkov — klikni »Uredi« in dodaj kontakt, email, telefon, tage…</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-3 sm:p-4 space-y-3">
      <div className="text-xs font-semibold text-as-gray-500 uppercase tracking-wider">Uredi profil — {customer.naziv}</div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Kontaktna oseba</label><input className={inputCls} value={kontakt} onChange={(e) => setKontakt(e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Telefon</label><input className={inputCls} value={telefon} onChange={(e) => setTelefon(e.target.value)} inputMode="tel" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Email</label><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Spletna stran</label><input className={inputCls} value={splet} onChange={(e) => setSplet(e.target.value)} placeholder="npr. www.stranka.si" /></div>
      </div>
      <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Opombe</label><textarea rows={2} className={inputCls + ' resize-none'} value={opombe} onChange={(e) => setOpombe(e.target.value)} placeholder="Posebnosti, dogovori, kontekst…" /></div>
      <div>
        <label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1.5">Tagi</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[...new Set([...CUSTOMER_TAGS, ...tags])].map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border transition"
                style={{ borderColor: on ? CRM_COLOR : '#E5E7EB', background: on ? CRM_BG : '#fff', color: on ? CRM_COLOR : '#6B7280' }}>
                {on ? '✓ ' : ''}{t}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input className={inputCls} value={newTag} onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }} placeholder="Dodaj svoj tag…" />
          <button type="button" onClick={addCustomTag} className="px-4 rounded-xl text-sm font-semibold flex-shrink-0" style={{ background: CRM_BG, color: CRM_COLOR }}>Dodaj</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 justify-center px-4 py-2.5 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Shrani profil
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-as-gray-200 text-as-gray-600">Prekliči</button>
      </div>
    </div>
  );
}

function ProfRow({ label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex gap-1.5">
      <span className="text-as-gray-400 text-xs whitespace-nowrap">{label}:</span>
      {href ? <a href={href} className="break-all" style={{ color: CRM_COLOR }}>{value}</a> : <span className="text-as-gray-700 break-all">{value}</span>}
    </div>
  );
}

// ─── STRANKE: preklop Baza / Analiza ───
function StrankeView({ visits, loading, isAdmin }) {
  const [mode, setMode] = useState('baza');
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 sm:inline-grid sm:grid-flow-col gap-1.5 bg-as-gray-100 rounded-xl p-1.5 border border-as-gray-200">
        {[['baza', 'Baza strank'], ['analiza', 'Analiza']].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg transition"
            style={mode === id ? { background: AS_RED, color: '#fff' } : { color: '#6B7280' }}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'baza' ? <CustomerDirectory isAdmin={isAdmin} visits={visits} /> : <AnalysisView visits={visits} loading={loading} />}
    </div>
  );
}

// ─── BAZA STRANK (direktorij: vse stranke, dodaj/uredi/izbriši) ───
function CustomerDirectory({ isAdmin, visits }) {
  const COLS = 'id,naziv,ulica,posta,davcna,panoga,poslovalnica,kontakt_oseba,email,telefon,splet,opombe,tags';
  const PAGE = 100;
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState(null);
  const [list, setList] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  // Navigacija: izbrano podjetje (poslovalnice) → izbrana stranka (detajl)
  const [company, setCompany] = useState(null);   // { naziv, branches: [...] }
  const [detail, setDetail] = useState(null);      // izbrana crm_customers vrstica
  const [editing, setEditing] = useState(false);   // urejanje detajla
  const [creating, setCreating] = useState(false); // nova stranka
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siblings, setSiblings] = useState([]);        // vse poslovalnice istega podjetja (po davčni)
  const [analysisScope, setAnalysisScope] = useState('all'); // 'all' = vse poslovalnice, 'this' = samo ta

  async function load(reset, curOffset) {
    setLoading(true); setErr('');
    try {
      const from = reset ? 0 : (curOffset ?? offset);
      let qy = supabase.from('crm_customers').select(COLS).order('naziv', { ascending: true }).range(from, from + PAGE - 1);
      const term = q.trim();
      if (term) {
        const safe = term.replace(/[(),%]/g, ' ').trim();
        const pat = `%${safe}%`;
        qy = qy.or(`naziv.ilike.${pat},ulica.ilike.${pat},posta.ilike.${pat},davcna.ilike.${pat}`);
      }
      if (tagFilter) qy = qy.contains('tags', [tagFilter]);
      const { data, error } = await qy;
      if (error) throw error;
      const rows = data || [];
      setList((prev) => reset ? rows : [...prev, ...rows]);
      setOffset(from + rows.length);
      setHasMore(rows.length === PAGE);
    } catch (e) {
      setErr(e.message || 'Napaka pri nalaganju strank.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const t = setTimeout(() => load(true), 300); return () => clearTimeout(t); }, [q, tagFilter]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 3000); return () => clearTimeout(t); }, [flash]);

  // Naloži vse poslovalnice istega podjetja (po davčni), za skupno analizo v detajlu
  useEffect(() => {
    if (!detail) { setSiblings([]); return; }
    let active = true;
    setAnalysisScope('all');
    (async () => {
      if (detail.davcna && String(detail.davcna).trim()) {
        const { data } = await supabase.from('crm_customers').select(COLS).eq('davcna', detail.davcna).order('poslovalnica', { ascending: true });
        if (active) setSiblings(data && data.length ? data : [detail]);
      } else if (active) { setSiblings([detail]); }
    })();
    return () => { active = false; };
  }, [detail ? detail.id : null]);

  // Združi naložene vrstice po podjetju (davčna)
  const companies = useMemo(() => {
    const map = {};
    list.forEach((c) => {
      const key = (c.davcna && String(c.davcna).trim()) ? `d:${c.davcna}` : `id:${c.id}`;
      if (!map[key]) map[key] = { key, naziv: c.naziv, davcna: c.davcna, panoga: c.panoga, tags: c.tags || [], rows: [] };
      map[key].rows.push(c);
      if (c.poslovalnica === 0) { map[key].naziv = c.naziv; map[key].tags = c.tags || []; map[key].panoga = c.panoga; }
    });
    return Object.values(map).sort((a, b) => a.naziv.localeCompare(b.naziv));
  }, [list]);

  const filterTags = [...new Set([...CUSTOMER_TAGS, ...list.flatMap((c) => c.tags || [])])];

  // Odpri podjetje → naloži VSE poslovalnice (tudi če niso v trenutni strani)
  async function openCompany(comp) {
    setErr('');
    try {
      let qy = supabase.from('crm_customers').select(COLS);
      qy = comp.davcna ? qy.eq('davcna', comp.davcna) : qy.eq('id', comp.rows[0].id);
      const { data, error } = await qy.order('poslovalnica', { ascending: true });
      if (error) throw error;
      const branches = data || comp.rows;
      if (branches.length <= 1) { setDetail(branches[0] || comp.rows[0]); setCompany(null); }
      else { setCompany({ naziv: comp.naziv, branches }); }
    } catch (e) { setErr(e.message); }
    setShowAnalysis(false); setEditing(false);
  }

  function openDetail(row) { setDetail(row); setCompany(null); setEditing(false); setShowAnalysis(false); }
  function backToList() { setDetail(null); setCompany(null); setEditing(false); setShowAnalysis(false); }

  async function handleSaveNew(values) {
    setSaving(true); setErr('');
    try {
      const { error } = await supabase.from('crm_customers').insert([{ ...values, poslovalnica: 0 }]);
      if (error) throw error;
      setCreating(false); setFlash('✓ Stranka dodana'); load(true);
    } catch (e) { setErr(e.message || 'Napaka pri shranjevanju.'); }
    finally { setSaving(false); }
  }

  async function handleSaveEdit(values) {
    setSaving(true); setErr('');
    try {
      const { error } = await supabase.from('crm_customers').update(values).eq('id', detail.id);
      if (error) throw error;
      setDetail((d) => ({ ...d, ...values }));
      setEditing(false); setFlash('✓ Stranka posodobljena'); load(true);
    } catch (e) { setErr(e.message || 'Napaka pri shranjevanju.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(c) {
    if (!confirm(`Izbrišem stranko "${c.naziv}"? Tega ni mogoče razveljaviti.`)) return;
    try {
      const { error } = await supabase.from('crm_customers').delete().eq('id', c.id);
      if (error) throw error;
      setFlash('Stranka izbrisana'); backToList(); load(true);
    } catch (e) { setErr(e.message || 'Napaka pri brisanju.'); }
  }

  const banners = (
    <>
      {flash && (
        <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span className="text-sm font-semibold flex-1">{flash}</span>
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span className="text-sm flex-1">{err}</span>
          <button onClick={() => setErr('')} className="text-as-gray-500"><X className="w-4 h-4" /></button>
        </div>
      )}
    </>
  );

  // ── DETAJL ENE STRANKE ──
  if (detail) {
    const sibList = siblings.length ? siblings : [detail];
    const sibIds = sibList.map((b) => String(b.id));
    const allVisits = (visits || []).filter((v) => sibIds.includes(String(v.customer_id)));
    const thisVisits = (visits || []).filter((v) => String(v.customer_id) === String(detail.id));
    const multi = sibList.length > 1;
    const scopeVisits = analysisScope === 'this' ? thisVisits : allVisits;
    return (
      <div className="bg-white border border-as-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <button onClick={backToList} className="text-sm font-semibold text-as-gray-500 hover:text-as-gray-700 inline-flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Nazaj na bazo
        </button>
        {banners}
        {editing ? (
          <CustomerForm initial={detail} saving={saving} onCancel={() => setEditing(false)} onSave={handleSaveEdit} />
        ) : (
          <div className="border border-as-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-as-gray-800 text-lg">{detail.naziv}{detail.poslovalnica ? <span className="text-sm text-as-gray-400 font-normal"> · posl. {detail.poslovalnica}</span> : ''}</div>
                <div className="text-sm text-as-gray-500 mt-0.5">{[detail.ulica, detail.posta].filter(Boolean).join(', ') || '—'}{detail.davcna ? ` · DŠ ${detail.davcna}` : ''}{detail.panoga ? ` · ${detail.panoga}` : ''}</div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: CRM_BG, color: CRM_COLOR }}>Uredi</button>
                {isAdmin && <button onClick={() => handleDelete(detail)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50">Izbriši</button>}
              </div>
            </div>
            {(detail.tags && detail.tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {detail.tags.map((t) => <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: CRM_BG, color: CRM_COLOR }}>{t}</span>)}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm mt-3">
              <ProfRow label="Kontakt" value={detail.kontakt_oseba} />
              <ProfRow label="Telefon" value={detail.telefon} href={detail.telefon ? `tel:${detail.telefon}` : null} />
              <ProfRow label="Email" value={detail.email} href={detail.email ? `mailto:${detail.email}` : null} />
              <ProfRow label="Splet" value={detail.splet} href={detail.splet ? (detail.splet.startsWith('http') ? detail.splet : `https://${detail.splet}`) : null} />
              {detail.opombe && <div className="sm:col-span-2"><span className="text-as-gray-400 text-xs">Opombe: </span><span className="text-as-gray-700 whitespace-pre-wrap">{detail.opombe}</span></div>}
            </div>
          </div>
        )}

        {/* Analiza te stranke — privzeto VSE poslovalnice skupaj */}
        {!editing && (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Analiza stranke {detail.naziv}
              </div>
              {multi && (
                <div className="inline-flex rounded-lg border border-as-gray-200 overflow-hidden text-xs font-semibold">
                  <button onClick={() => setAnalysisScope('all')} className="px-3 py-1.5 transition"
                    style={analysisScope === 'all' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>
                    Vse poslovalnice ({sibList.length})
                  </button>
                  <button onClick={() => setAnalysisScope('this')} className="px-3 py-1.5 transition"
                    style={analysisScope === 'this' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>
                    Samo ta{detail.poslovalnica ? ` (posl. ${detail.poslovalnica})` : ''}
                  </button>
                </div>
              )}
            </div>
            <CustomerAnalysis custVisits={scopeVisits} branches={analysisScope === 'all' && multi ? sibList : null} />
          </div>
        )}
      </div>
    );
  }

  // ── IZBIRA POSLOVALNICE + ANALIZA CELEGA PODJETJA ──
  if (company) {
    const branchIds = company.branches.map((b) => String(b.id));
    const compVisits = (visits || []).filter((v) => branchIds.includes(String(v.customer_id)));
    return (
      <div className="bg-white border border-as-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <button onClick={() => setCompany(null)} className="text-sm font-semibold text-as-gray-500 hover:text-as-gray-700 inline-flex items-center gap-1">
          <ChevronRight className="w-4 h-4 rotate-180" /> Nazaj na bazo
        </button>
        {banners}
        <div>
          <div className="font-bold text-as-gray-800 text-lg">{company.naziv}</div>
          <div className="text-xs text-as-gray-500">{company.branches.length} poslovalnic · analiza vseh skupaj</div>
        </div>
        <CustomerAnalysis custVisits={compVisits} branches={company.branches} />
        <div className="pt-1">
          <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Poslovalnice — klikni za podrobno</div>
          <div className="space-y-2">
            {company.branches.map((b) => {
              const n = (visits || []).filter((v) => String(v.customer_id) === String(b.id)).length;
              return (
                <button key={b.id} onClick={() => openDetail(b)}
                  className="w-full text-left border border-as-gray-200 rounded-xl p-3 hover:bg-as-gray-50 transition flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-as-gray-800 text-sm">{b.poslovalnica != null ? `Posl. ${b.poslovalnica}` : 'Glavna'}{b.naziv && b.naziv !== company.naziv ? ` — ${b.naziv}` : ''}</div>
                    <div className="text-xs text-as-gray-500">{[b.ulica, b.posta].filter(Boolean).join(', ') || '—'}</div>
                  </div>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: n ? CRM_COLOR : '#9CA3AF' }}>{n ? `${n} vnosov` : 'ni vnosov'}</span>
                  <ChevronRight className="w-4 h-4 text-as-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── SEZNAM PODJETIJ ──
  return (
    <div className="bg-white border border-as-gray-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-as-gray-700">🗂️ Baza strank</h3>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2" style={{ background: CRM_COLOR }}>
            <Plus className="w-4 h-4" /> Nova stranka
          </button>
        )}
      </div>

      {banners}

      {creating ? (
        <CustomerForm initial={{}} saving={saving} onCancel={() => setCreating(false)} onSave={handleSaveNew} />
      ) : (
        <>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls}
            placeholder="Išči stranko (npr. JAGROS) po nazivu, naslovu ali davčni…" />

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTagFilter(null)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
              style={{ borderColor: tagFilter === null ? CRM_COLOR : '#E5E7EB', background: tagFilter === null ? CRM_BG : '#fff', color: tagFilter === null ? CRM_COLOR : '#6B7280' }}>Vsi</button>
            {filterTags.map((t) => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                style={{ borderColor: tagFilter === t ? CRM_COLOR : '#E5E7EB', background: tagFilter === t ? CRM_BG : '#fff', color: tagFilter === t ? CRM_COLOR : '#6B7280' }}>{t}</button>
            ))}
          </div>

          {loading && list.length === 0 ? <LoadingBox /> : companies.length === 0 ? (
            <div className="text-center py-8 text-as-gray-400 text-sm">Ni najdenih strank.</div>
          ) : (
            <div className="space-y-2">
              {companies.map((comp) => (
                <button key={comp.key} onClick={() => openCompany(comp)}
                  className="w-full text-left border border-as-gray-200 rounded-xl p-3 sm:p-4 hover:bg-as-gray-50 transition flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-as-gray-800">{comp.naziv}</div>
                    <div className="text-xs text-as-gray-500 mt-0.5">
                      {comp.davcna ? `DŠ ${comp.davcna}` : ''}{comp.rows.length > 1 ? `${comp.davcna ? ' · ' : ''}${comp.rows.length} poslovalnic` : ''}{comp.panoga ? ` · ${comp.panoga}` : ''}
                    </div>
                    {(comp.tags && comp.tags.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {comp.tags.map((t) => <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: CRM_BG, color: CRM_COLOR }}>{t}</span>)}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-as-gray-300 flex-shrink-0" />
                </button>
              ))}
              {hasMore && (
                <button onClick={() => load(false)} disabled={loading}
                  className="w-full py-3 rounded-xl border border-as-gray-200 text-sm font-semibold text-as-gray-600 hover:bg-as-gray-50 disabled:opacity-50">
                  {loading ? 'Nalagam…' : 'Naloži več'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Analiza ENE stranke (zgodovina + statistika) ──
function CustomerAnalysis({ custVisits, branches }) {
  const list = (custVisits || []).filter((v) => v.entry_type === 'visit' || v.entry_type === 'call');
  if (list.length === 0) {
    return (
      <div className="bg-as-gray-50 border border-as-gray-200 rounded-xl p-5 text-center">
        <div className="text-sm font-semibold text-as-gray-500">Trenutno še ne aktivna stranka</div>
        <div className="text-xs text-as-gray-400 mt-1">Ko vneseš prvi obisk ali klic, se bo tukaj prikazala zgodovina in statistika.</div>
      </div>
    );
  }
  const sorted = [...list].sort((a, b) => {
    const d = (b.visit_date || '').localeCompare(a.visit_date || '');
    if (d !== 0) return d;
    return (b.arrival_time || '').localeCompare(a.arrival_time || '');
  });

  const kontakti = list.length;
  const obiski = list.filter((v) => v.entry_type === 'visit').length;
  const klici = list.filter((v) => v.entry_type === 'call').length;
  const narocila = list.filter((v) => v.outcome === 'narocilo').length;
  const ponudbe = list.filter((v) => v.outcome === 'ponudba' || v.create_offer).length;
  const brezIzida = kontakti - narocila - ponudbe;
  const minutes = list.reduce((s, v) => s + Number(v.visit_duration_min || v.call_duration_min || diffMinutes(v.arrival_time, v.departure_time) || 0), 0);
  const konverzija = kontakti ? Math.round((narocila / kontakti) * 100) : 0;

  const dates = list.map((v) => v.visit_date).filter(Boolean).sort();
  const prvi = dates[0];
  const zadnji = dates[dates.length - 1];
  let dniOd = null;
  if (zadnji) { dniOd = Math.round((Date.now() - new Date(zadnji + 'T00:00:00').getTime()) / 86400000); }

  // Po prodajalcu
  const bySeller = {};
  list.forEach((v) => { const k = v.created_by_name || v.created_by || '—'; bySeller[k] = (bySeller[k] || 0) + 1; });
  const sellers = Object.entries(bySeller).sort((a, b) => b[1] - a[1]);

  // Po mesecih (zadnjih 12)
  const byMonth = {};
  list.forEach((v) => { if (!v.visit_date) return; const m = v.visit_date.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
  const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxMonth = Math.max(1, ...months.map((m) => m[1]));

  // Po poslovalnici (samo na nivoju podjetja)
  let branchRows = null;
  if (branches && branches.length > 1) {
    branchRows = branches.map((b) => {
      const bl = list.filter((v) => String(v.customer_id) === String(b.id));
      return {
        id: b.id,
        label: (b.poslovalnica != null ? `Posl. ${b.poslovalnica}` : 'Glavna'),
        loc: [b.ulica, b.posta].filter(Boolean).join(', '),
        kontakti: bl.length,
        narocila: bl.filter((v) => v.outcome === 'narocilo').length,
      };
    }).filter((r) => r.kontakti > 0).sort((a, b) => b.kontakti - a.kontakti);
  }

  const KPI = ({ v, l, c }) => (
    <div className="bg-white border border-as-gray-200 rounded-xl p-3 text-center">
      <div className="text-lg font-bold" style={c ? { color: c } : { color: '#374151' }}>{v}</div>
      <div className="text-[11px] text-as-gray-500 leading-tight">{l}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <KPI v={kontakti} l="kontaktov" />
        <KPI v={obiski} l="obiskov" />
        <KPI v={klici} l="klicev" />
        <KPI v={narocila} l="naročil" c="#16A34A" />
        <KPI v={ponudbe} l="ponudb" c="#D97706" />
        <KPI v={(minutes / 60).toFixed(1)} l="ur skupaj" />
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs text-as-gray-500">Uspešnost (naročila)</div>
          <div className="text-base font-bold" style={{ color: CRM_COLOR }}>{konverzija}%</div>
          <div className="h-1.5 bg-as-gray-100 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${konverzija}%`, background: CRM_COLOR }} /></div>
        </div>
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs text-as-gray-500">Zadnji kontakt</div>
          <div className="text-base font-bold text-as-gray-700">{zadnji ? formatDate(zadnji) : '—'}</div>
          <div className="text-xs text-as-gray-400">{dniOd != null ? (dniOd === 0 ? 'danes' : `pred ${dniOd} dni`) : ''}</div>
        </div>
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs text-as-gray-500">Prvi kontakt</div>
          <div className="text-base font-bold text-as-gray-700">{prvi ? formatDate(prvi) : '—'}</div>
          <div className="text-xs text-as-gray-400">{brezIzida} brez izida</div>
        </div>
      </div>

      {/* Po poslovalnici (nivo podjetja) */}
      {branchRows && branchRows.length > 0 && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Po poslovalnici</div>
          <div className="space-y-1.5">
            {branchRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm gap-2">
                <div className="min-w-0">
                  <div className="text-as-gray-700 font-medium">{r.label}</div>
                  {r.loc && <div className="text-xs text-as-gray-400 truncate">{r.loc}</div>}
                </div>
                <span className="text-as-gray-500 text-xs flex-shrink-0 text-right">{r.kontakti} kontaktov · <span style={{ color: '#16A34A' }}>{r.narocila} naročil</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Po prodajalcu */}
      {sellers.length > 0 && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Po prodajalcu</div>
          <div className="space-y-1.5">
            {sellers.map(([name, n]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-as-gray-700">{name}</span>
                <span className="text-as-gray-500 text-xs">{n} kontaktov</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend po mesecih */}
      {months.length > 1 && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-3">
          <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-2">Aktivnost po mesecih</div>
          <div className="flex items-end gap-1 h-20">
            {months.map(([m, n]) => (
              <div key={m} className="flex-1 flex flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t" style={{ height: `${(n / maxMonth) * 100}%`, background: CRM_COLOR, minHeight: '3px' }} title={`${m}: ${n}`} />
                <div className="text-[9px] text-as-gray-400">{m.slice(5)}.{m.slice(2, 4)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zgodovina */}
      <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider pt-1">Zgodovina ({sorted.length})</div>
      {sorted.map((e) => {
        const isCall = e.entry_type === 'call';
        const eIcon = isCall ? (e.channel === 'email' ? '✉️' : '📞') : '📍';
        const dur = isCall ? (e.call_duration_min != null ? e.call_duration_min : null) : diffMinutes(e.arrival_time, e.departure_time);
        const oc = e.outcome === 'narocilo' ? { t: 'Naročilo', c: '#16A34A', b: '#DCFCE7' }
          : e.outcome === 'ponudba' ? { t: 'Ponudba', c: '#D97706', b: '#FEF3C7' } : null;
        const branchTag = (branches && branches.length > 1) ? (branches.find((b) => String(b.id) === String(e.customer_id))) : null;
        return (
          <div key={e.id} className="bg-white border border-as-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{eIcon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-as-gray-800">{formatDate(e.visit_date)}</span>
                  <span className="text-as-gray-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(e.arrival_time)}{e.departure_time ? ' – ' + formatTime(e.departure_time) : ''}</span>
                  {dur != null && dur >= 0 && <span className="text-xs font-semibold" style={{ color: '#0E7490' }}>{formatMinutes(dur)}</span>}
                  {oc && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: oc.c, background: oc.b }}>{oc.t}</span>}
                  {branchTag && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-500">{branchTag.poslovalnica != null ? `Posl. ${branchTag.poslovalnica}` : 'Glavna'}</span>}
                </div>
                {e.notes && <div className="text-sm text-as-gray-600 mt-1.5 whitespace-pre-wrap">{e.notes}</div>}
                {e.offer_description && (
                  <div className="text-xs text-as-gray-500 mt-1.5 bg-yellow-50 border border-yellow-200 rounded p-2">
                    <strong>Ponudba:</strong> {e.offer_description}{e.offer_due_date && <> · rok {formatDate(e.offer_due_date)}</>}
                  </div>
                )}
                <div className="text-xs text-as-gray-400 mt-1">Vnesel: {e.created_by_name || e.created_by || '—'}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerForm({ initial, onSave, onCancel, saving }) {
  const [naziv, setNaziv] = useState(initial.naziv || '');
  const [ulica, setUlica] = useState(initial.ulica || '');
  const [posta, setPosta] = useState(initial.posta || '');
  const [davcna, setDavcna] = useState(initial.davcna || '');
  const [panoga, setPanoga] = useState(initial.panoga || '');
  const [kontakt, setKontakt] = useState(initial.kontakt_oseba || '');
  const [email, setEmail] = useState(initial.email || '');
  const [telefon, setTelefon] = useState(initial.telefon || '');
  const [splet, setSplet] = useState(initial.splet || '');
  const [opombe, setOpombe] = useState(initial.opombe || '');
  const [tags, setTags] = useState(Array.isArray(initial.tags) ? initial.tags : []);
  const [newTag, setNewTag] = useState('');

  function toggleTag(t) { setTags((arr) => arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]); }
  function addCustomTag() { const t = newTag.trim(); if (!t) return; setTags((arr) => arr.includes(t) ? arr : [...arr, t]); setNewTag(''); }

  function submit(e) {
    e.preventDefault();
    if (!naziv.trim()) return;
    onSave({
      naziv: naziv.trim(),
      ulica: ulica.trim() || null,
      posta: posta.trim() || null,
      davcna: davcna.trim() || null,
      panoga: panoga.trim() || null,
      kontakt_oseba: kontakt.trim() || null,
      email: email.trim() || null,
      telefon: telefon.trim() || null,
      splet: splet.trim() || null,
      opombe: opombe.trim() || null,
      tags,
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-dashed rounded-xl p-4 space-y-3" style={{ borderColor: CRM_BG, background: '#fffdf9' }}>
      <div className="text-sm font-bold text-as-gray-800">{initial.id ? `Uredi: ${initial.naziv}` : '➕ Nova stranka'}</div>
      <div>
        <label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Naziv *</label>
        <input className={inputCls} value={naziv} onChange={(e) => setNaziv(e.target.value)} placeholder="Naziv stranke" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Ulica</label><input className={inputCls} value={ulica} onChange={(e) => setUlica(e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Pošta</label><input className={inputCls} value={posta} onChange={(e) => setPosta(e.target.value)} placeholder="npr. 3000 Celje" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Davčna</label><input className={inputCls} value={davcna} onChange={(e) => setDavcna(e.target.value)} placeholder="brez SI" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Panoga</label><input className={inputCls} value={panoga} onChange={(e) => setPanoga(e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Kontaktna oseba</label><input className={inputCls} value={kontakt} onChange={(e) => setKontakt(e.target.value)} /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Telefon</label><input className={inputCls} value={telefon} onChange={(e) => setTelefon(e.target.value)} inputMode="tel" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Email</label><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" /></div>
        <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Spletna stran</label><input className={inputCls} value={splet} onChange={(e) => setSplet(e.target.value)} placeholder="npr. www.stranka.si" /></div>
      </div>
      <div><label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1">Opombe</label><textarea rows={2} className={inputCls + ' resize-none'} value={opombe} onChange={(e) => setOpombe(e.target.value)} /></div>
      <div>
        <label className="block text-xs font-semibold text-as-gray-600 uppercase mb-1.5">Tagi</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[...new Set([...CUSTOMER_TAGS, ...tags])].map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border transition"
                style={{ borderColor: on ? CRM_COLOR : '#E5E7EB', background: on ? CRM_BG : '#fff', color: on ? CRM_COLOR : '#6B7280' }}>
                {on ? '✓ ' : ''}{t}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input className={inputCls} value={newTag} onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }} placeholder="Dodaj svoj tag…" />
          <button type="button" onClick={addCustomTag} className="px-4 rounded-xl text-sm font-semibold flex-shrink-0" style={{ background: CRM_BG, color: CRM_COLOR }}>Dodaj</button>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 justify-center px-4 py-3 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Shrani stranko
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-3 text-sm font-semibold rounded-xl border border-as-gray-200 text-as-gray-600">Prekliči</button>
      </div>
    </form>
  );
}

// ─── PLANIRANJE POTI (komercialist pripravi obiske + zadnji 3 vnosi) ───
// ── Slovenske regije iz poštne številke (po razponih) ──
function postFromPosta(posta) { const m = String(posta || '').match(/(\d{4})/); return m ? m[1] : null; }
function regionFromPosta(posta) {
  const p = postFromPosta(posta);
  if (!p) return null;
  const n = parseInt(p, 10);
  // Prlekija (Ormož + Ljutomer/G. Radgona)
  if ((n >= 2270 && n <= 2279) || (n >= 9240 && n <= 9265)) return 'Prlekija';
  // Prekmurje (ostali 9xxx)
  if (n >= 9000) return 'Prekmurje';
  // Koroška
  if (n >= 2360 && n <= 2399) return 'Koroška';
  // Štajerska / Podravje (Maribor, Ptuj, Slov. Bistrica)
  if (n >= 2000 && n <= 2359) return 'Štajerska (Maribor)';
  // Savinjska (Celje)
  if (n >= 3000 && n <= 3342) return 'Savinjska (Celje)';
  // Gorenjska
  if (n >= 4000 && n <= 4299) return 'Gorenjska';
  // Goriška
  if (n >= 5000 && n <= 5299) return 'Goriška';
  // Notranjska (Postojna, Pivka, Il. Bistrica, Cerknica)
  if ((n >= 1380 && n <= 1386) || (n >= 6230 && n <= 6258)) return 'Notranjska';
  // Obala–Kras
  if (n >= 6000 && n <= 6333) return 'Obala–Kras';
  // Zasavje
  if (n >= 1410 && n <= 1439) return 'Zasavje';
  // Bela krajina
  if (n >= 8330 && n <= 8345) return 'Bela krajina';
  // Posavje
  if (n >= 8250 && n <= 8299) return 'Posavje';
  // Dolenjska
  if (n >= 8000 && n <= 8362) return 'Dolenjska';
  // Osrednja / Ljubljana
  if (n >= 1000 && n <= 1399) return 'Osrednja (Ljubljana)';
  return 'Drugo';
}
function krajFromPosta(posta) {
  const s = String(posta || '').trim();
  if (!s) return null;
  const m = s.match(/^\s*\d{4}\s+(.+)$/);
  return ((m ? m[1] : s).trim()) || null;
}
// Normaliziran ključ kraja (ne glede na velike/male črke + presledke)
function normKraj(k) { return String(k || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function titleKraj(k) {
  const small = new Set(['pri', 'ob', 'na', 'v', 'nad', 'pod', 'za', 'in', 'pri']);
  return String(k || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
    .map((w, i) => (i > 0 && small.has(w)) ? w : (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Razponi poštnih številk po regijah (hi je izključen) — za poizvedbo v bazi
const REGION_BOUNDS = {
  'Osrednja (Ljubljana)': [['1000', '1380']],
  'Zasavje': [['1410', '1440']],
  'Notranjska': [['1380', '1387'], ['6230', '6259']],
  'Štajerska (Maribor)': [['2000', '2270'], ['2280', '2360']],
  'Prlekija': [['2270', '2280'], ['9240', '9266']],
  'Koroška': [['2360', '2400']],
  'Savinjska (Celje)': [['3000', '3343']],
  'Gorenjska': [['4000', '4300']],
  'Goriška': [['5000', '5300']],
  'Obala–Kras': [['6000', '6230'], ['6259', '6334']],
  'Prekmurje': [['9000', '9240'], ['9266', '9500']],
  'Bela krajina': [['8330', '8346']],
  'Posavje': [['8250', '8300']],
  'Dolenjska': [['8000', '8250'], ['8300', '8330'], ['8346', '8363']],
};
const ALL_REGIONS = Object.keys(REGION_BOUNDS);
function regionOrFilter(region) {
  const b = REGION_BOUNDS[region] || [];
  return b.map(([lo, hi]) => `and(posta.gte.${lo},posta.lt.${hi})`).join(',');
}

function AreaPicker({ onSelect }) {
  const [rows, setRows] = useState([]);     // vse stranke izbrane regije (vse poslovalnice)
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');
  const [kraj, setKraj] = useState('');
  // Dodajanje nove stranke
  const [addNew, setAddNew] = useState(false);
  const [nNaziv, setNNaziv] = useState('');
  const [nUlica, setNUlica] = useState('');
  const [nPosta, setNPosta] = useState('');
  const [nDavcna, setNDavcna] = useState('');
  const [nPanoga, setNPanoga] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addErr, setAddErr] = useState('');

  async function saveNew() {
    const naziv = nNaziv.trim();
    if (!naziv) { setAddErr('Vnesi naziv stranke.'); return; }
    setSavingNew(true); setAddErr('');
    try {
      const davcna = nDavcna.trim() || null;
      if (davcna) {
        const { data: ex } = await supabase
          .from('crm_customers')
          .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
          .eq('davcna', davcna)
          .order('poslovalnica', { ascending: true })
          .limit(1);
        if (ex && ex.length > 0) { setAddNew(false); onSelect(ex[0]); return; }
      }
      const { data, error } = await supabase
        .from('crm_customers')
        .insert([{ naziv, ulica: nUlica.trim() || null, posta: nPosta.trim() || null, davcna, panoga: nPanoga.trim() || null, poslovalnica: 0 }])
        .select('id,naziv,ulica,posta,davcna,panoga,poslovalnica')
        .single();
      if (error) throw error;
      setAddNew(false);
      onSelect(data);
    } catch (e) {
      setAddErr(e.message || 'Napaka pri shranjevanju stranke.');
    } finally {
      setSavingNew(false);
    }
  }


  // Naloži VSE stranke regije v straneh po 1000 (brez abecednega odreza)
  useEffect(() => {
    if (!region) { setRows([]); setKraj(''); return; }
    let active = true;
    (async () => {
      setLoading(true); setKraj('');
      const orStr = regionOrFilter(region);
      let acc = [];
      for (let page = 0; page < 10; page++) {
        let q = supabase.from('crm_customers').select('id,naziv,ulica,posta,davcna,poslovalnica');
        if (orStr) q = q.or(orStr);
        q = q.order('posta', { ascending: true }).order('naziv', { ascending: true }).range(page * 1000, page * 1000 + 999);
        const { data, error } = await q;
        if (error) break;
        acc = acc.concat(data || []);
        if (!data || data.length < 1000) break;
      }
      if (active) { setRows(acc); setLoading(false); }
    })();
    return () => { active = false; };
  }, [region]);

  const kraji = useMemo(() => {
    const map = new Map(); // normKey -> lep prikaz
    rows.forEach((c) => {
      const k = krajFromPosta(c.posta); if (!k) return;
      const key = normKraj(k);
      if (!map.has(key)) map.set(key, titleKraj(k));
    });
    return [...map.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'sl'));
  }, [rows]);

  // Vsaka poslovalnica je svoja vrstica; po izbiri kraja filtriramo
  const list = useMemo(() => {
    return rows
      .filter((c) => !kraj || normKraj(krajFromPosta(c.posta)) === kraj)
      .sort((a, b) => a.naziv.localeCompare(b.naziv, 'sl') || (a.poslovalnica || 0) - (b.poslovalnica || 0));
  }, [rows, kraj]);

  if (addNew) {
    return (
      <div className="border border-as-gray-200 rounded-xl p-4 bg-as-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-as-gray-800">➕ Nova stranka</div>
          <button type="button" onClick={() => setAddNew(false)} className="text-as-gray-400 hover:text-as-gray-700 text-xs font-semibold">Prekliči</button>
        </div>
        {addErr && <div className="text-xs text-red-600">{addErr}</div>}
        <div>
          <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Naziv *</label>
          <input type="text" value={nNaziv} onChange={(e) => setNNaziv(e.target.value)} className={inputCls} placeholder="Naziv stranke" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Ulica</label>
            <input type="text" value={nUlica} onChange={(e) => setNUlica(e.target.value)} className={inputCls} placeholder="Ulica in hišna št." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Pošta</label>
            <input type="text" value={nPosta} onChange={(e) => setNPosta(e.target.value)} className={inputCls} placeholder="npr. 3000 Celje" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Davčna</label>
            <input type="text" value={nDavcna} onChange={(e) => setNDavcna(e.target.value)} className={inputCls} placeholder="brez SI" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-as-gray-600 uppercase tracking-wider mb-1.5">Panoga</label>
            <input type="text" value={nPanoga} onChange={(e) => setNPanoga(e.target.value)} className={inputCls} placeholder="neobvezno" />
          </div>
        </div>
        <button type="button" onClick={saveNew} disabled={savingNew}
          className="w-full sm:w-auto justify-center px-4 py-3 text-white text-base font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>
          {savingNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Shrani stranko in izberi
        </button>
        <p className="text-xs text-as-gray-400">Če davčna že obstaja, se izbere obstoječa stranka (brez podvajanja).</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
          <option value="">Izberi regijo…</option>
          {ALL_REGIONS.slice().sort((a, b) => a.localeCompare(b, 'sl')).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={kraj} onChange={(e) => setKraj(e.target.value)} className={inputCls} disabled={!region || loading}>
          <option value="">{region ? `Vsi kraji (${kraji.length})` : 'Najprej regija'}</option>
          {kraji.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="text-sm text-as-gray-400 py-4 text-center">Nalagam stranke…</div>
      ) : !region ? (
        <div className="text-xs text-as-gray-400 py-3 text-center">Izberi regijo za prikaz strank.</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-as-gray-400 py-3 text-center">Ni strank v tem območju.</div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          <div className="text-xs font-semibold text-as-gray-400">{list.length} poslovalnic</div>
          {list.map((c) => (
            <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left px-3 py-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50">
              <div className="text-sm font-medium text-as-gray-800">{c.naziv}{c.poslovalnica ? <span className="text-xs font-normal text-as-gray-400"> · posl. {c.poslovalnica}</span> : ''}</div>
              <div className="text-xs text-as-gray-500">{[c.ulica, c.posta].filter(Boolean).join(', ')}</div>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={() => { setAddErr(''); setNNaziv(''); setNUlica(''); setNPosta(''); setNDavcna(''); setNPanoga(''); setAddNew(true); }}
        className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold inline-flex items-center justify-center gap-2 mt-1" style={{ borderColor: CRM_BG, color: CRM_COLOR }}>
        <Plus className="w-4 h-4" /> Dodaj novo stranko
      </button>
    </div>
  );
}

// Koledar v Planiranju — isti CalendarView kot v Nalogah/prvi strani, prikaže naloge + teren (CRM načrti)
function PlanningCalendar({ currentUser, isAdmin, employees }) {
  const [tasks, setTasks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterPerson, setFilterPerson] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('tasks')
          .select('id,title,due_date,priority,status,assigned_to_emails,created_by_email,company,description')
          .not('due_date', 'is', null).order('due_date', { ascending: true }).limit(3000),
        supabase.from('crm_plans')
          .select('id,plan_date,customer_name,customer_address,prep_notes,status,created_by,created_by_name')
          .order('plan_date', { ascending: true }).limit(3000),
      ]);
      if (active) { setTasks(t || []); setPlans(p || []); }
    })();
    return () => { active = false; };
  }, []);

  const isAssignedToMe = (t) => (t.assigned_to_emails || []).includes(currentUser?.email);
  const getEmployeeName = (email) => (employees.find((e) => e.email === email)?.name) || email;
  const priorityLabels = { high: 'Visoka', medium: 'Srednja', low: 'Nizka' };

  const extraEvents = useMemo(() => {
    return (plans || [])
      .filter((p) => {
        if (!isAdmin && p.created_by !== currentUser?.email) return false;
        if (filterPerson !== 'all' && p.created_by !== filterPerson) return false;
        return true;
      })
      .map((p) => ({
        id: 'plan_' + p.id,
        date: p.plan_date,
        title: (p.status === 'done' ? '✅ ' : '📍 ') + (p.customer_name || 'Obisk'),
        color: '#16A34A',
        sub: p.created_by_name || '',
        detail: [p.customer_address, p.prep_notes && ('Priprava: ' + p.prep_notes)].filter(Boolean).join(' · '),
      }));
  }, [plans, filterPerson, isAdmin, currentUser]);

  return (
    <CalendarView
      tasks={tasks}
      currentUser={currentUser}
      isAdmin={isAdmin}
      isAssignedToMe={isAssignedToMe}
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      calendarMode={calendarMode}
      setCalendarMode={setCalendarMode}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
      filterPerson={filterPerson}
      setFilterPerson={setFilterPerson}
      employees={employees}
      onTaskClick={() => {}}
      getEmployeeName={getEmployeeName}
      priorityLabels={priorityLabels}
      extraEvents={extraEvents}
    />
  );
}

function PlanningView({ currentUser, isAdmin, employees }) {
  const toDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [day, setDay] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDayKey(d); }); // privzeto jutri
  const [stops, setStops] = useState([]);
  const [history, setHistory] = useState({}); // customer_id -> [zadnji 3 vnosi]
  const [histOpen, setHistOpen] = useState({}); // stopId -> bool (prikaži vse + cela besedila)
  const [histFull, setHistFull] = useState({}); // customer_id -> vsi vnosi
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState('search'); // 'search' | 'area'
  const [picked, setPicked] = useState(null);
  const [prep, setPrep] = useState('');
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState('me');
  const [editId, setEditId] = useState(null);
  const [editPrep, setEditPrep] = useState('');
  const [planMode, setPlanMode] = useState('route'); // 'route' | 'calendar'

  async function loadHistory(custIds) {
    const ids = [...new Set(custIds.filter(Boolean).map(String))];
    if (ids.length === 0) { setHistory({}); return; }
    const { data } = await supabase.from('crm_visits')
      .select('id,customer_id,entry_type,visit_date,arrival_time,departure_time,outcome,notes,channel,created_by_name')
      .in('customer_id', ids)
      .order('visit_date', { ascending: false })
      .order('arrival_time', { ascending: false });
    const map = {};
    (data || []).forEach((v) => {
      const k = String(v.customer_id);
      if (!map[k]) map[k] = [];
      if (map[k].length < 3) map[k].push(v);
    });
    setHistory(map);
  }

  async function toggleHistFull(s) {
    const id = s.id;
    if (histOpen[id]) { setHistOpen((p) => ({ ...p, [id]: false })); return; }
    const cid = String(s.customer_id);
    if (!histFull[cid]) {
      const { data } = await supabase.from('crm_visits')
        .select('id,customer_id,entry_type,visit_date,arrival_time,departure_time,outcome,notes,channel,created_by_name')
        .eq('customer_id', cid)
        .order('visit_date', { ascending: false })
        .order('arrival_time', { ascending: false });
      setHistFull((p) => ({ ...p, [cid]: data || [] }));
    }
    setHistOpen((p) => ({ ...p, [id]: true }));
  }
  async function load() {
    setLoading(true); setErr('');
    try {
      let q = supabase.from('crm_plans').select('*').eq('plan_date', day).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      if (!(isAdmin && scope === 'all')) q = q.eq('created_by', currentUser?.email);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      setStops(rows);
      loadHistory(rows.map((r) => r.customer_id));
    } catch (e) { setErr(e.message || 'Napaka pri nalaganju.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [day, scope]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(''), 2500); return () => clearTimeout(t); }, [flash]);

  async function addStop() {
    if (!picked) { setErr('Najprej izberi stranko.'); return; }
    setSaving(true); setErr('');
    try {
      const { error } = await supabase.from('crm_plans').insert([{
        plan_date: day,
        customer_id: picked.id ? String(picked.id) : null,
        customer_name: picked.naziv,
        customer_address: [picked.ulica, picked.posta].filter(Boolean).join(', ') || null,
        poslovalnica: picked.poslovalnica ?? null,
        prep_notes: prep.trim() || null,
        status: 'open',
        sort_order: stops.length,
        created_by: currentUser?.email,
        created_by_name: currentUser?.name,
      }]);
      if (error) throw error;
      setPicked(null); setPrep(''); setAdding(false); setFlash('✓ Stranka dodana na pot'); load();
    } catch (e) { setErr(e.message || 'Napaka pri shranjevanju.'); }
    finally { setSaving(false); }
  }
  async function toggleDone(s) {
    const ns = s.status === 'done' ? 'open' : 'done';
    setStops(stops.map((x) => x.id === s.id ? { ...x, status: ns } : x));
    await supabase.from('crm_plans').update({ status: ns, updated_at: new Date().toISOString() }).eq('id', s.id);
  }
  async function removeStop(s) {
    if (!confirm(`Odstranim ${s.customer_name} s poti?`)) return;
    setStops(stops.filter((x) => x.id !== s.id));
    await supabase.from('crm_plans').delete().eq('id', s.id);
  }
  async function saveEdit(s) {
    setStops(stops.map((x) => x.id === s.id ? { ...x, prep_notes: editPrep.trim() || null } : x));
    setEditId(null);
    await supabase.from('crm_plans').update({ prep_notes: editPrep.trim() || null, updated_at: new Date().toISOString() }).eq('id', s.id);
  }
  async function repeatRoute(offset) {
    if (stops.length === 0) return;
    const [y, m, d] = day.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() + offset);
    const target = dt.toISOString().slice(0, 10);
    if (!confirm(`Kopiram ${stops.length} strank na ${target.split('-').reverse().join('. ')}?`)) return;
    const rows = stops.map((s, i) => ({
      plan_date: target,
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_address: s.customer_address,
      poslovalnica: s.poslovalnica,
      prep_notes: s.prep_notes,
      status: 'open',
      sort_order: i,
      created_by: currentUser?.email,
      created_by_name: currentUser?.name,
    }));
    const { error } = await supabase.from('crm_plans').insert(rows);
    if (error) { setErr(error.message || 'Napaka pri kopiranju.'); return; }
    setFlash(`✓ Pot kopirana na ${target.split('-').reverse().join('. ')}`);
    setDay(target);
  }
  async function move(s, dir) {
    const idx = stops.findIndex((x) => x.id === s.id);
    const j = idx + dir;
    if (j < 0 || j >= stops.length) return;
    const arr = [...stops];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setStops(arr);
    await Promise.all(arr.map((x, i) => supabase.from('crm_plans').update({ sort_order: i }).eq('id', x.id)));
  }

  const dayLabel = (() => {
    const d = new Date(day + 'T00:00:00');
    const dni = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
    return `${dni[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  })();
  function shiftDay(dir) { const [y, m, d] = day.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() + dir); setDay(dt.toISOString().slice(0, 10)); }

  const openCount = stops.filter((s) => s.status !== 'done').length;

  const PlanToggle = (
    <div className="inline-flex rounded-lg border border-as-gray-200 overflow-hidden text-sm font-semibold">
      <button onClick={() => setPlanMode('route')} className="px-4 py-2 inline-flex items-center gap-1.5" style={planMode === 'route' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>🗺️ Pot</button>
      <button onClick={() => setPlanMode('calendar')} className="px-4 py-2 inline-flex items-center gap-1.5" style={planMode === 'calendar' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>📅 Koledar</button>
    </div>
  );

  if (planMode === 'calendar') {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {PlanToggle}
        <PlanningCalendar currentUser={currentUser} isAdmin={isAdmin} employees={employees} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {PlanToggle}
      <div className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => shiftDay(-1)} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronRight className="w-5 h-5 rotate-180 text-as-gray-500" /></button>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm" />
          <button onClick={() => shiftDay(1)} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronRight className="w-5 h-5 text-as-gray-500" /></button>
          <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setDay(toDayKey(d)); }} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: CRM_BG, color: CRM_COLOR }}>Jutri</button>
        </div>
        <div className="mt-2 font-bold text-as-gray-800">🗺️ Pot za {dayLabel} <span className="text-sm font-normal text-as-gray-400">· {openCount} obiskov</span></div>
        {isAdmin && (
          <div className="inline-flex rounded-lg border border-as-gray-200 overflow-hidden text-xs font-semibold mt-2">
            <button onClick={() => setScope('me')} className="px-3 py-1.5" style={scope === 'me' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>Moja pot</button>
            <button onClick={() => setScope('all')} className="px-3 py-1.5" style={scope === 'all' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>Vsi komercialisti</button>
          </div>
        )}
        {stops.length > 0 && !(isAdmin && scope === 'all') && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-as-gray-500">🔁 Ponovi pot čez:</span>
            {[7, 14, 28].map((n) => (
              <button key={n} onClick={() => repeatRoute(n)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: CRM_BG, color: CRM_COLOR, background: '#fff' }}>{n} dni</button>
            ))}
          </div>
        )}
      </div>

      {flash && <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }}><CheckCircle2 className="w-4 h-4" /><span className="text-sm font-semibold">{flash}</span></div>}
      {err && <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ background: '#fee', borderColor: '#fcc', color: '#900' }}><AlertCircle className="w-4 h-4" /><span className="text-sm flex-1">{err}</span><button onClick={() => setErr('')}><X className="w-4 h-4" /></button></div>}

      {/* Dodaj stranko na pot */}
      {!(isAdmin && scope === 'all') && (
        adding ? (
          <div className="bg-white border-2 border-dashed rounded-2xl p-4 space-y-3" style={{ borderColor: CRM_BG }}>
            <div className="text-sm font-bold text-as-gray-700">Dodaj stranko na pot</div>
            {picked ? (
              <div className="flex items-start justify-between gap-3 border border-as-gray-200 rounded-xl p-3 bg-as-gray-50">
                <div className="min-w-0">
                  <div className="font-semibold text-as-gray-800 truncate">{picked.naziv}{picked.poslovalnica ? <span className="text-xs font-normal text-as-gray-400"> · posl. {picked.poslovalnica}</span> : ''}</div>
                  <div className="text-xs text-as-gray-500 truncate">{[picked.ulica, picked.posta].filter(Boolean).join(', ')}</div>
                </div>
                <button onClick={() => setPicked(null)} className="text-as-gray-400 hover:text-as-gray-600 flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <div className="inline-flex rounded-lg border border-as-gray-200 overflow-hidden text-xs font-semibold">
                  <button onClick={() => setAddMode('search')} className="px-3 py-1.5" style={addMode === 'search' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>🔎 Iskanje</button>
                  <button onClick={() => setAddMode('area')} className="px-3 py-1.5" style={addMode === 'area' ? { background: CRM_COLOR, color: '#fff' } : { color: '#6B7280', background: '#fff' }}>📍 Po kraju / regiji</button>
                </div>
                {addMode === 'search'
                  ? <CustomerPicker selected={null} onSelect={(c) => setPicked(c)} onClear={() => setPicked(null)} />
                  : <AreaPicker onSelect={(c) => setPicked(c)} />}
              </>
            )}
            <FormField label="Kaj jih boš vprašal / pripravil?">
              <textarea value={prep} onChange={(e) => setPrep(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="npr. ponudba za sidra, reklamacija, novi katalog…" />
            </FormField>
            <div className="flex gap-2">
              <button onClick={addStop} disabled={saving || !picked} className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-50" style={{ background: CRM_COLOR }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dodaj na pot</button>
              <button onClick={() => { setAdding(false); setPicked(null); setPrep(''); }} className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-as-gray-200 text-as-gray-600">Prekliči</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ borderColor: CRM_BG, color: CRM_COLOR }}><Plus className="w-4 h-4" /> Dodaj stranko na pot</button>
        )
      )}

      {/* Seznam postankov */}
      {loading ? <LoadingBox /> : stops.length === 0 ? (
        <div className="text-center py-8 text-as-gray-400 text-sm">Za ta dan še ni načrtovanih obiskov.</div>
      ) : (
        <div className="space-y-3">
          {stops.map((s, i) => {
            const done = s.status === 'done';
            const mine = s.created_by === currentUser?.email;
            return (
              <div key={s.id} className="bg-white border border-as-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: CRM_BG, color: CRM_COLOR }}>{i + 1}</span>
                    {(mine || isAdmin) && (
                      <div className="flex flex-col">
                        <button onClick={() => move(s, -1)} className="text-as-gray-300 hover:text-as-gray-600 leading-none">▲</button>
                        <button onClick={() => move(s, 1)} className="text-as-gray-300 hover:text-as-gray-600 leading-none">▼</button>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold ${done ? 'line-through text-as-gray-400' : 'text-as-gray-800'}`}>
                      {s.customer_name}{s.poslovalnica ? <span className="text-xs font-normal text-as-gray-400"> · posl. {s.poslovalnica}</span> : ''}
                    </div>
                    {s.customer_address && <div className="text-xs text-as-gray-500">{s.customer_address}</div>}
                    {(isAdmin && scope === 'all') && <div className="text-xs text-as-gray-400">{s.created_by_name}</div>}

                    {/* Priprava / kaj vprašati */}
                    {editId === s.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea value={editPrep} onChange={(e) => setEditPrep(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(s)} className="px-3 py-1.5 text-white text-xs font-semibold rounded-lg" style={{ background: CRM_COLOR }}>Shrani</button>
                          <button onClick={() => setEditId(null)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-as-gray-200 text-as-gray-600">Prekliči</button>
                        </div>
                      </div>
                    ) : (
                      s.prep_notes && <div className="mt-1.5 text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-as-gray-700"><strong className="text-xs text-yellow-800">Priprava:</strong> {s.prep_notes}</div>
                    )}

                    {/* Zadnji vnosi (z možnostjo branja več) */}
                    <div className="mt-2">
                      <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">Zadnji obiski / klici</div>
                      {(() => {
                        const cid = String(s.customer_id);
                        const isOpen = !!histOpen[s.id];
                        const compact = history[cid] || [];
                        const list = isOpen ? (histFull[cid] || compact) : compact;
                        if (compact.length === 0) return <div className="text-xs text-as-gray-400">Ni zgodovine — nova / neaktivna stranka.</div>;
                        return (
                          <>
                            <div className="space-y-1.5">
                              {list.map((h) => {
                                const ic = h.entry_type === 'call' ? (h.channel === 'email' ? '✉️' : '📞') : '📍';
                                const oc = h.outcome === 'narocilo' ? ' · ✓ naročilo' : h.outcome === 'ponudba' ? ' · ponudba' : '';
                                return (
                                  <div key={h.id} className="text-xs text-as-gray-600 border-l-2 pl-2" style={{ borderColor: CRM_BG }}>
                                    <span className="font-semibold">{ic} {formatDate(h.visit_date)}</span>{oc}
                                    {h.notes && (isOpen
                                      ? <div className="text-as-gray-600 whitespace-pre-wrap mt-0.5">{h.notes}</div>
                                      : <span className="text-as-gray-500"> — {h.notes.length > 90 ? h.notes.slice(0, 90) + '…' : h.notes}</span>)}
                                    {isOpen && h.created_by_name && <div className="text-as-gray-400 mt-0.5">{h.created_by_name}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            <button onClick={() => toggleHistFull(s)} className="mt-1.5 text-xs font-semibold" style={{ color: CRM_COLOR }}>
                              {isOpen ? '▲ Manj' : '▼ Preberi več (vsi vnosi)'}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {(mine || isAdmin) && (
                      <button onClick={() => toggleDone(s)} className="w-7 h-7 rounded border-2 flex items-center justify-center" style={{ borderColor: done ? '#16A34A' : '#D1D5DB', background: done ? '#16A34A' : '#fff' }} title="Obiskano">
                        {done && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </button>
                    )}
                    {mine && editId !== s.id && <button onClick={() => { setEditId(s.id); setEditPrep(s.prep_notes || ''); }} className="text-xs font-semibold px-2 py-1 rounded" style={{ background: CRM_BG, color: CRM_COLOR }}>Uredi</button>}
                    {(mine || isAdmin) && <button onClick={() => removeStop(s)} className="text-xs font-semibold px-2 py-1 rounded text-red-600 hover:bg-red-50">Odstrani</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
