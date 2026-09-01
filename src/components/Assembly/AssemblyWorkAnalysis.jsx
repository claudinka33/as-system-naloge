// AssemblyWorkAnalysis.jsx — Analiza vnosov delavk po delovnih nalogih (line-item)
// Bere assembly_work_log + assembly_work_stops. Dnevno / Mesečno.
// Enotni stolpci povsod. Dnevno: vsi vnosi vidni + vrstica SKUPAJ na delavko/šifro.
// Mesečno: vrstica delavke/šifre s skupnim seštevkom, klik razpre vnose po datumih (isti stolpci).
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, BarChart3, ChevronLeft, ChevronRight, ChevronDown, Loader2, Download } from 'lucide-react';
import { getAssemblyWorkLog, getAssemblyWorkStops, formatNumber, SLOVENIAN_MONTHS } from '../../lib/assemblyApi.js';
import { supabase } from '../../supabase';
import DayStepper from '../DayStepper';
import WorkerHours from '../WorkerHours.jsx';
import * as XLSX from 'xlsx';

const AS_RED = '#C8102E';
const num = (v) => Number(v) || 0;
const h1 = (n) => (Math.round(num(n) * 10) / 10).toLocaleString('sl-SI');
const pct = (kos, exp) => (exp > 0 ? Math.round((kos / exp) * 100) : null);
const sn = (x) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const mqKos = (v) => (v && typeof v === 'object') ? sn(v.kos) : sn(v);
const mqNorm = (v) => (v && typeof v === 'object') ? sn(v.normativ) : 0;
function oldKosOf(e) { let k = sn(e.total_kos); if (!k) { for (const v of Object.values(e.machine_quantities || {})) k += mqKos(v); for (const v of Object.values(e.activity_data || {})) k += mqKos(v); } return sn(k); }
function oldExpOf(e) { let n = sn(e.normativ); if (!n) { for (const v of Object.values(e.machine_quantities || {})) n += mqNorm(v); for (const v of Object.values(e.activity_data || {})) n += mqNorm(v); } return sn(n); }
function parseBd(raw) { if (!raw) return { reason: '', cas: 0 }; let o = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return { reason: String(raw), cas: 0 }; } } return { reason: o.zastoj || o.vzrok || '', cas: Number(o.cas || 0) || 0 }; }

const SEG_LABELS = { avtomat: 'Avtomat', rocna: 'Ročna', vrece: 'Vrečke', titus: 'Titus', ostalo: 'Ostalo' };
const segLabel = (r) => {
  const s = SEG_LABELS[r.segment] || r.segment || '—';
  return r.faza ? `${s} · ${r.faza === 'vijacenje' ? 'vijačenje' : r.faza}` : s;
};
const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('sl-SI') : '—');
const normTimeOf = (r) => (r.segment === 'avtomat' ? num(r.cas_stroja_ur) : num(r.cas_dela_ur));
const rowPct = (r) => pct(num(r.kolicina), num(r.normativ_kos_h) * normTimeOf(r));
const pctTxt = (p) => (p == null ? '—' : `${p}%`);

const xText = (v) => (v === null || v === undefined ? '' : String(v));

// Ustvari list iz glave + vrstic. numCols = indeksi stolpcev s formatom '0,00'.
function xSheet(header, rows, widths, numCols = []) {
  const data = rows.length ? rows : [['Ni zapisov']];
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = (widths || header.map(() => 16)).map((w) => ({ wch: w }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  if (rows.length) {
    numCols.forEach((c) => {
      for (let r = 1; r <= rows.length; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.t === 'n') cell.z = '0.00';
      }
    });
  }
  return ws;
}

function addDays(dateStr, n) { const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function monthRange(y, m) {
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const ey = m === 12 ? y + 1 : y, em = m === 12 ? 1 : m + 1;
  const end = `${ey}-${String(em).padStart(2, '0')}-01`;
  return [start, end];
}

export default function AssemblyWorkAnalysis({ lockMode = null }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const [mode, setMode] = useState(lockMode || 'day'); // 'day' | 'month'
  const [date, setDate] = useState(today);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [logs, setLogs] = useState([]);
  const [stops, setStops] = useState([]);
  const [oldEntries, setOldEntries] = useState([]);
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openWorkers, setOpenWorkers] = useState({});
  const [openSifre, setOpenSifre] = useState({});
  useEffect(() => { if (lockMode) setMode(lockMode); }, [lockMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let start, end;
        if (mode === 'day') { start = date; end = addDays(date, 1); }
        else { [start, end] = monthRange(year, month); }
        const [lg, st, oe, dt] = await Promise.all([
          getAssemblyWorkLog(start, end),
          getAssemblyWorkStops(start, end),
          supabase.from('assembly_entries')
            .select('id,date,total_hours,total_kos,normativ,breakdowns,machine_quantities,activity_data,assembly_workers(name)')
            .gte('date', start).lt('date', end),
          supabase.from('assembly_daily_time')
            .select('date,worker_name,vrsta,cas_ur,opomba')
            .gte('date', start).lt('date', end),
        ]);
        if (!cancelled) { setLogs(lg); setStops(st); setOldEntries(oe.data || []); setTimes(dt.error ? [] : (dt.data || [])); setOpenWorkers({}); setOpenSifre({}); }
      } catch (e) {
        if (!cancelled) { setLogs([]); setStops([]); setOldEntries([]); setTimes([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, date, year, month]);

  const a = useMemo(() => {
    let kos = 0, kosN = 0, dela = 0, stroja = 0, expected = 0;
    const byWorker = {}, bySifra = {};
    for (const r of logs) {
      const k = num(r.kolicina), cd = num(r.cas_dela_ur), cs = num(r.cas_stroja_ur), nh = num(r.normativ_kos_h);
      const exp = nh > 0 ? nh * normTimeOf(r) : 0;
      kos += k; dela += cd; stroja += cs; expected += exp;
      if (exp > 0) kosN += k;
      const wn = r.worker_name || '(brez)';
      (byWorker[wn] = byWorker[wn] || { name: wn, kos: 0, kosN: 0, dela: 0, stroja: 0, exp: 0, nalogi: 0, rows: [] });
      byWorker[wn].kos += k; byWorker[wn].dela += cd; byWorker[wn].stroja += cs; byWorker[wn].exp += exp; byWorker[wn].nalogi += 1;
      if (exp > 0) byWorker[wn].kosN += k;
      byWorker[wn].rows.push(r);
      const sf = r.sifra || '(brez)';
      (bySifra[sf] = bySifra[sf] || { sifra: sf, artikel: null, dimenzija: null, kos: 0, kosN: 0, dela: 0, stroja: 0, exp: 0, nh: 0, nalogi: 0, rows: [] });
      bySifra[sf].kos += k; bySifra[sf].dela += cd; bySifra[sf].stroja += cs; bySifra[sf].exp += exp; bySifra[sf].nalogi += 1;
      if (exp > 0) bySifra[sf].kosN += k;
      bySifra[sf].rows.push(r);
      if (nh > 0) bySifra[sf].nh = nh;
      if (r.artikel) bySifra[sf].artikel = r.artikel;
      if (r.dimenzija) bySifra[sf].dimenzija = r.dimenzija;
    }
    let stopHours = 0; const byReason = {}; const stopRows = [];
    for (const s of stops) {
      const c = num(s.cas_ur); stopHours += c;
      stopRows.push(s);
      const rs = s.reason || '(brez)';
      (byReason[rs] = byReason[rs] || { reason: rs, count: 0, hours: 0 });
      byReason[rs].count += 1; byReason[rs].hours += c;
    }
    let oldNalogi = 0, oldStops = 0;
    for (const e of oldEntries) {
      const k = oldKosOf(e), cd = sn(num(e.total_hours)), exp = oldExpOf(e);
      if (k === 0 && cd === 0 && exp === 0) continue;
      kos += k; dela += cd; expected += exp; oldNalogi += 1;
      if (exp > 0) kosN += k;
      const wn = e.assembly_workers?.name || '(staro)';
      (byWorker[wn] = byWorker[wn] || { name: wn, kos: 0, kosN: 0, dela: 0, stroja: 0, exp: 0, nalogi: 0, rows: [] });
      byWorker[wn].kos += k; byWorker[wn].dela += cd; byWorker[wn].exp += exp; byWorker[wn].nalogi += 1;
      if (exp > 0) byWorker[wn].kosN += k;
      byWorker[wn].rows.push({ id: `old-${e.id}`, date: e.date, delovni_nalog: '(staro)', segment: null, artikel: null, dimenzija: null, sifra: '(staro)', kolicina: k, normativ_kos_h: cd > 0 ? exp / cd : 0, cas_dela_ur: cd, cas_stroja_ur: 0 });
      const sf = '(staro)';
      (bySifra[sf] = bySifra[sf] || { sifra: sf, artikel: null, dimenzija: null, kos: 0, kosN: 0, dela: 0, stroja: 0, exp: 0, nh: 0, nalogi: 0, rows: [] });
      bySifra[sf].kos += k; bySifra[sf].dela += cd; bySifra[sf].exp += exp; bySifra[sf].nalogi += 1;
      if (exp > 0) bySifra[sf].kosN += k;
      bySifra[sf].rows.push({ id: `olds-${e.id}`, date: e.date, worker_name: wn, delovni_nalog: '(staro)', segment: null, artikel: null, dimenzija: null, sifra: sf, kolicina: k, normativ_kos_h: cd > 0 ? exp / cd : 0, cas_dela_ur: cd, cas_stroja_ur: 0 });
      const bd = parseBd(e.breakdowns);
      if (bd.cas) {
        stopHours += bd.cas; oldStops += 1;
        const rs = bd.reason || 'staro';
        (byReason[rs] = byReason[rs] || { reason: rs, count: 0, hours: 0 });
        byReason[rs].count += 1; byReason[rs].hours += bd.cas;
        stopRows.push({ id: `oldz-${e.id}`, date: e.date, worker_name: wn, reason: rs, delovni_nalog: null, cas_ur: bd.cas, opomba: '(staro)' });
      }
    }
    const sortRows = (rows) => [...rows].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    return {
      kos, dela, stroja, expected,
      doseganje: pct(kosN, expected),
      kosN,
      nalogi: logs.length + oldNalogi,
      stopCount: stops.length + oldStops, stopHours,
      workers: Object.values(byWorker).map((w) => ({ ...w, rows: sortRows(w.rows) })).sort((x, y) => y.kos - x.kos),
      sifre: Object.values(bySifra).map((s) => ({ ...s, rows: sortRows(s.rows) })).sort((x, y) => y.kos - x.kos),
      reasons: Object.values(byReason).sort((x, y) => y.hours - x.hours),
      stopRows: stopRows.sort((x, y) => String(x.date).localeCompare(String(y.date))),
    };
  }, [logs, stops, oldEntries]);

  const monthLabel = `${SLOVENIAN_MONTHS[month - 1]} ${year}`;
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };
  const toggleWorker = (k) => setOpenWorkers((p) => ({ ...p, [k]: !p[k] }));
  const toggleSifra = (k) => setOpenSifre((p) => ({ ...p, [k]: !p[k] }));

  // ─── EXCEL EXPORT (.xlsx, več listov) ───
  // Številke se zapišejo kot prave številke, zato Excel sam uporabi slovensko vejico.
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // 1) VNOSI (line-item) — novi zapisi + stari (assembly_entries)
    const vnosiRows = [
      ...logs.map((r) => [
        xText(r.worker_name), xText(r.date), xText(r.delovni_nalog),
        SEG_LABELS[r.segment] || xText(r.segment),
        r.faza === 'vijacenje' ? 'vijačenje' : xText(r.faza),
        xText(r.machine_name), xText(r.artikel), xText(r.dimenzija), xText(r.sifra),
        num(r.kolicina), num(r.normativ_kos_h) || null,
        num(r.cas_dela_ur), num(r.cas_stroja_ur), rowPct(r),
      ]),
      ...oldEntries
        .filter((e) => oldKosOf(e) || sn(num(e.total_hours)) || oldExpOf(e))
        .map((e) => [
          xText(e.assembly_workers?.name) || '(staro)', xText(e.date), '(staro)', '', '', '', '', '', '(staro)',
          oldKosOf(e), null, sn(num(e.total_hours)), 0,
          pct(oldKosOf(e), oldExpOf(e)),
        ]),
    ];
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Delavka', 'Datum', 'Nalog', 'Segment', 'Faza', 'Stroj', 'Artikel', 'Dimenzija', 'Šifra',
       'Količina', 'Normativ (kos/h)', 'Čas dela (h)', 'Čas stroja (h)', 'Doseganje (%)'],
      vnosiRows, [22, 12, 16, 16, 14, 20, 24, 16, 16, 12, 16, 14, 14, 14], [11, 12]
    ), 'Vnosi');

    // 2) ZASTOJI
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Datum', 'Delavka', 'Razlog', 'Stroj', 'Nalog', 'Čas (h)', 'Opomba'],
      a.stopRows.map((st) => [
        xText(st.date), xText(st.worker_name), xText(st.reason), xText(st.machine_name),
        xText(st.delovni_nalog), num(st.cas_ur), xText(st.opomba),
      ]),
      [12, 22, 24, 20, 16, 12, 34], [5]
    ), 'Zastoji');

    // 3) PO DELAVKAH
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Delavka', 'Nalogov', 'Količina', 'Čas dela (h)', 'Čas stroja (h)', 'Pričakovano (kos)', 'Doseganje (%)'],
      a.workers.map((w) => [
        xText(w.name), w.nalogi, w.kos, w.dela, w.stroja, Math.round(w.exp), pct(w.kosN, w.exp),
      ]),
      [24, 12, 14, 14, 14, 18, 14], [3, 4]
    ), 'Po delavkah');

    // 4) PO ŠIFRAH
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Šifra', 'Artikel', 'Dimenzija', 'Normativ (kos/h)', 'Nalogov', 'Količina', 'Čas dela (h)', 'Čas stroja (h)', 'Doseganje (%)'],
      a.sifre.map((sf) => [
        xText(sf.sifra), xText(sf.artikel), xText(sf.dimenzija), sf.nh || null,
        sf.nalogi, sf.kos, sf.dela, sf.stroja, pct(sf.kosN, sf.exp),
      ]),
      [16, 26, 16, 16, 12, 14, 14, 14, 14], [6, 7]
    ), 'Po šifrah');

    // 5) ZASTOJI PO RAZLOGIH
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Razlog', 'Število', 'Ur'],
      a.reasons.filter((r) => r.hours > 0).map((r) => [xText(r.reason), r.count, r.hours]),
      [34, 12, 12], [2]
    ), 'Zastoji po razlogih');

    // 6) DELOVNI ČAS DELAVK (assembly_daily_time) — malica 0:30 avtomatsko, če je dela več kot 4 h
    const byDay = {};
    (times || []).forEach((t) => {
      if (t.vrsta === 'malica') return;
      const name = xText(t.worker_name).trim() || '(brez imena)';
      const key = `${name}|${t.date}`;
      if (!byDay[key]) byDay[key] = { name, date: t.date, stroj: 0, ostalo: 0, opombe: [] };
      const c = Number(t.cas_ur) || 0;
      if (t.vrsta === 'ostalo') {
        byDay[key].ostalo += c;
        if (t.opomba) byDay[key].opombe.push(xText(t.opomba));
      } else {
        byDay[key].stroj += c;
      }
    });
    const byName = {};
    Object.values(byDay).forEach((d) => {
      const delo = d.stroj + d.ostalo;
      const malica = delo > 4 ? 0.5 : 0;
      if (!byName[d.name]) byName[d.name] = { name: d.name, dni: 0, stroj: 0, ostalo: 0, malica: 0, skupaj: 0, opombe: [] };
      const w = byName[d.name];
      w.dni += 1; w.stroj += d.stroj; w.ostalo += d.ostalo; w.malica += malica; w.skupaj += delo + malica;
      w.opombe.push(...d.opombe);
    });
    XLSX.utils.book_append_sheet(wb, xSheet(
      ['Delavka', 'Dni', 'Delo na stroju (h)', 'Ostalo (h)', 'Malica (h)', 'Skupaj (h)', 'Cilj (h)', 'Razlika (h)', 'Opombe'],
      Object.values(byName).sort((x, y) => x.name.localeCompare(y.name, 'sl')).map((w) => [
        w.name, w.dni, w.stroj, w.ostalo, w.malica, w.skupaj, w.dni * 8,
        Math.round((w.skupaj - w.dni * 8) * 100) / 100, w.opombe.join(' | '),
      ]),
      [24, 8, 18, 14, 14, 14, 12, 14, 40], [2, 3, 4, 5, 6, 7]
    ), 'Delovni čas');

    XLSX.writeFile(wb, mode === 'day'
      ? `montaza-${date}.xlsx`
      : `montaza-${year}-${String(month).padStart(2, '0')}.xlsx`);
  }

  // Stolpci — POVSOD ISTI
  const HEAD_W = ['Delavka', 'Datum', 'Nalog', 'Segment', 'Stroj', 'Artikel', 'Dimenzija', 'Šifra', 'Količina', 'Norm. (kos/h)', 'Čas dela (h)', 'Čas stroja (h)', 'Doseganje'];
  const HEAD_S = ['Šifra', 'Artikel', 'Dimenzija', 'Delavka', 'Datum', 'Nalog', 'Segment', 'Stroj', 'Količina', 'Norm. (kos/h)', 'Čas dela (h)', 'Doseganje'];

  const workerEntryCells = (r, showName) => [
    showName ? (r.worker_name || '—') : '', fmtDate(r.date), r.delovni_nalog || '—', segLabel(r),
    r.machine_name || '—',
    r.artikel || '—', r.dimenzija || '—', r.sifra || '—',
    formatNumber(num(r.kolicina)), num(r.normativ_kos_h) > 0 ? formatNumber(Math.round(num(r.normativ_kos_h))) : '—',
    h1(r.cas_dela_ur), h1(r.cas_stroja_ur), pctTxt(rowPct(r)),
  ];
  const sifraEntryCells = (r) => [
    '', r.artikel || '—', r.dimenzija || '—', r.worker_name || '—', fmtDate(r.date), r.delovni_nalog || '—', segLabel(r),
    r.machine_name || '—',
    formatNumber(num(r.kolicina)), num(r.normativ_kos_h) > 0 ? formatNumber(Math.round(num(r.normativ_kos_h))) : '—',
    h1(r.cas_dela_ur), pctTxt(rowPct(r)),
  ];

  return (
    <div className="space-y-5">
      {/* Kontrole obdobja */}
      <div className="flex flex-wrap items-center gap-3">
        {!lockMode && (
        <div className="flex gap-1 bg-as-gray-100 rounded-lg p-1 border border-as-gray-200">
          <Pill active={mode === 'day'} onClick={() => setMode('day')} icon={<Calendar className="w-4 h-4" />} label="Dnevno" />
          <Pill active={mode === 'month'} onClick={() => setMode('month')} icon={<BarChart3 className="w-4 h-4" />} label="Mesečno" />
        </div>
        )}
        {mode === 'day' ? (
          <DayStepper value={date} onChange={setDate} className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm" />
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-semibold text-as-gray-700 min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-as-gray-200 hover:bg-as-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
        <button onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-as-gray-100 hover:bg-as-gray-200 rounded-lg text-sm font-semibold text-as-gray-700 transition">
          <Download className="w-4 h-4" /> Izvoz v Excel
        </button>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-as-gray-400" />}
      </div>

      {/* Skupne kartice */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat icon="📦" label="Količina" value={formatNumber(a.kos)} unit="kos" color="#0066CC" bgColor="#E6F0FB" />
        <BigStat icon="⏱️" label="Čas dela (nalogi)" value={h1(a.dela)} unit="h" color="#8E44AD" bgColor="#F3E9F8" />
        <BigStat icon="⚙️" label="Čas stroja" value={h1(a.stroja)} unit="h" color="#16A085" bgColor="#E4F5F1" />
        <BigStat icon="🛑" label="Zastoji" value={h1(a.stopHours)} unit={`h · ${a.stopCount}×`} color="#F39C12" bgColor="#FEF3E0" />
      </div>

      {/* Skupno doseganje normativa — kot proizvodnja V2 */}
      {a.doseganje !== null && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-as-gray-700">🎯 Skupno doseganje normativa</span>
            <span className="text-2xl font-bold" style={{
              color: a.doseganje >= 95 ? '#16A34A' : a.doseganje >= 75 ? '#D97706' : '#DC2626',
            }}>{a.doseganje}%</span>
          </div>
          <div className="text-xs text-as-gray-500">
            Doseženo (vnosi z normativom): <strong>{formatNumber(a.kosN)} kos</strong> · Pričakovano po normativu: <strong>{formatNumber(Math.round(a.expected))} kos</strong>
          </div>
        </div>
      )}

      {logs.length === 0 && stops.length === 0 && oldEntries.length === 0 && !loading && (
        <div className="bg-white border border-as-gray-200 rounded-xl p-8 text-center text-sm text-as-gray-500">
          Za to obdobje ni vnosov.
        </div>
      )}

      {/* Po delavkah */}
      {a.workers.length > 0 && (
        <Section title="Po delavkah" hint={mode === 'month' ? 'Klikni delavko, da razpreš vnose po datumih' : null}>
          <Table head={HEAD_W}>
            {a.workers.map((w) => {
              const totalCells = [
                w.name, mode === 'day' ? fmtDate(mode === 'day' ? date : null) : monthLabel, `${w.nalogi}× nalog`, '—', '—', '—', '—', '—',
                formatNumber(w.kos), '—', h1(w.dela), h1(w.stroja), w.exp > 0 ? `${pct(w.kosN, w.exp)}%` : '—',
              ];
              if (mode === 'day') {
                return (
                  <React.Fragment key={w.name}>
                    {w.rows.map((r, i) => <Row key={r.id ?? i} cells={workerEntryCells(r, true)} />)}
                    <BoldRow cells={totalCells.map((c, i) => (i === 0 ? `SKUPAJ — ${w.name}` : c)).map((c, i) => (i === 1 ? '' : c))} />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={w.name}>
                  <tr className="border-b border-as-gray-100 cursor-pointer hover:bg-as-gray-50 font-semibold" onClick={() => toggleWorker(w.name)} style={{ background: '#fafafa' }}>
                    {totalCells.map((c, i) => (
                      <td key={i} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {i === 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <ChevronDown className={`w-4 h-4 transition ${openWorkers[w.name] ? '' : '-rotate-90'}`} style={{ color: AS_RED }} />
                            {c}
                          </span>
                        ) : c}
                      </td>
                    ))}
                  </tr>
                  {openWorkers[w.name] && w.rows.map((r, i) => <Row key={r.id ?? i} cells={workerEntryCells(r, false)} />)}
                </React.Fragment>
              );
            })}
          </Table>
        </Section>
      )}

      {/* Po šifrah */}
      {a.sifre.length > 0 && (
        <Section title="Po šifrah" hint={mode === 'month' ? 'Klikni šifro, da razpreš vnose po datumih' : null}>
          <Table head={HEAD_S}>
            {a.sifre.map((s) => {
              const totalCells = [
                s.sifra, s.artikel || '—', s.dimenzija || '—', '—', mode === 'day' ? '' : monthLabel, `${s.nalogi}× nalog`, '—', '—',
                formatNumber(s.kos), s.nh > 0 ? formatNumber(s.nh) : '—', h1(s.dela), s.exp > 0 ? `${pct(s.kosN, s.exp)}%` : '—',
              ];
              if (mode === 'day') {
                return (
                  <React.Fragment key={s.sifra}>
                    {s.rows.map((r, i) => <Row key={r.id ?? i} cells={[s.sifra, ...sifraEntryCells(r).slice(1)]} />)}
                    <BoldRow cells={totalCells.map((c, i) => (i === 0 ? `SKUPAJ — ${s.sifra}` : c))} />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={s.sifra}>
                  <tr className="border-b border-as-gray-100 cursor-pointer hover:bg-as-gray-50 font-semibold" onClick={() => toggleSifra(s.sifra)} style={{ background: '#fafafa' }}>
                    {totalCells.map((c, i) => (
                      <td key={i} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {i === 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <ChevronDown className={`w-4 h-4 transition ${openSifre[s.sifra] ? '' : '-rotate-90'}`} style={{ color: AS_RED }} />
                            {c}
                          </span>
                        ) : c}
                      </td>
                    ))}
                  </tr>
                  {openSifre[s.sifra] && s.rows.map((r, i) => <Row key={r.id ?? i} cells={sifraEntryCells(r)} />)}
                </React.Fragment>
              );
            })}
          </Table>
        </Section>
      )}

      {/* Zastoji — podrobno */}
      {a.stopRows.length > 0 && (
        <Section title="Zastoji">
          <Table head={['Datum', 'Delavka', 'Razlog', 'Stroj', 'Nalog', 'Čas (h)', 'Opomba']}>
            {a.stopRows.map((s) => (
              <Row key={s.id} cells={[fmtDate(s.date), s.worker_name || '—', s.reason || '—', s.machine_name || '—', s.delovni_nalog || 'splošno', h1(s.cas_ur), s.opomba || '—']} />
            ))}
          </Table>
        </Section>
      )}

      {/* Ure delavcev */}
      <WorkerHours source="assembly" mode={mode} date={date} year={year} month={month} />

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
function Section({ title, hint, children }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-as-gray-700">{title}</h3>
        {hint && <span className="text-xs text-as-gray-400">{hint}</span>}
      </div>
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
function BoldRow({ cells }) {
  return (
    <tr className="border-b-2 border-as-gray-200 font-semibold" style={{ background: '#fafafa' }}>
      {cells.map((c, i) => <td key={i} className={`p-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</td>)}
    </tr>
  );
}
