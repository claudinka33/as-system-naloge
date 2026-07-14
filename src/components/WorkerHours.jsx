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
      if (r.vrsta === 'malica') continue; // staro — malica se obračuna avtomatsko
      const name = r[nameField] || '(brez)';
      const c = Number(r.cas_ur) || 0;
      (map[name] = map[name] || { name, days: {} });
      const d = (map[name].days[r.date] = map[name].days[r.date] || { date: r.date, stroj: 0, ostalo: 0 });
      if (r.vrsta === 'ostalo') d.ostalo += c; else d.stroj += c;
    }
    return Object.values(map).map((w) => {
      const days = Object.values(w.days).sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
        const delo = d.stroj + d.ostalo;
        const malica = delo > 4 ? 0.5 : 0; // avtomatsko: 0:30, če je dela več kot 4 h
        return { ...d, delo, malica, skupaj: delo + malica };
      });
      const sum = (k) => days.reduce((a, d) => a + d[k], 0);
      return { name: w.name, days, dni: days.length, stroj: sum('stroj'), ostalo: sum('ostalo'), delo: sum('delo'), malica: sum('malica'), skupaj: sum('skupaj') };
    }).sort((a, b) => a.name.localeCompare(b.name, 'sl'));
  }, [rows, nameField]);

  const ostaloRows = useMemo(() =>
    rows.filter((r) => r.vrsta === 'ostalo').map((r) => ({ date: r.date, name: r[nameField] || '(brez)', opis: r.opomba || '—', cas: Number(r.cas_ur) || 0 })),
  [rows, nameField]);

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
        <span className="text-xs text-as-gray-400">Cilj: 8:00/dan · malica 0:30 avtomatsko (delo &gt; 4 h){mode === 'month' ? ' · klikni delavca za dneve' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-as-gray-500 border-b border-as-gray-200">
              <th className="text-left p-2">Delavec</th>
              {mode === 'month' && <th className="text-right p-2">Dni</th>}
              <th className="text-right p-2">Stroj</th>
              <th className="text-right p-2">Ostalo</th>
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
                    <td className="p-2 text-right">{hoursToHM(w.stroj)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.ostalo)}</td>
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
                    <td className="p-2 text-right">{hoursToHM(w.stroj)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.ostalo)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.delo)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.malica)}</td>
                    <td className="p-2 text-right">{hoursToHM(w.skupaj)}</td>
                    <td className="p-2 text-right">{hoursToHM(cilj)}</td>
                    <td className="p-2 text-right" style={{ color: st.color }}>{st.diff >= 0 ? '+' : ''}{hoursToHM(st.diff)}</td>
                    <td className="p-2 text-right font-bold" style={{ color: st.color }}>{st.label}</td>
                  </tr>
                  {open[w.name] && w.days.map((d) => {
                    const ds = statusOf(d.skupaj, TARGET);
                    return (
                      <tr key={d.date} className="border-b border-as-gray-100 text-xs" style={{ background: '#fdfdfd' }}>
                        <td className="p-2 pl-8">{fmtDate(d.date)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{hoursToHM(d.stroj)}</td>
                        <td className="p-2 text-right">{hoursToHM(d.ostalo)}</td>
                        <td className="p-2 text-right">{hoursToHM(d.delo)}</td>
                        <td className="p-2 text-right">{hoursToHM(d.malica)}</td>
                        <td className="p-2 text-right font-semibold">{hoursToHM(d.skupaj)}</td>
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

      {ostaloRows.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-bold text-as-gray-700 mb-1">Ostalo — kaj in koliko časa</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-as-gray-500 border-b border-as-gray-200">
                  <th className="text-left p-2">Datum</th>
                  <th className="text-left p-2">Delavec</th>
                  <th className="text-left p-2">Opis</th>
                  <th className="text-right p-2">Čas</th>
                </tr>
              </thead>
              <tbody>
                {ostaloRows.map((r, i) => (
                  <tr key={i} className="border-b border-as-gray-100">
                    <td className="p-2">{fmtDate(r.date)}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.opis}</td>
                    <td className="p-2 text-right font-semibold">{hoursToHM(r.cas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
