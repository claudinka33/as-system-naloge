import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase.js';
import { BarChart3, TrendingUp, Users, Package, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { REPORT_TEMPLATES, USER_DEPARTMENT_MAP, isReportsAdmin, getUserDepartments } from '../reportsConfig.js';

const AS_RED = '#C8102E';
const CHART_COLORS = ['#C8102E', '#1D9E75', '#EF9F27', '#7F77DD', '#378ADD', '#888780', '#D4537E', '#0F6E56'];

// Oddelki, ki se generirajo iz oddelek-tabel
const SUPPORTED_DEPTS = ['proizvodnja', 'montaza', 'nabava', 'tehnolog', 'kakovost', 'komerciala', 'racunovodstvo'];

const MONTH_NAMES = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
];

export default function MonthlyDepartmentAnalysis({ currentUser }) {
  const isAdmin = isReportsAdmin(currentUser?.email);
  const userDepts = getUserDepartments(currentUser?.email);

  // Katere oddelke prikazujemo
  const visibleDepts = useMemo(() => {
    if (isAdmin) return SUPPORTED_DEPTS;
    return userDepts.filter(d => SUPPORTED_DEPTS.includes(d));
  }, [isAdmin, userDepts]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeDept, setActiveDept] = useState(visibleDepts[0] || null);

  // Če uporabnik nima nobenega oddelka, ne prikaži
  if (!visibleDepts.length) return null;

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#333' }}>
          <BarChart3 size={20} style={{ color: AS_RED }} />
          Mesečna analiza
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', padding: '6px 8px', borderRadius: 8, border: '1px solid #eee' }}>
          <button onClick={prevMonth} style={navBtn()}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={nextMonth} style={navBtn()}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Tabi za oddelke (samo če jih je več) */}
      {visibleDepts.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', borderBottom: '1px solid #eee' }}>
          {visibleDepts.map(dept => {
            const tmpl = REPORT_TEMPLATES[dept];
            if (!tmpl) return null;
            const active = activeDept === dept;
            return (
              <button key={dept} onClick={() => setActiveDept(dept)}
                style={{
                  padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                  color: active ? tmpl.color : '#666',
                  borderBottom: active ? `2px solid ${tmpl.color}` : '2px solid transparent',
                  fontWeight: active ? 600 : 400, marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                <span style={{ fontSize: 16 }}>{tmpl.icon}</span> {tmpl.name}
              </button>
            );
          })}
        </div>
      )}

      {activeDept && (
        <DepartmentMonthCard department={activeDept} year={year} month={month} />
      )}
    </div>
  );
}

function DepartmentMonthCard({ department, year, month }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const tmpl = REPORT_TEMPLATES[department];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_monthly_department_stats', {
        p_department: department,
        p_year: year,
        p_month: month
      });
      if (cancelled) return;
      if (error) {
        console.error('Monthly stats error:', error);
        setStats(null);
      } else {
        setStats(data || {});
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [department, year, month]);

  if (loading) {
    return (
      <div style={card()}>
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>Nalagam podatke...</div>
        </div>
      </div>
    );
  }

  if (!stats || Object.keys(stats).length === 0 || stats.error) {
    return (
      <div style={card()}>
        <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>
          Ni podatkov za izbrani mesec.
        </div>
      </div>
    );
  }

  // KPI in podatki po oddelku
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
      <DeptKpis department={department} stats={stats} color={tmpl.color} />
      <DeptDailyChart department={department} stats={stats} color={tmpl.color} />
      <DeptTopList department={department} stats={stats} color={tmpl.color} />
    </div>
  );
}

function DeptKpis({ department, stats, color }) {
  // KPI številke - odvisno od oddelka
  let kpis = [];
  if (department === 'proizvodnja') {
    kpis = [
      { label: 'Skupaj kos', value: stats.total_quantity ?? 0 },
      { label: 'Skupaj ur', value: stats.total_hours ?? 0 },
      { label: 'Št. vnosov', value: stats.entry_count ?? 0 },
    ];
  } else if (department === 'montaza') {
    kpis = [
      { label: 'Skupaj kos', value: stats.total_quantity ?? 0 },
      { label: 'Skupaj ur', value: stats.total_hours ?? 0 },
      { label: 'Št. vnosov', value: stats.entry_count ?? 0 },
    ];
  } else if (department === 'nabava') {
    kpis = [
      { label: 'Vrednost', value: `${(stats.total_value || 0).toLocaleString('sl-SI')} €` },
      { label: 'Naročil', value: stats.order_count ?? 0 },
      { label: 'Dobaviteljev', value: stats.supplier_count ?? 0 },
    ];
  } else {
    kpis = [
      { label: 'Skupaj vnosov', value: stats.entry_count ?? 0 },
      { label: 'Odprtih', value: stats.open_count ?? 0 },
      { label: 'Zaključenih', value: stats.closed_count ?? 0 },
    ];
  }

  return (
    <div style={card()}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>KPI številke</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: i < kpis.length - 1 ? '1px solid #f3f3f3' : 'none', paddingBottom: i < kpis.length - 1 ? 8 : 0 }}>
            <span style={{ fontSize: 12, color: '#666' }}>{k.label}</span>
            <span style={{ fontSize: 18, fontWeight: 600, color }}>{k.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeptDailyChart({ stats, color }) {
  let data = stats.daily_chart || [];
  // Supabase lahko vrne JSON kot string — parse-aj če je potrebno
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = []; }
  }
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div style={card()}>
        <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Po dnevih</div>
        <div style={{ padding: 30, textAlign: 'center', color: '#aaa', fontSize: 12 }}>Brez podatkov</div>
      </div>
    );
  }
  const maxVal = Math.max(...data.map(d => parseFloat(d.value) || 0));

  return (
    <div style={card()}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Po dnevih</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, padding: '0 4px' }}>
        {data.slice(-31).map((d, i) => {
          const val = parseFloat(d.value) || 0;
          const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const day = d.day ? new Date(d.day).getDate() : '';
          return (
            <div key={i} title={`${d.day}: ${val.toLocaleString('sl-SI')}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 8 }}>
              <div style={{ width: '100%', height: `${h}%`, background: color, opacity: 0.85, borderRadius: '2px 2px 0 0', minHeight: val > 0 ? 2 : 0 }} />
              <div style={{ fontSize: 9, color: '#aaa' }}>{day}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: '#888', textAlign: 'center' }}>
        Skupaj {data.length} dni z vnosi
      </div>
    </div>
  );
}

function DeptTopList({ department, stats, color }) {
  let items = [];
  let title = 'Top 3';
  let formatVal = (v) => v;

  if (department === 'proizvodnja') {
    items = stats.top_machines || [];
    title = 'Top stroji';
    formatVal = (v) => `${(v || 0).toLocaleString('sl-SI')} kos`;
  } else if (department === 'nabava') {
    items = stats.top_suppliers || [];
    title = 'Top dobavitelji';
    formatVal = (v) => `${(v || 0).toLocaleString('sl-SI')} €`;
  } else {
    items = stats.top_categories || [];
    title = 'Top kategorije';
    formatVal = (v) => `${v} vnosov`;
  }

  // Supabase lahko vrne JSON kot string — parse-aj če je potrebno
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { items = []; }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div style={card()}>
        <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{title}</div>
        <div style={{ padding: 30, textAlign: 'center', color: '#aaa', fontSize: 12 }}>Brez podatkov</div>
      </div>
    );
  }

  return (
    <div style={card()}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.slice(0, 3).map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || '(brez imena)'}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{formatVal(it.value)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function card() {
  return { background: 'white', borderRadius: 12, padding: 16, border: '1px solid #eee', minHeight: 180 };
}
function navBtn() {
  return { padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' };
}
