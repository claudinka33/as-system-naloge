// MojaNormaProizvodnja.jsx — Delavčev pogled na lastno normo v PROIZVODNJI (dnevno + mesečno). Samo zase.
// Bere production_v2_entries po imenu operaterja. Isti dizajn kot montaža (MojaNorma).
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../../supabase';

const AS_RED = '#C8102E';

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const start = `${ym}-01`;
  const endD = new Date(Date.UTC(y, m, 1)); // prvi dan naslednjega meseca
  const end = endD.toISOString().slice(0, 10);
  return { start, end };
}
function pct(kosi, cas, normativ) {
  const target = cas * normativ;
  if (!target) return null;
  return (kosi / target) * 100;
}
function fmtPct(v) {
  if (v == null) return '—';
  return `${Math.round(v)} %`;
}
function pctColor(v) {
  if (v == null) return '#9ca3af';
  if (v >= 100) return '#1b5e20';
  if (v >= 85) return '#F39C12';
  return '#C8102E';
}

export default function MojaNormaProizvodnja({ operater }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      const { start, end } = monthRange(month);
      const { data, error } = await supabase.from('production_v2_entries')
        .select('date,segment,machine_name,tip_vijaka,delovni_nalog,kosi,cas_ur,normativ_kos_h')
        .eq('operater', operater)
        .gte('date', start).lt('date', end)
        .order('date', { ascending: true });
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, [operater, month]);

  // vrstice, ki štejejo v normo (imajo čas stroja in normativ)
  const scored = useMemo(() => rows.filter((r) => Number(r.cas_ur) > 0 && Number(r.normativ_kos_h) > 0), [rows]);

  const monthPct = useMemo(() => {
    const kos = scored.reduce((s, r) => s + Number(r.kosi || 0), 0);
    const target = scored.reduce((s, r) => s + Number(r.cas_ur) * Number(r.normativ_kos_h), 0);
    return target ? (kos / target) * 100 : null;
  }, [scored]);

  const byDay = useMemo(() => {
    const map = {};
    for (const r of scored) {
      if (!map[r.date]) map[r.date] = { kos: 0, target: 0, n: 0 };
      map[r.date].kos += Number(r.kosi || 0);
      map[r.date].target += Number(r.cas_ur) * Number(r.normativ_kos_h);
      map[r.date].n += 1;
    }
    return Object.entries(map)
      .map(([date, v]) => ({ date, pct: v.target ? (v.kos / v.target) * 100 : null, n: v.n }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [scored]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = byDay.find((d) => d.date === today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: AS_RED }}>
          <TrendingUp className="w-5 h-5" /> Moja norma — {operater}
        </h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm bg-white" />
      </div>

      {err && <div className="p-2 rounded text-sm" style={{ background: '#fee', color: '#900' }}>{err}</div>}

      {loading ? (
        <div className="text-sm text-as-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Nalagam…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-as-gray-200 p-4 text-center">
              <div className="text-xs font-semibold text-as-gray-500 mb-1">DANES</div>
              <div className="text-3xl font-bold" style={{ color: pctColor(todayRow?.pct) }}>{fmtPct(todayRow?.pct)}</div>
            </div>
            <div className="bg-white rounded-xl border border-as-gray-200 p-4 text-center">
              <div className="text-xs font-semibold text-as-gray-500 mb-1">MESEČNO</div>
              <div className="text-3xl font-bold" style={{ color: pctColor(monthPct) }}>{fmtPct(monthPct)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-as-gray-200 p-4">
            <div className="font-bold text-sm text-as-gray-700 mb-2">Po dnevih</div>
            {byDay.length === 0 ? (
              <div className="text-sm text-as-gray-400">Ni vnosov v tem mesecu.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-as-gray-500 border-b border-as-gray-200">
                    <th className="text-left p-2">Datum</th>
                    <th className="text-right p-2">Vnosi</th>
                    <th className="text-right p-2">Norma</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => (
                    <tr key={d.date} className="border-b border-as-gray-100">
                      <td className="p-2">{new Date(d.date + 'T12:00:00').toLocaleDateString('sl-SI')}</td>
                      <td className="p-2 text-right">{d.n}</td>
                      <td className="p-2 text-right font-bold" style={{ color: pctColor(d.pct) }}>{fmtPct(d.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-as-gray-200 p-4">
            <div className="font-bold text-sm text-as-gray-700 mb-2">Vnosi v mesecu</div>
            {rows.length === 0 ? (
              <div className="text-sm text-as-gray-400">Ni vnosov.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-as-gray-500 border-b border-as-gray-200">
                      <th className="text-left p-2">Datum</th>
                      <th className="text-left p-2">Segment</th>
                      <th className="text-left p-2">Stroj</th>
                      <th className="text-left p-2">Šifra</th>
                      <th className="text-right p-2">Kos</th>
                      <th className="text-right p-2">Čas (h)</th>
                      <th className="text-right p-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const p = pct(Number(r.kosi || 0), Number(r.cas_ur || 0), Number(r.normativ_kos_h || 0));
                      return (
                        <tr key={i} className="border-b border-as-gray-100">
                          <td className="p-2">{new Date(r.date + 'T12:00:00').toLocaleDateString('sl-SI')}</td>
                          <td className="p-2">{r.segment || '—'}</td>
                          <td className="p-2">{r.machine_name || '—'}</td>
                          <td className="p-2">{r.tip_vijaka || '—'}</td>
                          <td className="p-2 text-right">{Number(r.kosi || 0).toLocaleString('sl-SI')}</td>
                          <td className="p-2 text-right">{(Math.round(Number(r.cas_ur || 0) * 10) / 10).toLocaleString('sl-SI')}</td>
                          <td className="p-2 text-right font-semibold" style={{ color: pctColor(p) }}>{fmtPct(p)}</td>
                        </tr>
                      );
                    })}
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
