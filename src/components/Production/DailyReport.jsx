// DailyReport.jsx — Dnevno poročilo proizvodnje + uredi/zbriši do 7 dni
import React, { useState, useEffect } from 'react';
import { Calendar, Package, AlertTriangle, Trash2, Loader2, Download, Edit2, X, Save, Lock } from 'lucide-react';
import { getDailyData, formatNumber, formatDate, CATEGORY_LABELS, CATEGORY_ICONS } from '../../lib/productionApi.js';
import { supabase } from '../../supabase.js';

const AS_RED = '#C8102E';

// Ali je datum znotraj 7 dni nazaj?
function isWithin7Days(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDate = new Date(dateStr);
  entryDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

export default function DailyReport() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState({ production: [], breakdowns: [], scrap: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { type: 'production'|'breakdown'|'scrap', entry: {...} }

  const canEdit = isWithin7Days(date);

  const reload = async () => {
    setLoading(true);
    try {
      const result = await getDailyData(date);
      setData(result);
    } catch (e) {
      console.error(e);
      alert('Napaka pri nalaganju: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [date]);

  const handleDelete = async (type, id) => {
    if (!canEdit) { alert('Vnosi starejši od 7 dni so zaklenjeni.'); return; }
    if (!confirm('Resnično zbrišem ta vnos?')) return;
    const table = type === 'production' ? 'production_entries' : (type === 'breakdown' ? 'machine_breakdowns' : 'production_scrap');
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      reload();
    } catch (e) {
      alert('Napaka: ' + e.message);
    }
  };

  // Računi
  const totalProduced = data.production.reduce((s, e) => s + (e.quantity || 0), 0);
  const totalBreakdownMin = data.breakdowns.reduce((s, e) => s + (e.duration_min || 0), 0);
  const totalScrapKg = data.scrap.reduce((s, e) => s + (Number(e.weight_kg) || 0), 0);

  // Grupacija proizvodnje po kategoriji
  const productionByCategory = {};
  data.production.forEach(e => {
    const cat = e.production_machines?.category || 'drugo';
    if (!productionByCategory[cat]) productionByCategory[cat] = [];
    productionByCategory[cat].push(e);
  });

  // Top razlogi zastojev
  const breakdownByReason = {};
  data.breakdowns.forEach(e => {
    const reason = e.breakdown_reasons?.name || e.description || 'Drugo';
    breakdownByReason[reason] = (breakdownByReason[reason] || 0) + (e.duration_min || 0);
  });
  const topBreakdowns = Object.entries(breakdownByReason).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Top napake odpadkov
  const scrapByDefect = {};
  data.scrap.forEach(e => {
    const reason = e.defect_reasons?.name || 'Drugo';
    scrapByDefect[reason] = (scrapByDefect[reason] || 0) + (Number(e.weight_kg) || 0);
  });
  const topDefects = Object.entries(scrapByDefect).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header z izborom datuma + export */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <Calendar className="w-5 h-5 text-as-gray-400" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300" />
          <span className="text-sm text-as-gray-500 hidden sm:inline">{formatDate(date)}</span>
          {!canEdit && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              <Lock className="w-3 h-3" /> Zaklenjeno (starejše od 7 dni)
            </span>
          )}
        </div>
        <button
          onClick={() => exportDailyToExcel(date, data)}
          className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition"
        >
          <Download className="w-4 h-4" /> Izvoz v Excel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-as-gray-400" />
          <span className="ml-2 text-as-gray-500">Nalagam podatke...</span>
        </div>
      ) : (
        <>
          {/* Skupne statistike */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon="📦" label="Skupaj proizvedeno"
              value={formatNumber(totalProduced)} unit="kosov"
              color="#0E7490" bgColor="#CFFAFE"
              count={data.production.length} countLabel="vnosov"
            />
            <StatCard
              icon="🛑" label="Zastoji skupaj"
              value={formatNumber(totalBreakdownMin)} unit="min"
              color="#92400E" bgColor="#FEF3C7"
              count={data.breakdowns.length} countLabel="zastojev"
            />
            <StatCard
              icon="🗑️" label="Odpadki skupaj"
              value={formatNumber(totalScrapKg.toFixed(1))} unit="kg"
              color="#7C2D12" bgColor="#FED7AA"
              count={data.scrap.length} countLabel="vnosov"
            />
          </div>

          {/* PROIZVODNJA po kategorijah */}
          <ReportCard title="📦 Proizvodnja" emptyText="Ni vnosov za izbrani datum.">
            {Object.keys(productionByCategory).length === 0 ? null : (
              <div className="space-y-4">
                {Object.entries(productionByCategory).map(([cat, entries]) => (
                  <div key={cat}>
                    <h4 className="font-bold text-as-gray-700 mb-2 flex items-center gap-2">
                      <span>{CATEGORY_ICONS[cat]}</span>
                      <span>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-xs text-as-gray-400 font-normal">
                        ({formatNumber(entries.reduce((s, e) => s + (e.quantity || 0), 0))} kosov)
                      </span>
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                          <tr>
                            <th className="text-left p-2">Stroj</th>
                            <th className="text-left p-2">Izdelek</th>
                            <th className="text-center p-2">Izmena</th>
                            <th className="text-right p-2">Količina</th>
                            <th className="text-right p-2">Akcije</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(e => (
                            <tr key={e.id} className="border-t border-as-gray-100">
                              <td className="p-2">{e.production_machines?.name}</td>
                              <td className="p-2">{e.production_products?.name}</td>
                              <td className="p-2 text-center">{e.shift}</td>
                              <td className="p-2 text-right font-semibold">{formatNumber(e.quantity)}</td>
                              <td className="p-2 text-right">
                                {canEdit ? (
                                  <div className="flex justify-end gap-1">
                                    <button onClick={() => setEditing({ type: 'production', entry: e })}
                                      className="p-1.5 hover:bg-as-gray-100 rounded text-as-gray-500" title="Uredi">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete('production', e.id)}
                                      className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Zbriši">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : <Lock className="w-3 h-3 text-as-gray-300 inline" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          {/* ZASTOJI */}
          <ReportCard title="🛑 Zastoji strojev" emptyText="Ni zastojev za izbrani datum.">
            {data.breakdowns.length === 0 ? null : (
              <>
                {topBreakdowns.length > 0 && (
                  <div className="mb-3 bg-as-gray-50 rounded-lg p-3">
                    <div className="text-xs uppercase text-as-gray-500 font-semibold mb-1">Top razlogi (min)</div>
                    <div className="flex flex-wrap gap-2">
                      {topBreakdowns.map(([reason, min]) => (
                        <span key={reason} className="text-xs bg-white border border-as-gray-200 rounded px-2 py-1">
                          <strong>{reason}</strong> — {min} min
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                      <tr>
                        <th className="text-left p-2">Stroj</th>
                        <th className="text-left p-2">Razlog</th>
                        <th className="text-left p-2">Opravljeno</th>
                        <th className="text-left p-2">Odpravil</th>
                        <th className="text-right p-2">Min</th>
                        <th className="text-right p-2">Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdowns.map(e => (
                        <tr key={e.id} className="border-t border-as-gray-100">
                          <td className="p-2">{e.production_machines?.name}</td>
                          <td className="p-2">{e.breakdown_reasons?.name || e.description}</td>
                          <td className="p-2 text-as-gray-500">{e.repair_action}</td>
                          <td className="p-2">{e.repaired_by}</td>
                          <td className="p-2 text-right font-semibold">{e.duration_min}</td>
                          <td className="p-2 text-right">
                            {canEdit ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setEditing({ type: 'breakdown', entry: e })}
                                  className="p-1.5 hover:bg-as-gray-100 rounded text-as-gray-500" title="Uredi">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete('breakdown', e.id)}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Zbriši">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : <Lock className="w-3 h-3 text-as-gray-300 inline" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </ReportCard>

          {/* ODPADKI */}
          <ReportCard title="🗑️ Odpadki" emptyText="Ni odpadkov za izbrani datum.">
            {data.scrap.length === 0 ? null : (
              <>
                {topDefects.length > 0 && (
                  <div className="mb-3 bg-as-gray-50 rounded-lg p-3">
                    <div className="text-xs uppercase text-as-gray-500 font-semibold mb-1">Top napake (kg)</div>
                    <div className="flex flex-wrap gap-2">
                      {topDefects.map(([reason, kg]) => (
                        <span key={reason} className="text-xs bg-white border border-as-gray-200 rounded px-2 py-1">
                          <strong>{reason}</strong> — {kg.toFixed(1)} kg
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-as-gray-50 text-as-gray-500 text-xs uppercase">
                      <tr>
                        <th className="text-left p-2">Stroj</th>
                        <th className="text-left p-2">Izdelek</th>
                        <th className="text-left p-2">Žica</th>
                        <th className="text-left p-2">Napaka</th>
                        <th className="text-left p-2">Delavec</th>
                        <th className="text-right p-2">Kg</th>
                        <th className="text-right p-2">Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.scrap.map(e => (
                        <tr key={e.id} className="border-t border-as-gray-100">
                          <td className="p-2">{e.production_machines?.name}</td>
                          <td className="p-2">{e.production_products?.name}</td>
                          <td className="p-2 text-as-gray-500">{e.production_wires?.code}</td>
                          <td className="p-2">{e.defect_reasons?.name}</td>
                          <td className="p-2">{e.production_workers?.name}</td>
                          <td className="p-2 text-right font-semibold">{Number(e.weight_kg).toFixed(1)}</td>
                          <td className="p-2 text-right">
                            {canEdit ? (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setEditing({ type: 'scrap', entry: e })}
                                  className="p-1.5 hover:bg-as-gray-100 rounded text-as-gray-500" title="Uredi">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete('scrap', e.id)}
                                  className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Zbriši">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : <Lock className="w-3 h-3 text-as-gray-300 inline" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </ReportCard>
        </>
      )}

      {/* Edit modal */}
      {editing && (
        <EditEntryModal
          type={editing.type}
          entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

// ===== Edit modal (univerzalni — deluje za vse 3 tipe) =====
function EditEntryModal({ type, entry, onClose, onSaved }) {
  const [form, setForm] = useState({ ...entry });
  const [saving, setSaving] = useState(false);

  const title = type === 'production' ? 'Uredi proizvodnjo' :
                type === 'breakdown' ? 'Uredi zastoj' : 'Uredi odpadek';
  const table = type === 'production' ? 'production_entries' :
                type === 'breakdown' ? 'machine_breakdowns' : 'production_scrap';

  const handleSave = async () => {
    setSaving(true);
    try {
      let updateData = {};
      
      if (type === 'production') {
        updateData = {
          quantity: Number(form.quantity) || 0,
          normativ: form.normativ ? Number(form.normativ) : null,
          cas_min: form.cas_min ? Number(form.cas_min) : null,
          shift: Number(form.shift) || 1,
          notes: form.notes || null
        };
      } else if (type === 'breakdown') {
        updateData = {
          duration_min: Number(form.duration_min) || 0,
          description: form.description || null,
          repair_action: form.repair_action || null,
          repaired_by: form.repaired_by || null,
          frequency: Number(form.frequency) || 1
        };
      } else if (type === 'scrap') {
        updateData = {
          weight_kg: Number(form.weight_kg) || 0,
          lot_number: form.lot_number || null,
          work_order: form.work_order || null,
          notes: form.notes || null
        };
      }

      const { error } = await supabase.from(table).update(updateData).eq('id', entry.id);
      if (error) throw error;
      onSaved();
    } catch (e) {
      alert('Napaka pri shranjevanju: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-as-gray-700">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {type === 'production' && (
            <>
              <EditField label="Količina (kosov)" type="number" value={form.quantity} onChange={v => setForm({...form, quantity: v})} />
              <EditField label="Normativ (kosov/uro)" type="number" value={form.normativ} onChange={v => setForm({...form, normativ: v})} />
              <EditField label="Čas (minut)" type="number" value={form.cas_min} onChange={v => setForm({...form, cas_min: v})} />
              <EditField label="Izmena" type="number" value={form.shift} onChange={v => setForm({...form, shift: v})} />
              <EditField label="Opombe" type="text" value={form.notes} onChange={v => setForm({...form, notes: v})} />
            </>
          )}
          {type === 'breakdown' && (
            <>
              <EditField label="Trajanje (min)" type="number" value={form.duration_min} onChange={v => setForm({...form, duration_min: v})} />
              <EditField label="Opis okvare" type="text" value={form.description} onChange={v => setForm({...form, description: v})} />
              <EditField label="Opravljeno delo" type="text" value={form.repair_action} onChange={v => setForm({...form, repair_action: v})} />
              <EditField label="Napako odpravil" type="text" value={form.repaired_by} onChange={v => setForm({...form, repaired_by: v})} />
              <EditField label="Pogostost" type="number" value={form.frequency} onChange={v => setForm({...form, frequency: v})} />
            </>
          )}
          {type === 'scrap' && (
            <>
              <EditField label="Teža (kg)" type="number" step="0.01" value={form.weight_kg} onChange={v => setForm({...form, weight_kg: v})} />
              <EditField label="LOT žice" type="text" value={form.lot_number} onChange={v => setForm({...form, lot_number: v})} />
              <EditField label="Nalog" type="text" value={form.work_order} onChange={v => setForm({...form, work_order: v})} />
              <EditField label="Opombe" type="text" value={form.notes} onChange={v => setForm({...form, notes: v})} />
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 text-as-gray-500 hover:bg-as-gray-100 rounded-lg text-sm font-semibold transition">
            Prekliči
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md disabled:opacity-50"
            style={{ backgroundColor: AS_RED }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Save className="w-4 h-4 inline mr-1" />}
            Shrani
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, type, value, onChange, step }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-as-gray-600 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300"
      />
    </div>
  );
}

// ===== Helpers =====
function StatCard({ icon, label, value, unit, color, bgColor, count, countLabel }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: bgColor, color }}
        >{icon}</div>
        <div className="text-xs text-as-gray-400 text-right">
          <div>{count}</div>
          <div className="text-[10px]">{countLabel}</div>
        </div>
      </div>
      <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      <div className="mt-1">
        <span className="text-2xl font-bold text-as-gray-700">{value}</span>
        <span className="text-sm text-as-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}

function ReportCard({ title, emptyText, children }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <h3 className="font-bold text-as-gray-700 mb-3">{title}</h3>
      {children || <div className="text-center py-6 text-as-gray-400 text-sm">{emptyText}</div>}
    </div>
  );
}

// ===== Excel export =====
function exportDailyToExcel(date, data) {
  const lines = [];
  lines.push(`Dnevno poročilo proizvodnje - ${date}`);
  lines.push('');

  lines.push('PROIZVODNJA');
  lines.push('Stroj;Izdelek;Izmena;Količina;Delavec');
  data.production.forEach(e => {
    lines.push([
      e.production_machines?.name || '',
      e.production_products?.name || '',
      e.shift,
      e.quantity,
      e.production_workers?.name || ''
    ].join(';'));
  });
  lines.push('');

  lines.push('ZASTOJI');
  lines.push('Stroj;Razlog;Opis;Opravljeno;Odpravil;Trajanje (min)');
  data.breakdowns.forEach(e => {
    lines.push([
      e.production_machines?.name || '',
      e.breakdown_reasons?.name || '',
      e.description || '',
      e.repair_action || '',
      e.repaired_by || '',
      e.duration_min
    ].join(';'));
  });
  lines.push('');

  lines.push('ODPADKI');
  lines.push('Stroj;Izdelek;Žica;Napaka;Delavec;LOT;Nalog;Teža (kg)');
  data.scrap.forEach(e => {
    lines.push([
      e.production_machines?.name || '',
      e.production_products?.name || '',
      e.production_wires?.code || '',
      e.defect_reasons?.name || '',
      e.production_workers?.name || '',
      e.lot_number || '',
      e.work_order || '',
      e.weight_kg
    ].join(';'));
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proizvodnja-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
