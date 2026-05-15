import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, Users, ChevronLeft, ChevronRight, Plus, Save, 
  CheckCircle2, Circle, AlertCircle, Edit2, History, Eye, X, Loader2,
  TableProperties, LayoutGrid, Filter, Download, Building, Trash2, Sparkles, RefreshCw
} from 'lucide-react';
import { supabase } from './supabase.js';
import { 
  REPORT_TEMPLATES, 
  USER_DEPARTMENT_MAP,
  ADMIN_HOME_DEPARTMENT,
  getUserDepartments, 
  isReportsAdmin,
  getCurrentWeekInfo,
  getWeekInfo,
  formatWeekRange 
} from './reportsConfig.js';

export default function Reports({ currentUser, employees }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekInfo());
  const [editingReport, setEditingReport] = useState(null); // { department, existingReport }
  const [viewingReport, setViewingReport] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' ali 'table'
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const isAdmin = isReportsAdmin(currentUser.email);
  const userDepartments = getUserDepartments(currentUser.email);

  // Load reports za izbrani teden
  useEffect(() => {
    loadReports();

    // Realtime
    const channel = supabase
      .channel('reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => loadReports())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWeek]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('week_year', selectedWeek.weekYear)
        .eq('week_number', selectedWeek.weekNumber)
        .order('department');

      if (error) throw error;
      setReports(data || []);
    } catch (e) {
      console.error('Napaka pri nalaganju poročil:', e);
    }
    setLoading(false);
  };

  // Pridobi obstoječe poročilo za določen oddelek
  const getReportForDepartment = (deptKey) => {
    return reports.find(r => r.department === deptKey && r.author_email === currentUser.email);
  };

  // Pridobi VSA poročila za oddelek (od vseh avtorjev)
  const getAllReportsForDepartment = (deptKey) => {
    return reports.filter(r => r.department === deptKey);
  };

  // Navigacija po tednih
  const navigateWeek = (direction) => {
    const newDate = new Date(selectedWeek.monday);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedWeek(getWeekInfo(newDate));
  };

  const goToCurrentWeek = () => {
    setSelectedWeek(getCurrentWeekInfo());
  };

  // Ustvari ali posodobi poročilo
  const saveReport = async (department, content, status = 'draft') => {
    try {
      const existing = getReportForDepartment(department);
      
      if (existing) {
        // Posodobi obstoječe + zapiši zgodovino
        await supabase.from('report_history').insert({
          report_id: existing.id,
          content_before: existing.content,
          content_after: content,
          changed_by_email: currentUser.email,
          changed_by_name: currentUser.name
        });

        const { error } = await supabase
          .from('reports')
          .update({
            content,
            status,
            submitted_at: status === 'submitted' && !existing.submitted_at ? new Date().toISOString() : existing.submitted_at
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Novo poročilo
        const { error } = await supabase
          .from('reports')
          .insert({
            department,
            week_year: selectedWeek.weekYear,
            week_number: selectedWeek.weekNumber,
            week_start: selectedWeek.weekStart,
            week_end: selectedWeek.weekEnd,
            content,
            author_email: currentUser.email,
            author_name: currentUser.name,
            status,
            submitted_at: status === 'submitted' ? new Date().toISOString() : null
          });

        if (error) throw error;
      }
      
      setEditingReport(null);
      loadReports();
    } catch (e) {
      console.error('Napaka pri shranjevanju poročila:', e);
      alert(`Napaka: ${e.message}`);
    }
  };

  // Izbriši poročilo (samo admin ali avtor)
  const deleteReport = async (report) => {
    const canDelete = isAdmin || report.author_email === currentUser.email;
    if (!canDelete) {
      alert('Nimaš pravice za brisanje tega poročila.');
      return;
    }

    const template = REPORT_TEMPLATES[report.department];
    const confirmMsg = `Ali res želiš izbrisati poročilo?\n\n${template?.icon || ''} ${template?.name || report.department}\nAvtor: ${report.author_name}\nTeden: ${report.week_number}/${report.week_year}\n\nTa akcija je nepovratna.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      // 1. Najprej izbriši zgodovino sprememb
      await supabase.from('report_history').delete().eq('report_id', report.id);
      
      // 2. Nato izbriši poročilo
      const { error } = await supabase.from('reports').delete().eq('id', report.id);
      if (error) throw error;
      
      loadReports();
    } catch (e) {
      console.error('Napaka pri brisanju poročila:', e);
      alert(`Napaka pri brisanju: ${e.message}`);
    }
  };

  // Določi katere oddelke prikazati
  const visibleDepartments = isAdmin 
    ? Object.keys(REPORT_TEMPLATES) 
    : userDepartments;

  const filteredDepartments = departmentFilter === 'all' 
    ? visibleDepartments 
    : [departmentFilter];

  // Oseba, ki bi morala napisati poročilo za določen oddelek
  const getResponsibleForDepartment = (deptKey) => {
    const responsibleEmails = [];
    
    // 1. Najdi vse, ki imajo ta oddelek v USER_DEPARTMENT_MAP
    Object.entries(USER_DEPARTMENT_MAP).forEach(([email, depts]) => {
      if (depts === 'admin') return; // Admin obravnavamo posebej
      if (Array.isArray(depts) && depts.includes(deptKey)) {
        responsibleEmails.push(email);
      }
    });
    
    // 2. Dodaj admin uporabnike, katerih HOME_DEPARTMENT je ta oddelek
    Object.entries(ADMIN_HOME_DEPARTMENT).forEach(([email, homeDept]) => {
      if (homeDept === deptKey && !responsibleEmails.includes(email)) {
        responsibleEmails.push(email);
      }
    });
    
    return responsibleEmails.map(email => {
      const emp = employees.find(e => e.email === email);
      return emp ? { email, name: emp.name } : null;
    }).filter(Boolean);
  };

  return (
    <div>
      {/* Navigacija po tednih */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
              title="Prejšnji teden"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[260px]">
              <div className="text-lg font-bold text-as-gray-700">
                Teden {selectedWeek.weekNumber} • {selectedWeek.weekYear}
              </div>
              <div className="text-xs text-as-gray-400">
                {formatWeekRange(selectedWeek.weekStart, selectedWeek.weekEnd)}
              </div>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
              title="Naslednji teden"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToCurrentWeek}
              className="ml-2 px-3 py-1.5 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 rounded-lg text-sm font-semibold transition"
            >
              Trenutni teden
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
              >
                <option value="all">Vsi oddelki</option>
                {Object.entries(REPORT_TEMPLATES).map(([key, tmpl]) => (
                  <option key={key} value={key}>{tmpl.icon} {tmpl.name}</option>
                ))}
              </select>
            )}

            <div className="bg-as-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1 ${viewMode === 'cards' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Kartice
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-semibold rounded transition flex items-center gap-1 ${viewMode === 'table' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500'}`}
              >
                <TableProperties className="w-3.5 h-3.5" />
                Tabela
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && reports.length === 0 ? (
        <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-as-gray-400" />
          <p className="text-as-gray-500">Nalagam poročila...</p>
        </div>
      ) : viewMode === 'cards' ? (
        <ReportCardsView
          departments={filteredDepartments}
          reports={reports}
          currentUser={currentUser}
          isAdmin={isAdmin}
          employees={employees}
          getResponsibleForDepartment={getResponsibleForDepartment}
          getAllReportsForDepartment={getAllReportsForDepartment}
          onEdit={(deptKey, report) => setEditingReport({ department: deptKey, existingReport: report })}
          onView={setViewingReport}
          onShowHistory={setShowHistory}
          onCreate={(deptKey) => setEditingReport({ department: deptKey, existingReport: null })}
          onDelete={deleteReport}
        />
      ) : (
        <ReportTableView
          departments={filteredDepartments}
          reports={reports}
          currentUser={currentUser}
          isAdmin={isAdmin}
          employees={employees}
          getResponsibleForDepartment={getResponsibleForDepartment}
          getAllReportsForDepartment={getAllReportsForDepartment}
          onEdit={(deptKey, report) => setEditingReport({ department: deptKey, existingReport: report })}
          onView={setViewingReport}
          onCreate={(deptKey) => setEditingReport({ department: deptKey, existingReport: null })}
          onDelete={deleteReport}
        />
      )}

      {/* Modal za urejanje */}
      {editingReport && (
        <ReportEditModal
          department={editingReport.department}
          existingReport={editingReport.existingReport}
          weekInfo={selectedWeek}
          currentUser={currentUser}
          onSave={(content, status) => saveReport(editingReport.department, content, status)}
          onClose={() => setEditingReport(null)}
        />
      )}

      {/* Modal za pregled */}
      {viewingReport && (
        <ReportViewModal
          report={viewingReport}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={() => setViewingReport(null)}
          onShowHistory={() => {
            setShowHistory(viewingReport);
            setViewingReport(null);
          }}
          onEdit={(rep) => {
            setEditingReport({ department: rep.department, existingReport: rep });
            setViewingReport(null);
          }}
          onDelete={(rep) => {
            deleteReport(rep);
            setViewingReport(null);
          }}
        />
      )}

      {/* Modal za zgodovino */}
      {showHistory && (
        <ReportHistoryModal
          report={showHistory}
          onClose={() => setShowHistory(null)}
        />
      )}
    </div>
  );
}

// =====================================
// POGLED: KARTICE
// =====================================
function ReportCardsView({ departments, reports, currentUser, isAdmin, employees, getResponsibleForDepartment, getAllReportsForDepartment, onEdit, onView, onShowHistory, onCreate, onDelete }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {departments.map(deptKey => {
        const template = REPORT_TEMPLATES[deptKey];
        const allReports = getAllReportsForDepartment(deptKey);
        const myReport = allReports.find(r => r.author_email === currentUser.email);
        const responsiblePeople = getResponsibleForDepartment(deptKey);
        const canEdit = isAdmin || responsiblePeople.some(p => p.email === currentUser.email);
        
        // Status oddelka
        const submittedCount = allReports.filter(r => r.status === 'submitted').length;
        const totalExpected = responsiblePeople.length;

        return (
          <div
            key={deptKey}
            className="bg-white border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition"
            style={{ borderColor: template.color + '30' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: template.bgColor }}
                >
                  {template.icon}
                </div>
                <div>
                  <h3 className="font-bold text-as-gray-700">{template.name}</h3>
                  <p className="text-xs text-as-gray-400">
                    {responsiblePeople.map(p => p.name).join(', ') || 'Brez dodelitve'}
                  </p>
                </div>
              </div>

              {/* Status značka */}
              {totalExpected > 0 && (
                <div 
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: submittedCount === totalExpected ? '#D1FAE5' : submittedCount > 0 ? '#FEF3C7' : '#FEE2E2',
                    color: submittedCount === totalExpected ? '#065F46' : submittedCount > 0 ? '#92400E' : '#991B1B'
                  }}
                >
                  {submittedCount}/{totalExpected} oddano
                </div>
              )}
            </div>

            {/* Vsa poročila tega oddelka (admin pogled) */}
            {isAdmin && allReports.length > 0 && (
              <div className="space-y-2 mb-3">
                {allReports.map(report => (
                  <div 
                    key={report.id}
                    className="bg-as-gray-50 border border-as-gray-100 rounded-lg p-2.5 cursor-pointer hover:bg-white transition"
                    onClick={() => onView(report)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {report.status === 'submitted' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-as-gray-700 truncate">{report.author_name}</span>
                      </div>
                      <span className="text-xs text-as-gray-400 flex-shrink-0">
                        {report.status === 'submitted' ? 'Oddano' : 'Osnutek'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Moje poročilo (če lahko piše) */}
            {canEdit && (
              <>
                {myReport ? (
                  <div className="bg-as-gray-50 border border-as-gray-100 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {myReport.status === 'submitted' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-semibold text-emerald-700">Oddano</span>
                          </>
                        ) : (
                          <>
                            <Circle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-semibold text-amber-700">Osnutek</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => onShowHistory(myReport)}
                        className="text-xs text-as-gray-500 hover:text-as-red-600 flex items-center gap-1"
                        title="Zgodovina sprememb"
                      >
                        <History className="w-3 h-3" />
                        Zgodovina
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onEdit(deptKey, myReport)}
                        className="flex-1 px-3 py-2 text-white rounded-lg text-sm font-semibold transition shadow-sm"
                        style={{ backgroundColor: template.color }}
                      >
                        <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                        Uredi poročilo
                      </button>
                      <button
                        onClick={() => onDelete(myReport)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-semibold transition"
                        title="Izbriši poročilo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onCreate(deptKey)}
                    className="w-full px-3 py-3 border-2 border-dashed rounded-lg text-sm font-semibold transition hover:bg-opacity-10"
                    style={{ 
                      borderColor: template.color, 
                      color: template.color,
                    }}
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Ustvari poročilo
                  </button>
                )}
              </>
            )}

            {!canEdit && allReports.length === 0 && (
              <p className="text-xs text-as-gray-400 italic text-center py-3">
                Še ni poročila za ta teden
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================
// POGLED: TABELA (Excel stil)
// =====================================
function ReportTableView({ departments, reports, currentUser, isAdmin, employees, getResponsibleForDepartment, getAllReportsForDepartment, onEdit, onView, onCreate, onDelete }) {
  return (
    <div className="bg-white border border-as-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-as-gray-50 border-b border-as-gray-200">
              <th className="px-4 py-3 text-left font-bold text-as-gray-700">Oddelek</th>
              <th className="px-4 py-3 text-left font-bold text-as-gray-700">Odgovorna oseba</th>
              <th className="px-4 py-3 text-center font-bold text-as-gray-700">Status</th>
              <th className="px-4 py-3 text-center font-bold text-as-gray-700">Oddano</th>
              <th className="px-4 py-3 text-right font-bold text-as-gray-700">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(deptKey => {
              const template = REPORT_TEMPLATES[deptKey];
              const allReports = getAllReportsForDepartment(deptKey);
              const responsiblePeople = getResponsibleForDepartment(deptKey);
              
              if (allReports.length === 0 && !isAdmin && !responsiblePeople.some(p => p.email === currentUser.email)) {
                return null;
              }

              if (allReports.length === 0) {
                // Prazno - ni še poročila
                const canEdit = isAdmin || responsiblePeople.some(p => p.email === currentUser.email);
                return (
                  <tr key={deptKey} className="border-b border-as-gray-100 hover:bg-as-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{template.icon}</span>
                        <span className="font-semibold text-as-gray-700">{template.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-as-gray-500">
                      {responsiblePeople.map(p => p.name).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-as-red-50 text-as-red-700 font-semibold">
                        Še ni oddano
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-as-gray-400">-</td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <button
                          onClick={() => onCreate(deptKey)}
                          className="px-3 py-1 text-white rounded-lg text-xs font-semibold transition"
                          style={{ backgroundColor: template.color }}
                        >
                          + Ustvari
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }

              return allReports.map((report, idx) => (
                <tr key={report.id} className="border-b border-as-gray-100 hover:bg-as-gray-50">
                  <td className="px-4 py-3">
                    {idx === 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{template.icon}</span>
                        <span className="font-semibold text-as-gray-700">{template.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-as-gray-700">{report.author_name}</td>
                  <td className="px-4 py-3 text-center">
                    {report.status === 'submitted' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                        ✓ Oddano
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        Osnutek
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-as-gray-500 text-xs">
                    {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString('sl-SI') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onView(report)}
                        className="p-1.5 hover:bg-as-gray-100 rounded transition text-as-gray-500"
                        title="Poglej"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(isAdmin || report.author_email === currentUser.email) && (
                        <>
                          <button
                            onClick={() => onEdit(deptKey, report)}
                            className="p-1.5 hover:bg-as-gray-100 rounded transition text-as-gray-500"
                            title="Uredi"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(report)}
                            className="p-1.5 hover:bg-red-50 rounded transition text-red-500"
                            title="Izbriši"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================
// MODAL: UREJANJE POROČILA
// =====================================
function ReportEditModal({ department, existingReport, weekInfo, currentUser, onSave, onClose }) {
  const template = REPORT_TEMPLATES[department];
  const [content, setContent] = useState(existingReport?.content || {});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGeneratedFields, setAutoGeneratedFields] = useState(new Set());

  const handleAutoGenerate = async () => {
    if (!confirm('Generiram poročilo iz vnosov za ta teden?\n\nObstoječa prazna polja bom napolnil, izpolnjena pa pustil pri miru.')) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_weekly_report', {
        p_department: department,
        p_week_start: weekInfo.weekStart,
        p_week_end: weekInfo.weekEnd
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') {
        alert('Ni podatkov za ta teden.');
        setGenerating(false);
        return;
      }
      const newContent = { ...content };
      const newAutoSet = new Set(autoGeneratedFields);
      Object.entries(data).forEach(([key, value]) => {
        const v = value == null ? '' : value.toString();
        // napolni samo prazna polja ali tiste, ki so bili auto-generirani
        if (!newContent[key] || newContent[key].toString().trim() === '' || newAutoSet.has(key)) {
          newContent[key] = v;
          if (v.trim() !== '') newAutoSet.add(key);
        }
      });
      setContent(newContent);
      setAutoGeneratedFields(newAutoSet);
    } catch (e) {
      console.error('Auto-generate napaka:', e);
      alert('Napaka: ' + e.message);
    }
    setGenerating(false);
  };

  const updateField = (key, value) => {
    setContent({ ...content, [key]: value });
  };

  const handleSave = async (status) => {
    setSaving(true);
    await onSave(content, status);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div 
          className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between"
          style={{ borderTopColor: template.color, borderTopWidth: '4px' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: template.bgColor }}
            >
              {template.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-as-gray-700">
                {existingReport ? 'Uredi poročilo' : 'Novo poročilo'} • {template.name}
              </h2>
              <p className="text-xs text-as-gray-500">
                Teden {weekInfo.weekNumber} • {formatWeekRange(weekInfo.weekStart, weekInfo.weekEnd)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: template.bgColor + '40', border: '1px dashed ' + template.color }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: template.color }}>
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span><strong>Hitra pot:</strong> Generiraj poročilo iz vnosov za ta teden in po potrebi dodaj opombe.</span>
            </div>
            <button
              onClick={handleAutoGenerate}
              disabled={generating}
              className="flex-shrink-0 px-3 py-2 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
              style={{ backgroundColor: template.color }}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {generating ? 'Generiram...' : 'Generiraj iz vnosov'}
            </button>
          </div>

          <p className="text-sm text-as-gray-500 italic">
            💡 Vsa polja so neobvezna. Lahko izpolnite samo tisto, kar je relevantno za ta teden.
          </p>

          {template.fields.map(field => {
            // Skupinski header (npr. "Število izvedenih nalogov (KOS)")
            if (field.type === 'group_header') {
              return (
                <div key={field.key} className="pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider pb-2 border-b-2" style={{ borderColor: template.color, color: template.color }}>
                    {field.label}
                  </h3>
                </div>
              );
            }

            // Številska polja (z opcijsko enoto)
            if (field.type === 'number') {
              return (
                <div key={field.key} className={field.group ? 'pl-4' : ''}>
                  <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={content[field.key] || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 pr-12 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
                    />
                    {field.unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-as-gray-300 font-medium pointer-events-none">
                        {field.unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // Tekstovna polja (textarea)
            if (field.type === 'textarea') {
              return (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <textarea
                    value={content[field.key] || ''}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400 resize-none"
                  />
                </div>
              );
            }

            // Privzeto: text
            return (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={content[field.key] || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
                />
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 text-as-gray-500 hover:bg-as-gray-100 rounded-lg text-sm font-semibold transition">
            Prekliči
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="px-4 py-2 bg-as-gray-100 text-as-gray-700 hover:bg-as-gray-200 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Save className="w-4 h-4 inline mr-1" />}
              Shrani osnutek
            </button>
            <button 
              onClick={() => handleSave('submitted')}
              disabled={saving}
              className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md disabled:opacity-50"
              style={{ backgroundColor: template.color }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <CheckCircle2 className="w-4 h-4 inline mr-1" />}
              Oddaj poročilo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================
// MODAL: PREGLED POROČILA
// =====================================
function ReportViewModal({ report, onClose, onShowHistory, onEdit, onDelete, currentUser, isAdmin }) {
  const canEdit = isAdmin || report.author_email === currentUser?.email;
  const template = REPORT_TEMPLATES[report.department];

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div 
          className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between"
          style={{ borderTopColor: template.color, borderTopWidth: '4px' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: template.bgColor }}
            >
              {template.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-as-gray-700">{template.name}</h2>
              <p className="text-xs text-as-gray-500">
                Avtor: <strong>{report.author_name}</strong> • Teden {report.week_number}/{report.week_year}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span 
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{
                backgroundColor: report.status === 'submitted' ? '#D1FAE5' : '#FEF3C7',
                color: report.status === 'submitted' ? '#065F46' : '#92400E'
              }}
            >
              {report.status === 'submitted' ? '✓ Oddano' : 'Osnutek'}
            </span>
            <div className="flex items-center gap-3">
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(report)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 text-white shadow-sm transition"
                  style={{ backgroundColor: template.color }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Uredi
                </button>
              )}
              {canEdit && onDelete && (
                <button
                  onClick={() => onDelete(report)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Izbriši
                </button>
              )}
              <button
                onClick={onShowHistory}
                className="text-xs text-as-gray-500 hover:text-as-red-600 flex items-center gap-1"
              >
                <History className="w-3 h-3" />
                Zgodovina sprememb
              </button>
            </div>
          </div>

          {template.fields.map(field => {
            // Skupinski header
            if (field.type === 'group_header') {
              // Preveri, ali so v tej skupini sploh kakšne vrednosti
              const groupKey = field.key.replace('_group', '');
              const hasValuesInGroup = template.fields.some(f => 
                f.group === groupKey && report.content[f.key] && report.content[f.key].toString().trim() !== ''
              );
              if (!hasValuesInGroup) return null;
              
              return (
                <div key={field.key} className="pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider pb-2 border-b-2" style={{ borderColor: template.color, color: template.color }}>
                    {field.label}
                  </h3>
                </div>
              );
            }

            const value = report.content[field.key];
            if (!value || value.toString().trim() === '') return null;
            
            return (
              <div key={field.key} className={`bg-as-gray-50 rounded-lg p-3 ${field.group ? 'ml-4' : ''}`}>
                <div className="text-xs font-bold text-as-gray-500 uppercase tracking-wider mb-1">
                  {field.label}
                  {field.unit && <span className="ml-1 text-as-gray-300 font-normal">({field.unit})</span>}
                </div>
                <div className="text-sm text-as-gray-700 whitespace-pre-wrap">
                  {value}
                  {field.unit && <span className="ml-1 text-as-gray-400 font-normal">{field.unit}</span>}
                </div>
              </div>
            );
          })}

          {Object.values(report.content).filter(v => v && v.toString().trim() !== '').length === 0 && (
            <p className="text-as-gray-400 italic text-center py-8">
              Poročilo je prazno. Brez vpisov.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 text-xs text-as-gray-400">
          Ustvarjeno: {new Date(report.created_at).toLocaleString('sl-SI')}
          {report.submitted_at && ` • Oddano: ${new Date(report.submitted_at).toLocaleString('sl-SI')}`}
        </div>
      </div>
    </div>
  );
}

// =====================================
// MODAL: ZGODOVINA SPREMEMB
// =====================================
function ReportHistoryModal({ report, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const template = REPORT_TEMPLATES[report.department];

  useEffect(() => {
    loadHistory();
  }, [report.id]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('report_history')
        .select('*')
        .eq('report_id', report.id)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('Napaka pri nalaganju zgodovine:', e);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-as-gray-700 flex items-center gap-2">
              <History className="w-5 h-5" />
              Zgodovina sprememb
            </h2>
            <p className="text-xs text-as-gray-500">
              {template.icon} {template.name} • {report.author_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-as-gray-400" />
              <p className="text-sm text-as-gray-500">Nalagam zgodovino...</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-as-gray-400 italic">
              Ni zgodovine sprememb. Poročilo še ni bilo urejano.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, idx) => (
                <div key={entry.id} className="border border-as-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-as-gray-700">{entry.changed_by_name}</span>
                    <span className="text-xs text-as-gray-400">
                      {new Date(entry.changed_at).toLocaleString('sl-SI')}
                    </span>
                  </div>
                  <p className="text-xs text-as-gray-500 italic">
                    Sprememba #{history.length - idx}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
