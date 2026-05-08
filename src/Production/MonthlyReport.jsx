// MonthlyReport.jsx — Mesečno poročilo s preglednico vs plan
import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, Download, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getMonthlyData, loadPlans, loadProducts, formatNumber,
  CATEGORY_LABELS, CATEGORY_ICONS, SLOVENIAN_MONTHS
} from '../../lib/productionApi.js';

const AS_RED = '#C8102E';

export default function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState({ production: [], breakdowns: [], scrap: [] });
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [monthData, plansData, productsData] = await Promise.all([
          getMonthlyData(year, month),
          loadPlans(year),
          loadProducts(),
        ]);
        setData(monthData);
        setPlans(plansData);
        setProducts(productsData);
      } catch (e) {
        console.error(e);
        alert('Napaka pri nalaganju: ' + e.message);
      }
      setLoading(false);
    })();
  }, [year, month]);

  // Skupne vsote
  const totalProduced = data.production.reduce((s, e) => s + (e.quantity || 0), 0);
  const totalBreakdownMin = data.breakdowns.reduce((s, e) => s + (e.duration_min || 0), 0);
  const totalScrapKg = data.scrap.reduce((s, e) => s + (Number(e.weight_kg) || 0), 0);

  // Po izdelku: produced vs plan
  const byProduct = {};
  products.forEach(p => {
    byProduct[p.id] = { product: p, produced: 0, plan: 0 };
  });
  data.production.forEach(e => {
    if (e.production_products) {
      const pid = e.product_id;
      if (byProduct[pid]) byProduct[pid].produced += e.quantity || 0;
    }
  });
  plans.filter(p => p.month === month).forEach(p => {
    if (byProduct[p.product_id]) byProduct[p.product_id].plan = p.planned_qty;
  });

  // Filter samo aktivne (ki imajo plan ali produkcijo)
  const productRows = Object.values(byProduct)
    .filter(r => r.plan > 0 || r.produced > 0)
    .sort((a, b) => {
      if (a.product.category !== b.product.category) return a.product.category.localeCompare(b.product.category);
      return b.produced - a.produced;
    });

  // Po stroju: zastoji
  const byMachine = {};
  data.breakdowns.forEach(e => {
    const m = e.production_machines?.name || 'Drugo';
    byMachine[m] = (byMachine[m] || 0) + (e.duration_min || 0);
  });
  const topMachineBreakdowns = Object.entries(byMachine).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Po napakah: odpadki
  const byDefect = {};
  data.scrap.forEach(e => {
    const r = e.defect_reasons?.name || 'Drugo';
    byDefect[r] = (byDefect[r] || 0) + (Number(e.weight_kg) || 0);
  });
  const topDefects = Object.entries(byDefect).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Izbira mesec/leto */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-as-gray-400" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
            {SLOVENIAN_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-300">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={() => exportMonthlyToExcel(year, month, productRows, byMachine, byDefect)}
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
          {/* Skupne stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <BigStat icon="📦" label="Proizvedeno" value={formatNumber(totalProduced)} unit="kosov"
              color="#0E7490" bgColor="#CFFAFE" />
            <BigStat icon="🛑" label="Zastoji" value={formatNumber(totalBreakdownMin)} unit="min"
              color="#92400E" bgColor="#FEF3C7" />
            <BigStat icon="🗑️" label="Odpadki" value={totalScrapKg.toFixed(1)} unit="kg"
              color="#7C2D12" bgColor="#FED7AA" />
          </div>

          {/* Doseganje plana po izdelku */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">📊 Doseganje plana po izdelku — {SLOVENIAN_MONTHS[month - 1]} {year}</h3>
            {productRows.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni podatkov za prikaz.</div>
            ) : (
              <div className="space-y-2">
                {productRows.map(r => {
                  const pct = r.plan > 0 ? (r.produced / r.plan) * 100 : 0;
                  const color = pct >= 100 ? '#16A34A' : pct >= 75 ? '#0E7490' : pct >= 50 ? '#D97706' : '#DC2626';
                  const widthPct = Math.min(pct, 100);
                  return (
                    <div key={r.product.id} className="border border-as-gray-100 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="font-semibold text-sm text-as-gray-700">
                          <span className="mr-1">{CATEGORY_ICONS[r.product.category]}</span>
                          {r.product.name}
                        </div>
                        <div className="text-xs text-as-gray-500">
                          <strong>{formatNumber(r.produced)}</strong> / {formatNumber(r.plan)}
                          <span className="ml-2 font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-as-gray-100 rounded-full overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${widthPct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top zastoji po strojih */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">🛑 Zastoji po strojih (top 10)</h3>
            {topMachineBreakdowns.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni zastojev v tem mesecu.</div>
            ) : (
              <div className="space-y-2">
                {topMachineBreakdowns.map(([name, min]) => {
                  const maxMin = topMachineBreakdowns[0][1];
                  const pct = (min / maxMin) * 100;
                  return (
                    <div key={name} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-5 text-as-gray-700 truncate">{name}</div>
                      <div className="col-span-6 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: '#92400E' }} />
                      </div>
                      <div className="col-span-1 text-right font-semibold text-as-gray-700">{min}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top odpadki po napakah */}
          <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-as-gray-700 mb-4">🗑️ Odpadki po napakah</h3>
            {topDefects.length === 0 ? (
              <div className="text-center py-6 text-as-gray-400 text-sm">Ni odpadkov v tem mesecu.</div>
            ) : (
              <div className="space-y-2">
                {topDefects.map(([name, kg]) => {
                  const maxKg = topDefects[0][1];
                  const pct = (kg / maxKg) * 100;
                  return (
                    <div key={name} className="grid grid-cols-12 gap-2 items-center text-sm">
                      <div className="col-span-5 text-as-gray-700 truncate">{name}</div>
                      <div className="col-span-6 bg-as-gray-100 rounded h-5 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: '#7C2D12' }} />
                      </div>
                      <div className="col-span-1 text-right font-semibold text-as-gray-700">{kg.toFixed(0)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ===== Helpers =====
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div>
        <span className="text-3xl font-bold text-as-gray-700">{value}</span>
        <span className="text-sm text-as-gray-400 ml-2">{unit}</span>
      </div>
    </div>
  );
}

function exportMonthlyToExcel(year, month, productRows, byMachine, byDefect) {
  const lines = [];
  lines.push(`Mesečno poročilo - ${SLOVENIAN_MONTHS[month - 1]} ${year}`);
  lines.push('');

  lines.push('PROIZVODNJA - DOSEGANJE PLANA');
  lines.push('Kategorija;Izdelek;Proizvedeno;Plan;Doseganje (%)');
  productRows.forEach(r => {
    const pct = r.plan > 0 ? ((r.produced / r.plan) * 100).toFixed(1) : '0';
    lines.push([
      CATEGORY_LABELS[r.product.category] || r.product.category,
      r.product.name, r.produced, r.plan, pct
    ].join(';'));
  });
  lines.push('');

  lines.push('ZASTOJI PO STROJIH');
  lines.push('Stroj;Trajanje (min)');
  Object.entries(byMachine).sort((a, b) => b[1] - a[1]).forEach(([n, m]) => {
    lines.push(`${n};${m}`);
  });
  lines.push('');

  lines.push('ODPADKI PO NAPAKAH');
  lines.push('Napaka;Teža (kg)');
  Object.entries(byDefect).sort((a, b) => b[1] - a[1]).forEach(([n, k]) => {
    lines.push(`${n};${k.toFixed(2)}`);
  });

  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mesecno-${year}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
