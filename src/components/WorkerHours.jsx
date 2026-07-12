// WorkerHours.jsx — Ure delavcev (Moj delovni dan analitika) za Mileno/Borisa/admine.
// Bere assembly_daily_time (worker_name) ali production_daily_time (operater).
// Dnevno: vrstica na delavca. Mesečno: seštevek na delavca, klik razpre po dnevih.
// Status glede na 8:00/dan: Premalo (rdeče) · Prav (zeleno) · Nadure (oranžno).
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronDown, Clock } from 'lucide-react';
import { supabase } from '../supabase';

const AS_RED = '#C8102E';
const TARGET = 8; // 8:00 na dan (delo 7:30 + malica 0:30)
const TOL = 0.09; // toleranca ~5 min

function hoursToHM(h) {
  const total = Math.round(Number(h || 0) * 60);
  const hh = Math.floor(Math.abs(total) / 60), mm = Math.abs(total) % 60;
  return `${total < 0 ? '-' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}
const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('sl-SI') : '—');

function statusOf(skupaj, cilj) {
  const diff = skupaj - cilj;
  if (Math.abs(diff) < TOL) return { label: 'Prav ✔', color: '#1b5e20', diff };
  if (diff < 0) return { label: 'Premalo', color: '#C8102E', diff };
  return { label: 'Nadure', color: '#F39C12', diff };
}

function monthRange(y, m) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ey = m === 12 ? y + 1 : y, em = m === 12 ? 1 : m + 1;
  return [start, `${ey}-${String(em).padStart(2, '0')}-01`];
}

export default function WorkerHours({ source, mode, date, year, month }) {
  const table = source === 'production' ? 'production_daily_time' : 'assembly_daily_time';
  const nameField = source === 'production' ? 'operater' : 'worker_name';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let start, end;
        if (mode === 'day') {
          start = date;
          const d = new Date(date); d.setDate(d.getDate() + 1);
          end = d.toISOString().slice(0, 10);
        } else {
          [start, end] = monthRange(year, month);
        }
        const { data } = await supabase.from(table)
          .select(`date,vrsta,cas_ur,opomba,${nameField}`)
          .gte('date', start).lt('date', end)
          .order('date', { ascending: true });
        if (!cancelled) { setRows(data || []); setOpen({}); }
      } catch (e) {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [table, nameField, mode, date, year, month]);

  const byWorker = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const name = r[nameField] || '(brez)';
      const c = Number(r.cas_ur) || 0;
      (map[name] = map[name] || { name, delo: 0, malica: 0, days: {} });
      const w = map[name];
      const d = (w.days[r.date] = w.days[r.date] || { date: r.date, delo: 0, malica: 0 });
      if (r.vrsta === 'malica') { w.malica += c; d.malica += c; }
      else { w.delo += c; d.delo += c; }
    }
    return Object.values(map).map((w) => {
      const days = Object.values(w.days).sort((a, b) => a.date.localeCompare(b.date));
      return { ...w, days, dni: days.length, skupaj: w.delo + w.malica };
    }).sort((a, b) => a.name.localeCompare(b.name, 'sl'));
  }, [rows, nameField]);

  if (loading) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
        <div className="text-sm text-as-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Nalagam ure delavcev…</div>
      </div>
    );
  }
  if (byWorker.length === 0) return null;

  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-as-gray-700 inline-flex items-center gap-2"><Clock className="w-4 h-4" /> Ure delavcev (Moj delovni dan)</h3>
        <span className="text-xs text-as-gray-400">Cilj: 8:00/dan (delo 7:30 + malica 0:30){mode === 'month' ? ' · klikni delavca za dneve' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-as-gray-500 border-b border-as-gray-200">
              <th className="text-left p-2">Delavec</th>
              {mode === 'month' && <th className="text-right p-2">Dni</th>}
              <th className="text-right p-2">Delo</th>
              <th className="text-right p-2">Malica</th>
              <th className="text-right p-2">Skupaj</th>
              {mode === 'month' && <th className="text-right p-2">Cilj</th>}
              <th className="text-right p-2">Razlika</th>
              <th className="text-right p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {byWorker.map((w) => {
              const cilj = mode === 'month' ? w.dni * TARGET : TARGET;
              const st = statusOf(w.skupaj, cilj);
              if (mode === 'day') {
                return (
                  <tr key={w.name} className="border-b border-as-gray-100">
                    <td className="p-2 font-medium">{w.name}</td>
                    <td className="p-2 text-right">{hoursToHM(w.delo)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.malica)}</td>
                    <td className="p-2 text-right font-semibold">{hoursToHM(w.skupaj)}</td>
                    <td className="p-2 text-right" style={{ color: st.color }}>{st.diff >= 0 ? '+' : ''}{hoursToHM(st.diff)}</td>
                    <td className="p-2 text-right font-bold" style={{ color: st.color }}>{st.label}</td>
                  </tr>
                );
              }
              return (
                <React.Fragment key={w.name}>
                  <tr className="border-b border-as-gray-100 cursor-pointer hover:bg-as-gray-50 font-semibold" style={{ background: '#fafafa' }}
                    onClick={() => setOpen((p) => ({ ...p, [w.name]: !p[w.name] }))}>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        <ChevronDown className={`w-4 h-4 transition ${open[w.name] ? '' : '-rotate-90'}`} style={{ color: AS_RED }} />
                        {w.name}
                      </span>
                    </td>
                    <td className="p-2 text-right">{w.dni}</td>
                    <td className="p-2 text-right">{hoursToHM(w.delo)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.malica)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.skupaj)}</td>
                    <td className="p-2 text-right">{hoursToHM(cilj)}</td>
                    <td className="p-2 text-right" style={{ color: st.color }}>{st.diff >= 0 ? '+' : ''}{hoursToHM(st.diff)}</td>
                    <td className="p-2 text-right font-bold" style={{ color: st.color }}>{st.label}</td>
                  </tr>
                  {open[w.name] && w.days.map((d) => {
                    const ds = statusOf(d.delo + d.malica, TARGET);
                    return (
                      <tr key={d.date} className="border-b border-as-gray-100 text-xs" style={{ background: '#fdfdfd' }}>
                        <td className="p-2 pl-8">{fmtDate(d.date)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{hoursToHM(d.delo)}</td>
                        <td className="p-2 text-right">{hoursToHM(d.malica)}</td>
                        <td className="p-2 text-right font-semibold">{hoursToHM(d.delo + d.malica)}</td>
                        <td className="p-2 text-right">{hoursToHM(TARGET)}</td>
                        <td className="p-2 text-right" style={{ color: ds.color }}>{ds.diff >= 0 ? '+' : ''}{hoursToHM(ds.diff)}</td>
                        <td className="p-2 text-right font-bold" style={{ color: ds.color }}>{ds.label}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
