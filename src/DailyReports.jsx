import React, { useState, useEffect } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, Save, X, Loader2,
  CheckCircle2, Circle, Sparkles, Send, AlertCircle, Eye, Edit2, User
} from 'lucide-react';
import { supabase } from './supabase.js';
import { 
  REPORT_TEMPLATES, 
  USER_DEPARTMENT_MAP, 
  ADMIN_HOME_DEPARTMENT,
  getUserDepartments, 
  isReportsAdmin,
  getCurrentWeekInfo,
  getWeekInfo
} from './reportsConfig.js';
import {
  getDailyFields,
  aggregateDailyToWeekly,
  getTodayDate,
  formatShortDate,
  isFridayAfter3PM,
  getCurrentWeekDates
} from './dailyConfig.js';

export default function DailyReports({ currentUser, employees }) {
  const [dailyEntries, setDailyEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // { date, department, existingEntry }
  const [viewingPerson, setViewingPerson] = useState(null); // za admin pregled
  const [generatingWeekly, setGeneratingWeekly] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [weekDates, setWeekDates] = useState(getCurrentWeekDates());

  const isAdmin = isReportsAdmin(currentUser.email);
  const userDepts = getUserDepartments(currentUser.email);
  
  // Osebni oddelek (kjer admin piše svoje vnose)
  const myDepartments = isAdmin 
    ? (ADMIN_HOME_DEPARTMENT[currentUser.email] ? [ADMIN_HOME_DEPARTMENT[currentUser.email]] : [])
    : userDepts;

  useEffect(() => {
    loadEntries();

    const channel = supabase
      .channel('daily-entries-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, () => loadEntries())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekDates]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .gte('entry_date', weekDates[0])
        .lte('entry_date', weekDates[6])
        .order('entry_date', { ascending: true });

      if (error) throw error;
      setDailyEntries(data || []);
    } catch (e) {
      console.error('Napaka pri nalaganju dnevnih vnosov:', e);
    }
    setLoading(false);
  };

  // Pridobi vnos za določen dan + oddelek + uporabnika
  const getEntry = (date, department, email = currentUser.email) => {
    return dailyEntries.find(e => 
      e.entry_date === date && 
      e.department === department && 
      e.author_email === email
    );
  };

  // Shrani dnevni vnos
  const saveEntry = async (date, department, content) => {
    try {
      const existing = getEntry(date, department);
      
      if (existing) {
        const { error } = await supabase
          .from('daily_entries')
          .update({ content })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_entries')
          .insert({
            entry_date: date,
            department,
            content,
            author_email: currentUser.email,
            author_name: currentUser.name
          });
        if (error) throw error;
      }
      
      setEditingEntry(null);
      loadEntries();
    } catch (e) {
      console.error('Napaka pri shranjevanju:', e);
      alert(`Napaka: ${e.message}`);
    }
  };

  // Generiraj tedensko poročilo iz dnevnih vnosov
  const generateWeeklyReport = async (department) => {
    setGeneratingWeekly(department);
    try {
      // Pridobi vse moje dnevne vnose tega tedna za ta oddelek
      const myWeekEntries = dailyEntries.filter(e => 
        e.author_email === currentUser.email && 
        e.department === department
      );

      if (myWeekEntries.length === 0) {
        alert('Nimate dnevnih vnosov za ta teden. Najprej vnesite dnevna opravila.');
        setGeneratingWeekly(null);
        return;
      }

      // Združi v tedenski format
      const aggregatedContent = aggregateDailyToWeekly(department, myWeekEntries);
      
      // Shrani kot tedensko poročilo
      const weekInfo = getCurrentWeekInfo();
      
      // Preveri ali že obstaja
      const { data: existing } = await supabase
        .from('reports')
        .select('id, content')
        .eq('author_email', currentUser.email)
        .eq('department', department)
        .eq('week_year', weekInfo.weekYear)
        .eq('week_number', weekInfo.weekNumber)
        .maybeSingle();

      if (existing) {
        // Posodobi
        await supabase.from('report_history').insert({
          report_id: existing.id,
          content_before: existing.content,
          content_after: aggregatedContent,
          changed_by_email: currentUser.email,
          changed_by_name: currentUser.name
        });

        const { error } = await supabase
          .from('reports')
          .update({
            content: aggregatedContent,
            status: 'submitted',
            submitted_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (error) throw error;
        
        alert('✅ Tedensko poročilo posodobljeno! Lahko ga še uredite v razdelku "Poročila".');
      } else {
        // Ustvari novo
        const { error } = await supabase
          .from('reports')
          .insert({
            department,
            week_year: weekInfo.weekYear,
            week_number: weekInfo.weekNumber,
            week_start: weekInfo.weekStart,
            week_end: weekInfo.weekEnd,
            content: aggregatedContent,
            author_email: currentUser.email,
            author_name: currentUser.name,
            status: 'submitted',
            submitted_at: new Date().toISOString()
          });
        if (error) throw error;
        
        alert('✅ Tedensko poročilo uspešno generirano in oddano! Lahko ga še uredite v razdelku "Poročila".');
      }
    } catch (e) {
      console.error('Napaka pri generiranju:', e);
      alert(`Napaka: ${e.message}`);
    }
    setGeneratingWeekly(null);
  };

  // Navigacija po tednih
  const navigateWeek = (direction) => {
    const newMonday = new Date(weekDates[0]);
    newMonday.setDate(newMonday.getDate() + (direction * 7));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(newMonday);
      d.setDate(newMonday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setWeekDates(dates);
  };

  const goToCurrentWeek = () => {
    setWeekDates(getCurrentWeekDates());
  };

  // Za admin: katere osebe imajo vnose ta teden
  const getPeopleWithEntries = () => {
    const emailsSet = new Set(dailyEntries.map(e => e.author_email));
    return Array.from(emailsSet).map(email => {
      const emp = employees.find(e => e.email === email);
      return emp ? { email, name: emp.name, department: emp.department } : null;
    }).filter(Boolean);
  };

  const isCurrentWeek = weekDates[0] === getCurrentWeekDates()[0];
  const showFridayButton = isCurrentWeek && isFridayAfter3PM();

  // Glavni pogled - moja dnevna opravila
  return (
    <div>
      {/* Tedenska navigacija */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center min-w-[260px]">
              <div className="text-lg font-bold text-as-gray-700">
                Teden: {formatShortDate(weekDates[0])} - {formatShortDate(weekDates[6])}
              </div>
              <div className="text-xs text-as-gray-400">
                Dnevna opravila (Ponedeljek - Nedelja)
              </div>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
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
        </div>
      </div>

      {/* PETKOV INFO BANNER */}
      {showFridayButton && myDepartments.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-3xl">📊</div>
            <div className="flex-1">
              <h3 className="font-bold text-emerald-900 mb-1">Čas za tedensko poročilo!</h3>
              <p className="text-sm text-emerald-700 mb-3">
                Petek je tu. Klikni gumb spodaj, da iz tvojih dnevnih vnosov avtomatsko nastane tedensko poročilo.
                Številke se seštejejo, teksti se združijo po dnevih.
              </p>
              <div className="flex flex-wrap gap-2">
                {myDepartments.map(dept => {
                  const template = REPORT_TEMPLATES[dept];
                  if (!template) return null;
                  
                  // Število mojih vnosov za ta oddelek ta teden
                  const myEntriesCount = dailyEntries.filter(e => 
                    e.author_email === currentUser.email && e.department === dept
                  ).length;
                  
                  return (
                    <button
                      key={dept}
                      onClick={() => generateWeeklyReport(dept)}
                      disabled={generatingWeekly === dept || myEntriesCount === 0}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md hover:shadow-lg disabled:opacity-50"
                      style={{ backgroundColor: template.color }}
                    >
                      {generatingWeekly === dept ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Generiraj tedensko: {template.icon} {template.name}
                      <span className="text-xs opacity-80">({myEntriesCount} dni)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin pogled: izbira osebe */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-blue-900">Pregled drugih oseb:</span>
            <select
              value={viewingPerson || ''}
              onChange={(e) => setViewingPerson(e.target.value || null)}
              className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm bg-white"
            >
              <option value="">— Pregled mojih vnosov —</option>
              {employees.filter(emp => emp.email !== currentUser.email).map(emp => (
                <option key={emp.email} value={emp.email}>{emp.name} ({emp.department})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Glavna mreža: 5 dni × oddelki */}
      <DailyGrid
        weekDates={weekDates}
        currentUser={currentUser}
        viewingPerson={viewingPerson}
        myDepartments={myDepartments}
        dailyEntries={dailyEntries}
        loading={loading}
        onEdit={(date, department, entry) => setEditingEntry({ date, department, existingEntry: entry })}
        getEntry={getEntry}
        employees={employees}
        isAdmin={isAdmin}
      />

      {/* Modal za urejanje dnevnega vnosa */}
      {editingEntry && (
        <DailyEntryModal
          date={editingEntry.date}
          department={editingEntry.department}
          existingEntry={editingEntry.existingEntry}
          currentUser={currentUser}
          onSave={(content) => saveEntry(editingEntry.date, editingEntry.department, content)}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

// =====================================
// MREŽA: dnevi × oddelki
// =====================================
function DailyGrid({ weekDates, currentUser, viewingPerson, myDepartments, dailyEntries, loading, onEdit, getEntry, employees, isAdmin }) {
  // Določi katere oddelke prikazati
  let displayDepartments = myDepartments;
  let viewerEmail = currentUser.email;
  let canEdit = true;
  
  if (viewingPerson) {
    // Admin gleda nekoga drugega - prikaži njegove oddelke
    const personDepts = getUserDepartments(viewingPerson);
    const adminHomeDept = ADMIN_HOME_DEPARTMENT[viewingPerson];
    if (personDepts === 'admin' && adminHomeDept) {
      displayDepartments = [adminHomeDept];
    } else if (Array.isArray(personDepts)) {
      displayDepartments = personDepts;
    }
    viewerEmail = viewingPerson;
    canEdit = false; // Admin samo vidi, ne ureja drugih
  }
  
  if (displayDepartments.length === 0) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <Circle className="w-12 h-12 text-as-gray-300 mx-auto mb-3" />
        <p className="text-as-gray-600 font-semibold">Ni oddelka za prikaz</p>
        <p className="text-as-gray-400 text-sm mt-1">
          {isAdmin ? 'Izberite osebo, ali napiše svoj oddelek' : 'Vaš uporabnik nima dodeljenega oddelka.'}
        </p>
      </div>
    );
  }

  if (loading && dailyEntries.length === 0) {
    return (
      <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-as-gray-400" />
        <p className="text-as-gray-500">Nalagam dnevne vnose...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayDepartments.map(deptKey => {
        const template = REPORT_TEMPLATES[deptKey];
        if (!template) return null;
        
        return (
          <div 
            key={deptKey}
            className="bg-white border-2 rounded-xl shadow-sm overflow-hidden"
            style={{ borderColor: template.color + '30' }}
          >
            <div 
              className="px-4 py-3 border-b flex items-center gap-3"
              style={{ backgroundColor: template.bgColor + '50', borderColor: template.color + '30' }}
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: template.bgColor }}
              >
                {template.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-as-gray-700">{template.name}</h3>
                {viewingPerson && (
                  <p className="text-xs text-as-gray-500">
                    Vnosi osebe: {employees.find(e => e.email === viewingPerson)?.name}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 p-3">
              {weekDates.map(date => {
                const entry = getEntry(date, deptKey, viewerEmail);
                const dateObj = new Date(date);
                const isToday = date === getTodayDate();
                const filledFieldsCount = entry?.content 
                  ? Object.values(entry.content).filter(v => v && v.toString().trim() !== '').length
                  : 0;
                
                return (
                  <div
                    key={date}
                    className={`border rounded-lg p-3 transition ${
                      isToday 
                        ? 'border-as-red-400 ring-2 ring-as-red-100 bg-as-red-50/30'
                        : entry 
                          ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-400'
                          : 'border-as-gray-200 hover:border-as-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className={`text-sm font-bold ${isToday ? 'text-as-red-600' : 'text-as-gray-700'}`}>
                          {formatShortDate(date)}
                        </div>
                        {isToday && <div className="text-xs text-as-red-500 font-semibold">DANES</div>}
                      </div>
                      {entry ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-as-gray-300" />
                      )}
                    </div>
                    
                    {entry ? (
                      <div className="text-xs text-as-gray-500 mb-2">
                        ✓ {filledFieldsCount} polj izpolnjenih
                      </div>
                    ) : (
                      <div className="text-xs text-as-gray-400 italic mb-2">
                        Brez vnosa
                      </div>
                    )}
                    
                    {canEdit && (
                      <button
                        onClick={() => onEdit(date, deptKey, entry)}
                        className="w-full px-2 py-1.5 text-xs font-semibold rounded-md transition border"
                        style={{ 
                          color: template.color,
                          borderColor: template.color + '40',
                        }}
                      >
                        {entry ? <><Edit2 className="w-3 h-3 inline mr-1" />Uredi</> : <><Plus className="w-3 h-3 inline mr-1" />Dodaj</>}
                      </button>
                    )}
                    
                    {!canEdit && entry && (
                      <button
                        onClick={() => onEdit(date, deptKey, entry)}
                        className="w-full px-2 py-1.5 text-xs font-semibold rounded-md transition border bg-white"
                        style={{ 
                          color: template.color,
                          borderColor: template.color + '40',
                        }}
                      >
                        <Eye className="w-3 h-3 inline mr-1" />
                        Poglej
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================
// MODAL: VNOS / UREJANJE dnevnega vnosa
// =====================================
function DailyEntryModal({ date, department, existingEntry, currentUser, onSave, onClose }) {
  const template = REPORT_TEMPLATES[department];
  const fields = getDailyFields(department);
  const [content, setContent] = useState(existingEntry?.content || {});
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => {
    setContent({ ...content, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(content);
    setSaving(false);
  };

  const dateObj = new Date(date);

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
                {existingEntry ? 'Uredi dnevni vnos' : 'Dnevni vnos'} • {template.name}
              </h2>
              <p className="text-xs text-as-gray-500">
                {dateObj.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-as-gray-500 italic">
            💡 Vnesite samo to, kar je relevantno za TA DAN. V petek se vsi dnevni vnosi avtomatsko združijo v tedensko poročilo.
          </p>

          {fields.map(field => {
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
                    rows={2}
                    className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400 resize-none"
                  />
                </div>
              );
            }

            return null;
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-between gap-2">
          <button onClick={onClose} className="px-4 py-2 text-as-gray-500 hover:bg-as-gray-100 rounded-lg text-sm font-semibold transition">
            Prekliči
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md disabled:opacity-50"
            style={{ backgroundColor: template.color }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Save className="w-4 h-4 inline mr-1" />}
            Shrani vnos
          </button>
        </div>
      </div>
    </div>
  );
}
