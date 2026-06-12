// AssemblyWorkAnalysis.jsx — Analiza vnosov delavk po delovnih nalogih (line-item)
// Bere assembly_work_log + assembly_work_stops. Dnevno / Mesečno.
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getAssemblyWorkLog, getAssemblyWorkStops, formatNumber, SLOVENIAN_MONTHS } from '../../lib/assemblyApi.js';

const AS_RED = '#C8102E';
const num = (v) => Number(v) || 0;
const h1 = (n) => (Math.round(num(n) * 10) / 10).toLocaleString('sl-SI');
const pct = (kos, exp) => (exp > 0 ? Math.round((kos / exp) * 100) : null);

function addDays(dateStr, n) { const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function monthRange(y, m) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ey = m === 12 ? y + 1 : y, em = m === 12 ? 1 : m + 1;
  const end = `${ey}-${String(em).padStart(2, '0')}-01`;
  return [start, end];
}

export default function AssemblyWorkAnalysis() {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const [mode, setMode] = useState('day'); // 'day' | 'month'
  const [date, setDate] = useState(today);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [logs, setLogs] = useState([]);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let start, end;
        if (mode === 'day') { start = date; end = addDays(date, 1); }
        else { [start, end] = monthRange(year, month); }
        const [lg, st] = await Promise.all([getAssemblyWorkLog(start, end), getAssemblyWorkStops(start, end)]);
        if (!cancelled) { setLogs(lg); setStops(st); }
      } catch (e) {
        if (!cancelled) { setLogs([]); setStops([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, date, year, month]);

  const a = useMemo(() => {
    let kos = 0, dela = 0, stroja = 0, expected = 0;
    const byWorker = {}, bySifra = {};
    for (const r of logs) {
      const k = num(r.kolicina), cd = num(r.cas_dela_ur), cs = num(r.cas_stroja_ur), nh = num(r.normativ_kos_h);
      const exp = nh > 0 ? nh * cd : 0;
      kos += k; dela += cd; stroja += cs; expected += exp;
      const wn = r.worker_name || '(brez)';
      (byWorker[wn] = byWorker[wn] || { name: wn, kos: 0, dela: 0, stroja: 0, exp: 0, nalogi: 0 });
      byWorker[wn].kos += k; byWorker[wn].dela += cd; byWorker[wn].stroja += cs; byWorker[wn].exp += exp; byWorker[wn].nalogi += 1;
      const sf = r.sifra || '(brez)';
      (bySifra[sf] = bySifra[sf] || { sifra: sf, kos: 0, dela: 0, stroja: 0, exp: 0, nh: 0, nalogi: 0 });
      bySifra[sf].kos += k; bySifra[sf].dela += cd; bySifra[sf].stroja += cs; bySifra[sf].exp += exp; bySifra[sf].nalogi += 1;
      if (nh > 0) bySifra[sf].nh = nh;
    }
    let stopHours = 0; const byReason = {};
    for (const s of stops) {
      const c = num(s.cas_ur); stopHours += c;
      const rs = s.reason || '(brez)';
      (byReason[rs] = byReason[rs] || { reason: rs, count: 0, hours: 0 });
      byReason[rs].count += 1; byReason[rs].hours += c;
    }
    return {
      kos, dela, stroja, expected,
      doseganje: pct(kos, expected),
      nalogi: logs.length,
      stopCount: stops.length, stopHours,
      workers: Object.values(byWorker).sort((x, y) => y.kos - x.kos),
      sifre: Object.values(bySifra).sort((x, y) => y.kos - x.kos),
      reasons: Object.values(byReason).sort((x, y) => y.hours - x.hours),
    };
  }, [logs, stops]);

  const monthLabel = `${SLOVENIAN_MONTHS[month - 1]} ${year}`;
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  return (
    <div className="space-y-5">
      {/* Kontrole obdobja */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
          <Pill active={mode === 'day'} onClick={() => setMode('day')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
          <Pill active={mode === 'month'} onClick={() => setMode('month')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
        </div>
        {mode === 'day' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setDate(addDays(date, -1))} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm" />
            <button onClick={() => setDate(addDays(date, 1))} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-as-gray-700 min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-as-gray-400" />}
      </div>

      {/* Skupne kartice */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <BigStat icon="📦" label="Količina" value={formatNumber(a.kos)} unit="kos" color="#0066CC" bgColor="#E6F0FB" />
        <BigStat icon="⏱️" label="Čas dela" value={h1(a.dela)} unit="h" color="#8E44AD" bgColor="#F3E9F8" />
        <BigStat icon="⚙️" label="Čas stroja" value={h1(a.stroja)} unit="h" color="#16A085" bgColor="#E4F5F1" />
        <BigStat icon="🎯" label="Doseganje" value={a.doseganje == null ? '—' : a.doseganje} unit="%" color={AS_RED} bgColor="#FCE8EC" />
        <BigStat icon="🛑" label="Zastoji" value={h1(a.stopHours)} unit={`h · ${a.stopCount}×`} color="#F39C12" bgColor="#FEF3E0" />
      </div>

      {logs.length === 0 && stops.length === 0 && !loading && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center text-sm text-as-gray-500">
          Za to obdobje ni vnosov.
        </div>
      )}

      {/* Po delavkah */}
      {a.workers.length > 0 && (
        <Section title="Po delavkah">
          <Table head={['Delavka', 'Nalogi', 'Količina', 'Čas dela (h)', 'Čas stroja (h)', 'Doseganje']}>
            {a.workers.map((w) => (
              <Row key={w.name} cells={[
                w.name, w.nalogi, formatNumber(w.kos), h1(w.dela), h1(w.stroja),
                w.exp > 0 ? `${pct(w.kos, w.exp)}%` : '—',
              ]} />
            ))}
          </Table>
        </Section>
      )}

      {/* Po šifrah */}
      {a.sifre.length > 0 && (
        <Section title="Po šifrah">
          <Table head={['Šifra', 'Nalogi', 'Količina', 'Norm. (kos/h)', 'Čas dela (h)', 'Doseganje']}>
            {a.sifre.map((s) => (
              <Row key={s.sifra} cells={[
                s.sifra, s.nalogi, formatNumber(s.kos), s.nh > 0 ? formatNumber(s.nh) : '—', h1(s.dela),
                s.exp > 0 ? `${pct(s.kos, s.exp)}%` : '—',
              ]} />
            ))}
          </Table>
        </Section>
      )}

      {/* Zastoji po razlogu */}
      {a.reasons.length > 0 && (
        <Section title="Zastoji po razlogu">
          <Table head={['Razlog', 'Število', 'Skupaj (h)']}>
            {a.reasons.map((r) => (
              <Row key={r.reason} cells={[r.reason, r.count, h1(r.hours)]} />
            ))}
          </Table>
        </Section>
      )}

      <div className="text-xs text-as-gray-400">
        Doseganje = količina / (normativ × čas dela). Normativ se vzame iz šifranta ob vnosu.
      </div>
    </div>
  );
}

function Pill({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded transition ${active ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
      style={active ? { backgroundColor: AS_RED } : {}}>
      {icon}<span>{label}</span>
    </button>
  );
}
function BigStat({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: bgColor, color }}>{icon}</div>
        <div className="text-xs uppercase text-as-gray-500 font-semibold tracking-wider">{label}</div>
      </div>
      <div><span className="text-2xl font-bold text-as-gray-700">{value}</span><span className="text-xs text-as-gray-400 ml-1.5">{unit}</span></div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4">
      <h3 className="font-bold text-as-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-as-gray-500 border-b border-as-gray-200">
            {head.map((h, i) => <th key={i} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Row({ cells }) {
  return (
    <tr className="border-b border-as-gray-100">
      {cells.map((c, i) => <td key={i} className={`p-2 ${i === 0 ? 'text-left font-medium' : 'text-right'}`}>{c}</td>)}
    </tr>
  );
}
