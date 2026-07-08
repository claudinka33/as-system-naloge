// ProductionDetails.jsx — Po delavcih / Po šifrah / Zastoji podrobno (stil kot montaža).
// Enotni stolpci; dnevno vsi vnosi + SKUPAJ vrstica, mesečno razširljivo po delavcu/šifri.
import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

const AS_RED = '#C8102E';
const num = (v) => Number(v) || 0;
const h1 = (n) => (Math.round(num(n) * 10) / 10).toLocaleString('sl-SI');
const fmtNum = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('sl-SI'));
const fmtDate = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('sl-SI') : '—');
const pct = (kos, exp) => (exp > 0 ? Math.round((kos / exp) * 100) : null);
const pctTxt = (p) => (p == null ? '—' : `${p}%`);
const rowPct = (r) => pct(num(r.kosi), num(r.normativ_kos_h) * num(r.cas_ur));

export default function ProductionDetails({ entries, stops, mode, periodLabel }) {
  const [openWorkers, setOpenWorkers] = useState({});
  const [openSifre, setOpenSifre] = useState({});
  const toggleW = (k) => setOpenWorkers((p) => ({ ...p, [k]: !p[k] }));
  const toggleS = (k) => setOpenSifre((p) => ({ ...p, [k]: !p[k] }));

  const { workers, sifre } = useMemo(() => {
    const byW = {}, byS = {};
    const sortRows = (rows) => [...rows].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    for (const r of entries) {
      const k = num(r.kosi), c = num(r.cas_ur), nh = num(r.normativ_kos_h);
      const exp = nh > 0 ? nh * c : 0;
      const wn = r.operater || '(brez)';
      (byW[wn] = byW[wn] || { name: wn, kos: 0, cas: 0, exp: 0, nalogi: 0, rows: [] });
      byW[wn].kos += k; byW[wn].cas += c; byW[wn].exp += exp; byW[wn].nalogi += 1; byW[wn].rows.push(r);
      const sf = r.tip_vijaka || '(brez šifre)';
      (byS[sf] = byS[sf] || { sifra: sf, kos: 0, cas: 0, exp: 0, nh: 0, nalogi: 0, rows: [] });
      byS[sf].kos += k; byS[sf].cas += c; byS[sf].exp += exp; byS[sf].nalogi += 1; byS[sf].rows.push(r);
      if (nh > 0) byS[sf].nh = nh;
    }
    return {
      workers: Object.values(byW).map((w) => ({ ...w, rows: sortRows(w.rows) })).sort((x, y) => y.kos - x.kos),
      sifre: Object.values(byS).map((s) => ({ ...s, rows: sortRows(s.rows) })).sort((x, y) => y.kos - x.kos),
    };
  }, [entries]);

  const stopRows = useMemo(() =>
    [...(stops || [])].sort((x, y) => String(x.date).localeCompare(String(y.date))), [stops]);

  const HEAD_W = ['Delavec', 'Datum', 'Nalog', 'Segment', 'Stroj', 'Šifra', 'Kosi', 'Norm. (kos/h)', 'Čas stroja (h)', 'Doseganje'];
  const HEAD_S = ['Šifra', 'Delavec', 'Datum', 'Nalog', 'Segment', 'Stroj', 'Kosi', 'Norm. (kos/h)', 'Čas stroja (h)', 'Doseganje'];

  const wCells = (r, showName) => [
    showName ? (r.operater || '—') : '', fmtDate(r.date), r.delovni_nalog || '—', r.segment || '—', r.machine_name || '—', r.tip_vijaka || '—',
    fmtNum(num(r.kosi)), num(r.normativ_kos_h) > 0 ? fmtNum(Math.round(num(r.normativ_kos_h))) : '—', h1(r.cas_ur), pctTxt(rowPct(r)),
  ];
  const sCells = (r) => [
    '', r.operater || '—', fmtDate(r.date), r.delovni_nalog || '—', r.segment || '—', r.machine_name || '—',
    fmtNum(num(r.kosi)), num(r.normativ_kos_h) > 0 ? fmtNum(Math.round(num(r.normativ_kos_h))) : '—', h1(r.cas_ur), pctTxt(rowPct(r)),
  ];

  return (
    <>
      {/* Po delavcih */}
      {workers.length > 0 && (
        <Section title={`👷 Po delavcih${mode === 'month' && periodLabel ? ` — ${periodLabel}` : ''}`}
          hint={mode === 'month' ? 'Klikni delavca, da razpreš vnose po datumih' : null}>
          <Table head={HEAD_W}>
            {workers.map((w) => {
              const totalCells = [
                w.name, mode === 'month' ? (periodLabel || '') : '', `${w.nalogi}× nalog`, '—', '—', '—',
                fmtNum(w.kos), '—', h1(w.cas), w.exp > 0 ? `${pct(w.kos, w.exp)}%` : '—',
              ];
              if (mode === 'day') {
                return (
                  <React.Fragment key={w.name}>
                    {w.rows.map((r, i) => <Row key={r.id ?? i} cells={wCells(r, true)} />)}
                    <BoldRow cells={totalCells.map((c, i) => (i === 0 ? `SKUPAJ — ${w.name}` : i === 1 ? '' : c))} />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={w.name}>
                  <tr className="border-b border-as-gray-100 cursor-pointer hover:bg-as-gray-50 font-semibold" onClick={() => toggleW(w.name)} style={{ background: '#fafafa' }}>
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
                  {openWorkers[w.name] && w.rows.map((r, i) => <Row key={r.id ?? i} cells={wCells(r, false)} />)}
                </React.Fragment>
              );
            })}
          </Table>
        </Section>
      )}

      {/* Po šifrah */}
      {sifre.length > 0 && (
        <Section title={`🔩 Po šifrah${mode === 'month' && periodLabel ? ` — ${periodLabel}` : ''}`}
          hint={mode === 'month' ? 'Klikni šifro, da razpreš vnose po datumih' : null}>
          <Table head={HEAD_S}>
            {sifre.map((s) => {
              const totalCells = [
                s.sifra, '—', mode === 'month' ? (periodLabel || '') : '', `${s.nalogi}× nalog`, '—', '—',
                fmtNum(s.kos), s.nh > 0 ? fmtNum(Math.round(s.nh)) : '—', h1(s.cas), s.exp > 0 ? `${pct(s.kos, s.exp)}%` : '—',
              ];
              if (mode === 'day') {
                return (
                  <React.Fragment key={s.sifra}>
                    {s.rows.map((r, i) => <Row key={r.id ?? i} cells={[s.sifra, ...sCells(r).slice(1)]} />)}
                    <BoldRow cells={totalCells.map((c, i) => (i === 0 ? `SKUPAJ — ${s.sifra}` : i === 2 ? '' : c))} />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={s.sifra}>
                  <tr className="border-b border-as-gray-100 cursor-pointer hover:bg-as-gray-50 font-semibold" onClick={() => toggleS(s.sifra)} style={{ background: '#fafafa' }}>
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
                  {openSifre[s.sifra] && s.rows.map((r, i) => <Row key={r.id ?? i} cells={sCells(r)} />)}
                </React.Fragment>
              );
            })}
          </Table>
        </Section>
      )}

      {/* Zastoji podrobno — samo mesečno (dnevno že ima tabelo zastojev) */}
      {mode === 'month' && stopRows.length > 0 && (
        <Section title={`⚠️ Zastoji podrobno${periodLabel ? ` — ${periodLabel}` : ''}`}>
          <Table head={['Datum', 'Delavec', 'Razlog', 'Nalog', 'Stroj', 'Čas (h)', 'Opomba']}>
            {stopRows.map((s, i) => (
              <Row key={s.id ?? i} cells={[
                fmtDate(s.date), s.operater || '—', s.reason_category || '—', s.delovni_nalog || 'splošno',
                s.machine_name || '—', h1(s.duration_hours), s.description || '—',
              ]} />
            ))}
          </Table>
        </Section>
      )}
    </>
  );
}

function Section({ title, hint, children }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl p-5 shadow-sm">
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
