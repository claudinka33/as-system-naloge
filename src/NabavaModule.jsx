import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase.js';
import {
  BarChart3, TrendingUp, Users, Package, FileSpreadsheet,
  Upload, Download, AlertTriangle, Search, ChevronDown, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import NabavaEntryModal from './components/NabavaEntryModal.jsx';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  formatEUR, formatNum, formatDateSI, MONTH_NAMES_SI,
  canAccessNabava, canManageNabava
} from './nabavaConfig.js';

const AS_RED = '#C8102E';
const CHART_COLORS = ['#C8102E', '#1D9E75', '#EF9F27', '#7F77DD', '#378ADD', '#888780', '#D4537E', '#0F6E56'];

export default function NabavaModule({ user }) {
  const [activeTab, setActiveTab] = useState('pregled');
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntry, setShowEntry] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filterYear, setFilterYear] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterNadsk, setFilterNadsk] = useState('all');

  useEffect(() => {
    if (canAccessNabava(user?.email)) loadPurchases();
  }, []);

  async function loadPurchases() {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .order('datum', { ascending: false })
      .limit(50000);
    if (error) {
      console.error('Load error:', error);
      setLoading(false);
      return;
    }
    setPurchases(data || []);
    setLoading(false);
  }

  if (!canAccessNabava(user?.email)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Nimaš dostopa do modula Nabava.</p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    return purchases.filter(p => {
      if (filterYear !== 'all') {
        const y = new Date(p.datum).getFullYear();
        if (y !== parseInt(filterYear)) return false;
      }
      if (filterSupplier !== 'all' && p.dobavitelj !== filterSupplier) return false;
      if (filterNadsk !== 'all' && p.naziv_nadskupine !== filterNadsk) return false;
      return true;
    });
  }, [purchases, filterYear, filterSupplier, filterNadsk]);

  const years = useMemo(() => {
    const set = new Set();
    purchases.forEach(p => { if (p.datum) set.add(new Date(p.datum).getFullYear()); });
    return Array.from(set).sort((a, b) => b - a);
  }, [purchases]);

  const suppliers = useMemo(() => {
    const set = new Set();
    purchases.forEach(p => p.dobavitelj && set.add(p.dobavitelj));
    return Array.from(set).sort();
  }, [purchases]);

  const nadskupine = useMemo(() => {
    const set = new Set();
    purchases.forEach(p => p.naziv_nadskupine && set.add(p.naziv_nadskupine));
    return Array.from(set).sort();
  }, [purchases]);

  return (
    <div style={{ padding: '0 20px 20px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={24} style={{ color: AS_RED }} />
          Nabava
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canManageNabava(user?.email) && (
            <button onClick={() => { setEditEntry(null); setShowEntry(true); }}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: AS_RED, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
              <Plus size={14} /> Nov vnos
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="all">Vsa leta</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, maxWidth: 250 }}>
          <option value="all">Vsi dobavitelji</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterNadsk} onChange={(e) => setFilterNadsk(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="all">Vse nadskupine</option>
          {nadskupine.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #eee' }}>
        <TabButton active={activeTab === 'pregled'} onClick={() => setActiveTab('pregled')} icon={<BarChart3 size={14} />}>Pregled</TabButton>
        <TabButton active={activeTab === 'dobavitelji'} onClick={() => setActiveTab('dobavitelji')} icon={<Users size={14} />}>Dobavitelji</TabButton>
        <TabButton active={activeTab === 'artikli'} onClick={() => setActiveTab('artikli')} icon={<Package size={14} />}>Artikli / skupine</TabButton>
        <TabButton active={activeTab === 'surovi'} onClick={() => setActiveTab('surovi')} icon={<FileSpreadsheet size={14} />}>Surovi podatki</TabButton>
        {canManageNabava(user?.email) && (
          <TabButton active={activeTab === 'vnosi'} onClick={() => setActiveTab('vnosi')} icon={<Pencil size={14} />}>Vnosi</TabButton>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Nalagam podatke...</div>
      ) : purchases.length === 0 ? (
        <EmptyState onAdd={() => { setEditEntry(null); setShowEntry(true); }} canAdd={canManageNabava(user?.email)} />
      ) : (
        <>
          {activeTab === 'pregled' && <PregledTab data={filtered} />}
          {activeTab === 'dobavitelji' && <DobaviteljiTab data={filtered} />}
          {activeTab === 'artikli' && <ArtikliTab data={filtered} />}
          {activeTab === 'surovi' && <SuroviTab data={filtered} />}
          {activeTab === 'vnosi' && <VnosiTab data={purchases} user={user} onEdit={(p) => { setEditEntry(p); setShowEntry(true); }} onDelete={async (id) => { if (!confirm('Resnično izbrišem ta vnos?')) return; await supabase.from('purchases').delete().eq('id', id); loadPurchases(); }} />}
        </>
      )}

      {showEntry && (
        <NabavaEntryModal user={user} entry={editEntry} onClose={() => { setShowEntry(false); setEditEntry(null); }} onSaved={() => { setShowEntry(false); setEditEntry(null); loadPurchases(); }} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: active ? AS_RED : '#666', borderBottom: active ? `2px solid ${AS_RED}` : '2px solid transparent', fontWeight: active ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
      {icon} {children}
    </button>
  );
}

function EmptyState({ onAdd, canAdd }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', background: '#fafafa', borderRadius: 12 }}>
      <Plus size={48} style={{ color: '#888', marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px 0' }}>Še ni vnosov nabave</h3>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>Dodaj prvi vnos za začetek.</p>
      {canAdd && (
        <button onClick={onAdd}
          style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: AS_RED, color: 'white', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Nov vnos
        </button>
      )}
    </div>
  );
}

function VnosiTab({ data, user, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('manual');

  const filtered = useMemo(() => {
    let list = data;
    if (filterSource !== 'all') list = list.filter(p => (p.source || 'import') === filterSource);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.dobavitelj || '').toLowerCase().includes(q) ||
        (p.naziv || '').toLowerCase().includes(q) ||
        (p.sifra || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [data, search, filterSource]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Iskanje po vnosih..."
            style={{ padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid #ddd', width: '100%', fontSize: 13 }} />
        </div>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
          <option value="manual">Ročni vnosi</option>
          <option value="import">Uvoženi iz Excela</option>
          <option value="all">Vsi</option>
        </select>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>{filtered.length} vnosov</span>
      </div>

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #eee', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              <th style={th()}>Datum</th>
              <th style={th()}>Dobavitelj</th>
              <th style={th()}>Naziv</th>
              <th style={th('right')}>Količina</th>
              <th style={th('right')}>NC</th>
              <th style={th('right')}>Vrednost</th>
              <th style={th()}>Vir</th>
              <th style={th()}>Avtor</th>
              <th style={th('center')}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td()}>{formatDateSI(p.datum)}</td>
                <td style={td()}>{p.dobavitelj}</td>
                <td style={td()}>{p.naziv}</td>
                <td style={td('right')}>{formatNum(p.nabava, 2)} {p.enota}</td>
                <td style={td('right')}>{p.zadnja_nc != null ? formatEUR(p.zadnja_nc, 2) : '—'}</td>
                <td style={{ ...td('right'), fontWeight: 500 }}>{formatEUR(p.nab_vred_odv)}</td>
                <td style={td()}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: (p.source === 'manual') ? '#e8f4ff' : '#f0f0f0', color: (p.source === 'manual') ? '#0066cc' : '#666' }}>
                    {p.source === 'manual' ? 'Ročno' : 'Excel'}
                  </span>
                </td>
                <td style={{ ...td(), fontSize: 11, color: '#666' }}>{p.created_by_name || p.created_by_email || '—'}</td>
                <td style={td('center')}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button onClick={() => onEdit(p)} title="Uredi"
                      style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', display: 'flex' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => onDelete(p.id)} title="Izbriši"
                      style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#c33', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div style={{ padding: 8, fontSize: 11, color: '#888', textAlign: 'center', borderTop: '1px solid #eee' }}>
            Prikazujem prvih 200 od {filtered.length} vnosov. Uporabi iskanje za ožji izbor.
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>
            Ni vnosov za prikaz.
          </div>
        )}
      </div>
    </div>
  );
}

function PregledTab({ data }) {
  const stats = useMemo(() => {
    let totalValue = 0;
    const monthMap = {};
    const supplierMap = {};
    const nadskupinaMap = {};

    data.forEach(p => {
      const val = p.nab_vred_odv || 0;
      totalValue += val;
      if (p.datum) {
        const monthKey = p.datum.slice(0, 7);
        monthMap[monthKey] = (monthMap[monthKey] || 0) + val;
      }
      if (p.dobavitelj) supplierMap[p.dobavitelj] = (supplierMap[p.dobavitelj] || 0) + val;
      if (p.naziv_nadskupine) nadskupinaMap[p.naziv_nadskupine] = (nadskupinaMap[p.naziv_nadskupine] || 0) + val;
    });

    const months = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => {
      const [y, m] = k.split('-');
      return { month: `${MONTH_NAMES_SI[parseInt(m) - 1]} ${y.slice(2)}`, value: Math.round(v) };
    });

    const topSuppliers = Object.entries(supplierMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({
      name: name.length > 25 ? name.slice(0, 25) + '...' : name,
      value: Math.round(value)
    }));

    const nadskupinaChart = Object.entries(nadskupinaMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({
      name, value: Math.round(value)
    }));

    return {
      totalValue,
      months,
      topSuppliers,
      nadskupinaChart,
      avgMonth: months.length > 0 ? totalValue / months.length : 0,
      topSupplier: topSuppliers[0]
    };
  }, [data]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Skupna nabava" value={formatEUR(stats.totalValue)} sub={`${data.length} vnosov`} />
        <KpiCard label="Mesečno povprečje" value={formatEUR(stats.avgMonth)} sub={`${stats.months.length} mesecev`} />
        <KpiCard label="Top dobavitelj" value={stats.topSupplier?.name || '-'} sub={stats.topSupplier ? formatEUR(stats.topSupplier.value) : ''} fontSize={14} />
        <KpiCard label="Različni artikli" value={new Set(data.map(p => p.sifra)).size} sub={`${new Set(data.map(p => p.dobavitelj)).size} dobaviteljev`} />
      </div>

      <ChartCard title="Mesečni trend nabave">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.months}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => formatEUR(v)} />
            <Bar dataKey="value" fill={AS_RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <ChartCard title="Top 10 dobaviteljev">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.topSuppliers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v) => formatEUR(v)} />
              <Bar dataKey="value" fill="#378ADD" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Razdelitev po nadskupinah">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={stats.nadskupinaChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(entry) => entry.name.slice(0, 15)}>
                {stats.nadskupinaChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatEUR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, fontSize = 22 }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #eee' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize, fontWeight: 600, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 8, padding: 16, border: '1px solid #eee' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>{title}</h3>
      {children}
    </div>
  );
}

function DobaviteljiTab({ data }) {
  const [expanded, setExpanded] = useState(null);

  const supplierStats = useMemo(() => {
    const map = {};
    data.forEach(p => {
      const key = p.dobavitelj || '?';
      if (!map[key]) map[key] = { name: key, count: 0, qty: 0, value: 0, items: new Set(), dates: [] };
      map[key].count++;
      map[key].qty += p.nabava || 0;
      map[key].value += p.nab_vred_odv || 0;
      if (p.sifra) map[key].items.add(p.sifra);
      if (p.datum) map[key].dates.push(p.datum);
    });
    return Object.values(map).map(s => ({
      ...s,
      items: s.items.size,
      lastDate: s.dates.sort().pop()
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  const expandedData = useMemo(() => {
    if (!expanded) return [];
    return data.filter(p => p.dobavitelj === expanded).sort((a, b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 50);
  }, [expanded, data]);

  return (
    <div style={{ background: 'white', borderRadius: 8, border: '1px solid #eee', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ background: '#fafafa' }}>
          <tr>
            <th style={th()}></th>
            <th style={th()}>Dobavitelj</th>
            <th style={th('right')}>Vnosov</th>
            <th style={th('right')}>Artiklov</th>
            <th style={th('right')}>Količina</th>
            <th style={th('right')}>Vrednost</th>
            <th style={th()}>Zadnja</th>
          </tr>
        </thead>
        <tbody>
          {supplierStats.map(s => (
            <React.Fragment key={s.name}>
              <tr onClick={() => setExpanded(expanded === s.name ? null : s.name)} style={{ cursor: 'pointer', borderTop: '1px solid #eee' }}>
                <td style={td()}>{expanded === s.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                <td style={td()}>{s.name}</td>
                <td style={td('right')}>{s.count}</td>
                <td style={td('right')}>{s.items}</td>
                <td style={td('right')}>{formatNum(s.qty, 0)}</td>
                <td style={{ ...td('right'), fontWeight: 600 }}>{formatEUR(s.value)}</td>
                <td style={td()}>{formatDateSI(s.lastDate)}</td>
              </tr>
              {expanded === s.name && (
                <tr>
                  <td colSpan={7} style={{ padding: 0, background: '#fafafa' }}>
                    <div style={{ padding: '8px 16px' }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Zadnjih 50 vnosov:</div>
                      <table style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr style={{ color: '#888' }}>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Datum</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Šifra</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Naziv</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Količina</th>
                            <th style={{ textAlign: 'right', padding: '4px 8px' }}>Vrednost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedData.map((p, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                              <td style={{ padding: '4px 8px' }}>{formatDateSI(p.datum)}</td>
                              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{p.sifra}</td>
                              <td style={{ padding: '4px 8px' }}>{p.naziv}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatNum(p.nabava, 2)} {p.enota}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatEUR(p.nab_vred_odv, 2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArtikliTab({ data }) {
  const [expandedNadsk, setExpandedNadsk] = useState(null);
  const [expandedSkup, setExpandedSkup] = useState(null);

  const hierarchy = useMemo(() => {
    const tree = {};
    data.forEach(p => {
      const nad = p.naziv_nadskupine || '(brez nadskupine)';
      const skup = p.naz_skupine || '(brez skupine)';
      if (!tree[nad]) tree[nad] = { name: nad, value: 0, count: 0, skupine: {} };
      if (!tree[nad].skupine[skup]) tree[nad].skupine[skup] = { name: skup, value: 0, count: 0, artikli: {} };

      const artKey = p.sifra || '(brez šifre)';
      if (!tree[nad].skupine[skup].artikli[artKey]) {
        tree[nad].skupine[skup].artikli[artKey] = {
          sifra: p.sifra, naziv: p.naziv, enota: p.enota,
          count: 0, qty: 0, value: 0, prices: [], lastDate: null
        };
      }
      const a = tree[nad].skupine[skup].artikli[artKey];
      a.count++;
      a.qty += p.nabava || 0;
      a.value += p.nab_vred_odv || 0;
      if (p.zadnja_nc) a.prices.push({ date: p.datum, price: p.zadnja_nc });
      if (!a.lastDate || p.datum > a.lastDate) a.lastDate = p.datum;

      tree[nad].value += p.nab_vred_odv || 0;
      tree[nad].count++;
      tree[nad].skupine[skup].value += p.nab_vred_odv || 0;
      tree[nad].skupine[skup].count++;
    });

    return Object.values(tree).map(n => ({
      ...n,
      skupine: Object.values(n.skupine).map(s => ({
        ...s,
        artikli: Object.values(s.artikli).map(a => {
          const avgPrice = a.prices.length > 0 ? a.prices.reduce((s, p) => s + p.price, 0) / a.prices.length : 0;
          const lastPrice = a.prices.sort((p1, p2) => (p1.date || '').localeCompare(p2.date || '')).pop()?.price || 0;
          const priceWarning = avgPrice > 0 && lastPrice > avgPrice * 1.1;
          return { ...a, avgPrice, lastPrice, priceWarning };
        }).sort((a, b) => b.value - a.value)
      })).sort((a, b) => b.value - a.value)
    })).sort((a, b) => b.value - a.value);
  }, [data]);

  const warnings = useMemo(() => {
    let count = 0;
    hierarchy.forEach(n => n.skupine.forEach(s => s.artikli.forEach(a => { if (a.priceWarning) count++; })));
    return count;
  }, [hierarchy]);

  return (
    <div>
      {warnings > 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />
          <span><strong>{warnings} artiklov</strong> ima zadnjo nabavno ceno več kot 10 % nad povprečno.</span>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #eee', overflow: 'hidden' }}>
        {hierarchy.map(nad => (
          <div key={nad.name} style={{ borderTop: '1px solid #eee' }}>
            <div onClick={() => setExpandedNadsk(expandedNadsk === nad.name ? null : nad.name)}
              style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                {expandedNadsk === nad.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {nad.name}
              </span>
              <span style={{ fontSize: 13, color: '#666' }}>{formatEUR(nad.value)} · {nad.count} vnosov</span>
            </div>
            {expandedNadsk === nad.name && nad.skupine.map(skup => (
              <div key={skup.name} style={{ borderTop: '1px solid #f0f0f0', marginLeft: 24 }}>
                <div onClick={() => setExpandedSkup(expandedSkup === skup.name ? null : skup.name)}
                  style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    {expandedSkup === skup.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {skup.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#888' }}>{formatEUR(skup.value)}</span>
                </div>
                {expandedSkup === skup.name && (
                  <div style={{ marginLeft: 24, marginBottom: 8 }}>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: '#888', borderBottom: '1px solid #eee' }}>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Šifra</th>
                          <th style={{ textAlign: 'left', padding: '4px 8px' }}>Naziv</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Količina</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Povp. NC</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Zadnja NC</th>
                          <th style={{ textAlign: 'right', padding: '4px 8px' }}>Skupna</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skup.artikli.slice(0, 30).map((a, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f5f5f5', background: a.priceWarning ? '#fffaf0' : 'transparent' }}>
                            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>{a.sifra}</td>
                            <td style={{ padding: '4px 8px' }}>{a.naziv}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatNum(a.qty, 0)} {a.enota}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatEUR(a.avgPrice, 2)}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: a.priceWarning ? '#d97706' : 'inherit', fontWeight: a.priceWarning ? 600 : 400 }}>
                              {formatEUR(a.lastPrice, 2)}
                              {a.priceWarning && <AlertTriangle size={11} style={{ marginLeft: 4, verticalAlign: -1, color: '#d97706' }} />}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 500 }}>{formatEUR(a.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {skup.artikli.length > 30 && (
                      <div style={{ fontSize: 11, color: '#888', textAlign: 'center', padding: 4 }}>... in {skup.artikli.length - 30} več artiklov</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuroviTab({ data }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(p =>
      (p.dobavitelj || '').toLowerCase().includes(q) ||
      (p.sifra || '').toLowerCase().includes(q) ||
      (p.naziv || '').toLowerCase().includes(q) ||
      (p.naz_skupine || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  function exportCSV() {
    const headers = ['Datum', 'Dobavitelj', 'Šifra', 'Naziv', 'Skupina', 'Nadskupina', 'Količina', 'Enota', 'Nabavna vrednost'];
    const rows = filtered.map(p => [
      p.datum, p.dobavitelj, p.sifra, p.naziv, p.naz_skupine, p.naziv_nadskupine,
      p.nabava, p.enota, p.nab_vred_odv
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nabava_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Iskanje po dobavitelju, šifri, nazivu..."
            style={{ padding: '8px 12px 8px 32px', borderRadius: 6, border: '1px solid #ddd', width: '100%', fontSize: 13 }} />
        </div>
        <button onClick={exportCSV}
          style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Download size={14} /> CSV ({filtered.length})
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #eee', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              <th style={th()}>Datum</th>
              <th style={th()}>Dobavitelj</th>
              <th style={th()}>Šifra</th>
              <th style={th()}>Naziv</th>
              <th style={th()}>Skupina</th>
              <th style={th('right')}>Količina</th>
              <th style={th()}>Enota</th>
              <th style={th('right')}>Vrednost</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td()}>{formatDateSI(p.datum)}</td>
                <td style={td()}>{p.dobavitelj}</td>
                <td style={{ ...td(), fontFamily: 'monospace', fontSize: 11 }}>{p.sifra}</td>
                <td style={td()}>{p.naziv}</td>
                <td style={td()}>{p.naz_skupine}</td>
                <td style={td('right')}>{formatNum(p.nabava, 2)}</td>
                <td style={td()}>{p.enota}</td>
                <td style={{ ...td('right'), fontWeight: 500 }}>{formatEUR(p.nab_vred_odv, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: 'white', cursor: page === 0 ? 'default' : 'pointer' }}>← Prejšnja</button>
          <span style={{ color: '#666' }}>Stran {page + 1} / {totalPages} · {filtered.length} zapisov</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: 'white', cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>Naslednja →</button>
        </div>
      )}
    </div>
  );
}

function th(align = 'left') {
  return { padding: '10px 12px', textAlign: align, fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #eee' };
}
function td(align = 'left') {
  return { padding: '10px 12px', textAlign: align, fontSize: 13 };
}
