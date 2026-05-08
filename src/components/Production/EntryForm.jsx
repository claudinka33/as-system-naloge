// EntryForm.jsx — Vnos proizvodnje, zastojev in odpadkov
import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Trash2, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react';
import {
  loadMachines, loadProducts, loadWires, loadWorkers,
  loadBreakdownReasons, loadDefectReasons,
  insertProduction, insertBreakdown, insertScrap,
  CATEGORY_LABELS, CATEGORY_ICONS
} from '../../lib/productionApi.js';

const AS_RED = '#C8102E';

export default function EntryForm({ currentUser }) {
  const [shifrants, setShifrants] = useState({
    machines: [], products: [], wires: [], workers: [],
    breakdownReasons: [], defectReasons: []
  });
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState('production'); // 'production' | 'breakdown' | 'scrap'

  useEffect(() => {
    (async () => {
      try {
        const [machines, products, wires, workers, breakdownReasons, defectReasons] = await Promise.all([
          loadMachines(), loadProducts(), loadWires(), loadWorkers(),
          loadBreakdownReasons(), loadDefectReasons()
        ]);
        setShifrants({ machines, products, wires, workers, breakdownReasons, defectReasons });
      } catch (e) {
        console.error('Napaka pri nalaganju šifrantov:', e);
        alert('Napaka pri nalaganju šifrantov.');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
        <span className="ml-2 text-as-gray-500">Nalagam šifrante...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* PROIZVODNJA */}
      <Section
        title="Proizvodnja"
        icon={<Package className="w-5 h-5" />}
        emoji="📦"
        color="#0E7490"
        bgColor="#CFFAFE"
        open={openSection === 'production'}
        onToggle={() => setOpenSection(openSection === 'production' ? null : 'production')}
      >
        <ProductionForm shifrants={shifrants} currentUser={currentUser} />
      </Section>

      {/* ZASTOJ */}
      <Section
        title="Zastoj stroja"
        icon={<AlertTriangle className="w-5 h-5" />}
        emoji="🛑"
        color="#92400E"
        bgColor="#FEF3C7"
        open={openSection === 'breakdown'}
        onToggle={() => setOpenSection(openSection === 'breakdown' ? null : 'breakdown')}
      >
        <BreakdownForm shifrants={shifrants} currentUser={currentUser} />
      </Section>

      {/* ODPADEK */}
      <Section
        title="Odpadek"
        icon={<Trash2 className="w-5 h-5" />}
        emoji="🗑️"
        color="#7C2D12"
        bgColor="#FED7AA"
        open={openSection === 'scrap'}
        onToggle={() => setOpenSection(openSection === 'scrap' ? null : 'scrap')}
      >
        <ScrapForm shifrants={shifrants} currentUser={currentUser} />
      </Section>
    </div>
  );
}

// ===== Section wrapper =====
function Section({ title, icon, emoji, color, bgColor, open, onToggle, children }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-as-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: bgColor, color }}
          >
            {emoji}
          </div>
          <div className="text-left">
            <div className="font-bold text-as-gray-700">{title}</div>
            <div className="text-xs text-as-gray-400">Klikni za vnos</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-as-gray-400" /> : <ChevronDown className="w-5 h-5 text-as-gray-400" />}
      </button>
      {open && <div className="border-t border-as-gray-100 p-5">{children}</div>}
    </div>
  );
}

// ===== PRODUCTION FORM =====
function ProductionForm({ shifrants, currentUser }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today, shift: 1, machine_id: '', product_id: '', quantity: '', worker_id: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredProducts = form.machine_id
    ? shifrants.products.filter(p => {
        const machine = shifrants.machines.find(m => m.id === Number(form.machine_id));
        return machine ? p.category === machine.category : true;
      })
    : shifrants.products;

  const handleSubmit = async () => {
    if (!form.machine_id || !form.product_id || !form.quantity) {
      alert('Izpolni vsa obvezna polja: stroj, izdelek, količina.');
      return;
    }
    setSaving(true);
    try {
      await insertProduction({
        date: form.date,
        shift: Number(form.shift),
        machine_id: Number(form.machine_id),
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        worker_id: form.worker_id ? Number(form.worker_id) : null,
        notes: form.notes || null,
        entered_by_email: currentUser.email,
        entered_by_name: currentUser.name,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      // Reset form (ohranimo datum, izmeno, stroj za hitri zaporedni vnos)
      setForm({ ...form, product_id: '', quantity: '', worker_id: '', notes: '' });
    } catch (e) {
      console.error(e);
      alert('Napaka pri shranjevanju: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Datum *" required>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
        </Field>
        <Field label="Izmena *" required>
          <select value={form.shift} onChange={e => setForm({...form, shift: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
            <option value={1}>1. izmena</option>
            <option value={2}>2. izmena</option>
          </select>
        </Field>
      </div>

      <Field label="Stroj *" required>
        <select value={form.machine_id} onChange={e => setForm({...form, machine_id: e.target.value, product_id: ''})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
          <option value="">— Izberi stroj —</option>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const machines = shifrants.machines.filter(m => m.category === cat);
            if (machines.length === 0) return null;
            return (
              <optgroup key={cat} label={`${CATEGORY_ICONS[cat]} ${label}`}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            );
          })}
        </select>
      </Field>

      <Field label="Izdelek *" required>
        <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
          <option value="">— Izberi izdelek —</option>
          {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <Field label="Količina (kosov) *" required>
        <input type="number" inputMode="numeric" placeholder="npr. 120000" value={form.quantity}
          onChange={e => setForm({...form, quantity: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
      </Field>

      <Field label="Delavec (neobvezno)">
        <select value={form.worker_id} onChange={e => setForm({...form, worker_id: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
          <option value="">— Brez —</option>
          {shifrants.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>

      <Field label="Opombe (neobvezno)">
        <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
      </Field>

      <SubmitButton onClick={handleSubmit} saving={saving} success={success} label="Shrani proizvodnjo" />
    </div>
  );
}

// ===== BREAKDOWN FORM =====
function BreakdownForm({ shifrants, currentUser }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today, machine_id: '', reason_id: '', description: '', repair_action: '',
    duration_min: '', frequency: 1, repaired_by: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!form.machine_id || !form.duration_min) {
      alert('Izpolni vsaj stroj in trajanje.');
      return;
    }
    setSaving(true);
    try {
      await insertBreakdown({
        date: form.date,
        machine_id: Number(form.machine_id),
        reason_id: form.reason_id ? Number(form.reason_id) : null,
        description: form.description || null,
        repair_action: form.repair_action || null,
        duration_min: Number(form.duration_min),
        frequency: Number(form.frequency) || 1,
        repaired_by: form.repaired_by || null,
        entered_by_email: currentUser.email,
        entered_by_name: currentUser.name,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setForm({ ...form, description: '', repair_action: '', duration_min: '', frequency: 1, repaired_by: '' });
    } catch (e) {
      console.error(e);
      alert('Napaka pri shranjevanju: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Datum *" required>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
        <Field label="Trajanje (min) *" required>
          <input type="number" inputMode="numeric" placeholder="npr. 60" value={form.duration_min}
            onChange={e => setForm({...form, duration_min: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
      </div>

      <Field label="Stroj *" required>
        <select value={form.machine_id} onChange={e => setForm({...form, machine_id: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
          <option value="">— Izberi stroj —</option>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const machines = shifrants.machines.filter(m => m.category === cat);
            if (machines.length === 0) return null;
            return (
              <optgroup key={cat} label={`${CATEGORY_ICONS[cat]} ${label}`}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            );
          })}
        </select>
      </Field>

      <Field label="Razlog (kategorija)">
        <select value={form.reason_id} onChange={e => setForm({...form, reason_id: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
          <option value="">— Izberi razlog —</option>
          {shifrants.breakdownReasons.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Opis okvare">
        <textarea rows={2} placeholder="npr. Zlomljene vzmeti na 5. postaji"
          value={form.description} onChange={e => setForm({...form, description: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
      </Field>

      <Field label="Opravljeno delo / popravilo">
        <textarea rows={2} placeholder="npr. Menjava špancang, vzmeti, matrice, igle"
          value={form.repair_action} onChange={e => setForm({...form, repair_action: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pogostost">
          <input type="number" inputMode="numeric" min={1} value={form.frequency}
            onChange={e => setForm({...form, frequency: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
        <Field label="Napako odpravil">
          <input type="text" placeholder="npr. Augustinčič" value={form.repaired_by}
            onChange={e => setForm({...form, repaired_by: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
      </div>

      <SubmitButton onClick={handleSubmit} saving={saving} success={success} label="Shrani zastoj" />
    </div>
  );
}

// ===== SCRAP FORM =====
function ScrapForm({ shifrants, currentUser }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    date: today, machine_id: '', product_id: '', wire_id: '', weight_kg: '',
    defect_reason_id: '', worker_id: '', lot_number: '', work_order: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredProducts = form.machine_id
    ? shifrants.products.filter(p => {
        const machine = shifrants.machines.find(m => m.id === Number(form.machine_id));
        return machine ? p.category === machine.category : true;
      })
    : shifrants.products;

  const handleSubmit = async () => {
    if (!form.machine_id || !form.weight_kg) {
      alert('Izpolni vsaj stroj in težo.');
      return;
    }
    setSaving(true);
    try {
      await insertScrap({
        date: form.date,
        machine_id: Number(form.machine_id),
        product_id: form.product_id ? Number(form.product_id) : null,
        wire_id: form.wire_id ? Number(form.wire_id) : null,
        weight_kg: Number(form.weight_kg),
        defect_reason_id: form.defect_reason_id ? Number(form.defect_reason_id) : null,
        worker_id: form.worker_id ? Number(form.worker_id) : null,
        lot_number: form.lot_number || null,
        work_order: form.work_order || null,
        notes: form.notes || null,
        entered_by_email: currentUser.email,
        entered_by_name: currentUser.name,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setForm({ ...form, product_id: '', wire_id: '', weight_kg: '', defect_reason_id: '',
        worker_id: '', lot_number: '', work_order: '', notes: '' });
    } catch (e) {
      console.error(e);
      alert('Napaka pri shranjevanju: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Datum *" required>
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
        <Field label="Teža (kg) *" required>
          <input type="number" inputMode="decimal" step="0.01" placeholder="npr. 135"
            value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
      </div>

      <Field label="Stroj *" required>
        <select value={form.machine_id} onChange={e => setForm({...form, machine_id: e.target.value, product_id: ''})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
          <option value="">— Izberi stroj —</option>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const machines = shifrants.machines.filter(m => m.category === cat);
            if (machines.length === 0) return null;
            return (
              <optgroup key={cat} label={`${CATEGORY_ICONS[cat]} ${label}`}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            );
          })}
        </select>
      </Field>

      <Field label="Izdelek">
        <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
          <option value="">— Izberi izdelek —</option>
          {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Žica">
          <select value={form.wire_id} onChange={e => setForm({...form, wire_id: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
            <option value="">— Brez —</option>
            {shifrants.wires.map(w => <option key={w.id} value={w.id}>{w.code}</option>)}
          </select>
        </Field>
        <Field label="Razlog napake">
          <select value={form.defect_reason_id} onChange={e => setForm({...form, defect_reason_id: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
            <option value="">— Izberi —</option>
            {shifrants.defectReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Delavec">
          <select value={form.worker_id} onChange={e => setForm({...form, worker_id: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg">
            <option value="">— Brez —</option>
            {shifrants.workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="LOT žice">
          <input type="text" placeholder="npr. 503285" value={form.lot_number}
            onChange={e => setForm({...form, lot_number: e.target.value})}
            className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
        </Field>
      </div>

      <Field label="Nalog">
        <input type="text" placeholder="npr. 20012" value={form.work_order}
          onChange={e => setForm({...form, work_order: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
      </Field>

      <Field label="Opombe">
        <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
          className="w-full px-3 py-2 border border-as-gray-200 rounded-lg" />
      </Field>

      <SubmitButton onClick={handleSubmit} saving={saving} success={success} label="Shrani odpadek" />
    </div>
  );
}

// ===== Pomožni komponenti =====
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-as-gray-600 mb-1">
        {label} {required && <span className="text-as-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function SubmitButton({ onClick, saving, success, label }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || success}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-semibold transition shadow-md disabled:opacity-60"
      style={{ backgroundColor: success ? '#16A34A' : AS_RED }}
    >
      {saving ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Shranjujem...</>
      ) : success ? (
        <><CheckCircle2 className="w-5 h-5" /> Shranjeno!</>
      ) : (
        <>{label}</>
      )}
    </button>
  );
}
