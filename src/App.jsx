import React, { useState, useEffect } from 'react';
import { Plus, Paperclip, Calendar, AlertCircle, Search, FileText, FileSpreadsheet, FileImage, X, MessageSquare, Trash2, Edit2, ChevronDown, User, CheckCircle2, Circle, Download, Lock, LogOut, Mail, Bell, Building, Tag, Users, Loader2, List, ChevronLeft, ChevronRight, CalendarDays, ClipboardList, BarChart3, Sparkles, CalendarCheck, Home, Wallet } from 'lucide-react';
import { supabase } from './supabase.js';
import Reports from './Reports.jsx';
import { syncTaskWebhook } from './webhooks.js';
import DailyReports from './DailyReports.jsx';
import { getTodayQuote } from './quotes.js';
import { ADMIN_EMAILS, EMPLOYEES, DEPARTMENTS, AREA_SUGGESTIONS } from './constants.js';
import TaskCard from './components/TaskCard.jsx';
import TaskModal from './components/TaskModal.jsx';
import CalendarView from './components/CalendarView.jsx';
import QuoteOfTheDay from './components/QuoteOfTheDay.jsx';
import { getFileIcon, formatFileSize, formatDate, isOverdue, priorityColors, priorityLabels } from './utils/taskHelpers.jsx';
import ProductionTab, { canAccessProduction } from './components/Production/ProductionTab.jsx';
import AssemblyTab, { canAccessAssembly } from './components/Assembly/AssemblyTab.jsx';
import { Factory, Wrench } from 'lucide-react';
import HomePage from './HomePage.jsx';
import Racunovodstvo, { RACUNOVODSTVO_KATEGORIJE } from './Racunovodstvo.jsx';
import OddelekModule from './OddelekModule.jsx';
import { ShoppingCart, Briefcase, Cog, Phone, ShieldCheck, Package, FileText as FileTextIcon, TrendingUp as TrendingUpIcon, Award as AwardIcon, AlertCircle as AlertCircleIcon } from 'lucide-react';

// === KONFIGURACIJE 5 ODDELKOV ===
const NABAVA_KATEGORIJE = {
  narocila: { name: 'Naročila dobaviteljem', icon: ShoppingCart, color: '#854D0E', bgColor: '#FEF3C7', desc: 'Aktivna naročila pri dobaviteljih', subKategorije: ['Material', 'Surovine', 'Polizdelki', 'Dodatki', 'Drugo'] },
  dobavitelji: { name: 'Dobavitelji', icon: Building, color: '#1E40AF', bgColor: '#DBEAFE', desc: 'Komunikacija in dogovori z dobavitelji', subKategorije: ['Novi dobavitelj', 'Pogajanja', 'Reklamacija', 'Drugo'] },
  zaloge: { name: 'Zaloge / minimalne', icon: Package, color: '#065F46', bgColor: '#A7F3D0', desc: 'Pregled zalog in minimalnih količin', subKategorije: ['Pod minimumom', 'Nujno naročiti', 'Prevzem'] },
  cenik: { name: 'Ceniki / pogodbe', icon: FileTextIcon, color: '#5B21B6', bgColor: '#DDD6FE', desc: 'Letni ceniki in pogodbeni pogoji', subKategorije: ['Letni cenik', 'Pogodba', 'Sprememba cene'] },
  reklamacije: { name: 'Reklamacije', icon: AlertCircleIcon, color: '#B91C1C', bgColor: '#FEE2E2', desc: 'Reklamacije dobaviteljem', subKategorije: ['Kakovost', 'Količina', 'Poškodbe', 'Zamuda'] },
  drugo: { name: 'Ostalo', icon: FileTextIcon, color: '#374151', bgColor: '#E5E7EB', desc: 'Ostali vnosi nabave', subKategorije: ['Drugo'] },
};

const PRODAJA_KATEGORIJE = {
  ponudbe: { name: 'Ponudbe', icon: FileTextIcon, color: '#854D0E', bgColor: '#FEF3C7', desc: 'Pripravljene in poslane ponudbe', subKategorije: ['Nova ponudba', 'Poslana', 'Odobreno', 'Zavrnjeno'] },
  narocila_strank: { name: 'Naročila strank', icon: ShoppingCart, color: '#1E40AF', bgColor: '#DBEAFE', desc: 'Aktivna naročila strank', subKategorije: ['Novo', 'V obdelavi', 'Pripravljeno', 'Odpremljeno'] },
  stranke: { name: 'Stranke / kupci', icon: Users, color: '#065F46', bgColor: '#A7F3D0', desc: 'Komunikacija s strankami', subKategorije: ['Nova stranka', 'Klic', 'Sestanek', 'Email'] },
  reklamacije: { name: 'Reklamacije strank', icon: AlertCircleIcon, color: '#B91C1C', bgColor: '#FEE2E2', desc: 'Reklamacije od strank', subKategorije: ['Kakovost', 'Količina', 'Dostava', 'Drugo'] },
  cenik: { name: 'Cenik / popusti', icon: TrendingUpIcon, color: '#5B21B6', bgColor: '#DDD6FE', desc: 'Cenik in posebni popusti', subKategorije: ['Sprememba cenika', 'Popust za stranko', 'Akcija'] },
  drugo: { name: 'Ostalo', icon: FileTextIcon, color: '#374151', bgColor: '#E5E7EB', desc: 'Ostali vnosi prodaje', subKategorije: ['Drugo'] },
};

const TEHNOLOG_KATEGORIJE = {
  risbe: { name: 'Risbe / načrti', icon: FileTextIcon, color: '#1E40AF', bgColor: '#DBEAFE', desc: 'Tehnične risbe in načrti', subKategorije: ['Nova risba', 'Sprememba', 'Odobritev'] },
  postopki: { name: 'Tehnološki postopki', icon: Cog, color: '#854D0E', bgColor: '#FEF3C7', desc: 'Postopki izdelave in priprave', subKategorije: ['Nov postopek', 'Optimizacija', 'Nadgradnja'] },
  meritve: { name: 'Meritve / kontrole', icon: AwardIcon, color: '#065F46', bgColor: '#A7F3D0', desc: 'Meritve in tehnične kontrole', subKategorije: ['Vstopna kontrola', 'Med procesom', 'Končna kontrola'] },
  orodja: { name: 'Orodja / stroji', icon: Package, color: '#5B21B6', bgColor: '#DDD6FE', desc: 'Orodja, kalupi, vzdrževanje', subKategorije: ['Novo orodje', 'Vzdrževanje', 'Popravilo', 'Servis'] },
  razvoj: { name: 'Razvoj izdelka', icon: TrendingUpIcon, color: '#0F766E', bgColor: '#CCFBF1', desc: 'Razvoj novih in obstoječih izdelkov', subKategorije: ['Nov izdelek', 'Sprememba', 'Prototip'] },
  drugo: { name: 'Ostalo', icon: FileTextIcon, color: '#374151', bgColor: '#E5E7EB', desc: 'Ostali tehnološki vnosi', subKategorije: ['Drugo'] },
};

const KOMERCIALA_KATEGORIJE = {
  kontakti: { name: 'Kontakti / klici', icon: Phone, color: '#1E40AF', bgColor: '#DBEAFE', desc: 'Klici in komunikacija', subKategorije: ['Odhodni klic', 'Vhodni klic', 'Sestanek', 'Email'] },
  pogajanja: { name: 'Pogajanja / pogodbe', icon: FileTextIcon, color: '#854D0E', bgColor: '#FEF3C7', desc: 'Pogajanja in dolgoročne pogodbe', subKategorije: ['Nova pogodba', 'Podaljšanje', 'Spremembe pogojev'] },
  trgi: { name: 'Trgi / razvoj', icon: TrendingUpIcon, color: '#065F46', bgColor: '#A7F3D0', desc: 'Razvoj trgov in novih kupcev', subKategorije: ['Nov trg', 'Novi kupec', 'Raziskava'] },
  obiski: { name: 'Obiski strank', icon: Briefcase, color: '#5B21B6', bgColor: '#DDD6FE', desc: 'Načrtovani in opravljeni obiski', subKategorije: ['Sestanek', 'Predstavitev', 'Servis'] },
  drugo: { name: 'Ostalo', icon: FileTextIcon, color: '#374151', bgColor: '#E5E7EB', desc: 'Ostali komercialni vnosi', subKategorije: ['Drugo'] },
};

const KAKOVOST_KATEGORIJE = {
  vstopna: { name: 'Vstopna kontrola', icon: ShieldCheck, color: '#1E40AF', bgColor: '#DBEAFE', desc: 'Kontrola materiala ob prejemu', subKategorije: ['Odobreno', 'Zavrnjeno', 'Pogojno'] },
  procesna: { name: 'Procesna kontrola', icon: Cog, color: '#854D0E', bgColor: '#FEF3C7', desc: 'Kontrola med proizvodnjo', subKategorije: ['Redna', 'Izredna', 'Vzorec'] },
  koncna: { name: 'Končna kontrola', icon: AwardIcon, color: '#065F46', bgColor: '#A7F3D0', desc: 'Kontrola pred odpremo', subKategorije: ['Odobreno', 'Zavrnjeno', 'Rework'] },
  reklamacije: { name: 'Reklamacije / neskladja', icon: AlertCircleIcon, color: '#B91C1C', bgColor: '#FEE2E2', desc: 'Reklamacije in neskladja', subKategorije: ['Notranje', 'Od stranke', 'Korektivni ukrep'] },
  certifikati: { name: 'Certifikati / standardi', icon: FileTextIcon, color: '#5B21B6', bgColor: '#DDD6FE', desc: 'ISO, certifikati, standardi', subKategorije: ['ISO 9001', 'Drugi standard', 'Audit'] },
  drugo: { name: 'Ostalo', icon: FileTextIcon, color: '#374151', bgColor: '#E5E7EB', desc: 'Ostali vnosi kakovosti', subKategorije: ['Drugo'] },
};

const ODDELKI_CONFIG = {
  nabava: { name: 'Nabava', tableName: 'nabava_entries', accentColor: '#854D0E', accentBg: '#FEF3C7', icon: ShoppingCart, desc: 'Naročila, dobavitelji, zaloge, ceniki, reklamacije', categories: NABAVA_KATEGORIJE, allowedEmails: ['alen.drofenik@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'] },
  prodaja: { name: 'Prodaja', tableName: 'prodaja_entries', accentColor: '#065F46', accentBg: '#A7F3D0', icon: TrendingUpIcon, desc: 'Ponudbe, naročila strank, stranke, reklamacije', categories: PRODAJA_KATEGORIJE, allowedEmails: ['tjasa.mihevc@as-system.si', 'zan.seidl@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'] },
  tehnolog: { name: 'Tehnolog', tableName: 'tehnolog_entries', accentColor: '#1E40AF', accentBg: '#DBEAFE', icon: Cog, desc: 'Risbe, postopki, meritve, orodja, razvoj', categories: TEHNOLOG_KATEGORIJE, allowedEmails: ['gregor.koritnik@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'] },
  komerciala: { name: 'Komerciala', tableName: 'komerciala_entries', accentColor: '#5B21B6', accentBg: '#DDD6FE', icon: Phone, desc: 'Kontakti, pogajanja, trgi, obiski strank', categories: KOMERCIALA_KATEGORIJE, allowedEmails: ['prodaja@as-system.si', 'zan.seidl@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'] },
  kakovost: { name: 'Kakovost', tableName: 'kakovost_entries', accentColor: '#9F1239', accentBg: '#FFE4E6', icon: ShieldCheck, desc: 'Vstopna, procesna, končna kontrola, certifikati', categories: KAKOVOST_KATEGORIJE, allowedEmails: ['kakovost@as-system.si', 'ales.seidl@as-system.si', 'claudia.seidl@as-system.si'] },
};

// === MAIN APP COMPONENT ===




















export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('mine');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTask, setExpandedTask] = useState(null);
  
  // Koledar
  const [viewMode, setViewMode] = useState('list'); // 'list' ali 'calendar'
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' ali 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Glavni razdelek (Domov / Naloge / Dnevna / Poročila / Proizvodnja / Montaža / Računovodstvo / Oddelki)
  const [mainSection, setMainSection] = useState('home');
  // Računovodstvo: dropdown kategorija iz headerja
  const [racunovodstvoCategory, setRacunovodstvoCategory] = useState(null);
  const [racunovodstvoMenuOpen, setRacunovodstvoMenuOpen] = useState(false);
  // Reset counters za vsak modul: ko klikneš že-aktiven gumb v headerju, se modul resetira na home
  const [moduleResetCounters, setModuleResetCounters] = useState({});
  const triggerModuleReset = (key) => {
    setModuleResetCounters(c => ({ ...c, [key]: (c[key] || 0) + 1 }));
  };
  const handleModuleClick = (key) => {
    if (mainSection === key) {
      // že je aktiven → reset na home tega modula
      triggerModuleReset(key);
    } else {
      setMainSection(key);
    }
  };

  // === BROWSER HISTORY: gumb "nazaj" v brskalniku naj te peljebe nazaj v aplikacijo, NE iz nje ===
  useEffect(() => {
    // ob spremembi mainSection vrini novo stanje v history
    if (typeof window !== 'undefined') {
      window.history.pushState({ section: mainSection }, '', `#${mainSection}`);
    }
  }, [mainSection]);

  useEffect(() => {
    // poslušaj brskalniškov gumb "nazaj"
    const handlePopState = (event) => {
      const target = event.state?.section || (window.location.hash.replace('#', '') || 'home');
      if (['home','tasks','daily','reports','production','assembly','racunovodstvo','nabava','prodaja','tehnolog','komerciala','kakovost'].includes(target)) {
        setMainSection(target);
      } else {
        setMainSection('home');
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      // ob startu nastavi začetno stanje v history
      if (!window.history.state) {
        window.history.replaceState({ section: 'home' }, '', '#home');
      }
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const isAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email);

  // === LOAD SESSION ===
  useEffect(() => {
    try {
      const sessionAuth = sessionStorage.getItem('as_auth');
      const sessionEmail = sessionStorage.getItem('as_user_email');
      if (sessionAuth === 'true' && sessionEmail) {
        const user = EMPLOYEES.find(e => e.email === sessionEmail);
        if (user) {
          setAuthenticated(true);
          setCurrentUser(user);
        }
      }
    } catch (e) {}
  }, []);

  // === LOAD TASKS FROM SUPABASE ===
  useEffect(() => {
    if (authenticated && currentUser) {
      loadTasks();

      // Real-time subscription za posodobitve
      const channel = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => loadTasks())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => loadTasks())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [authenticated, currentUser]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Naloži naloge
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Naloži komentarje
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Naloži priponke
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('attachments')
        .select('*')
        .order('created_at', { ascending: true });

      if (attachmentsError) throw attachmentsError;

      // Združi
      const enrichedTasks = (tasksData || []).map(task => ({
        ...task,
        comments: (commentsData || []).filter(c => c.task_id === task.id),
        attachments: (attachmentsData || []).filter(a => a.task_id === task.id)
      }));

      setTasks(enrichedTasks);
    } catch (e) {
      console.error('Napaka pri nalaganju nalog:', e);
      alert('Napaka pri povezavi z bazo. Preverite internetno povezavo.');
    }
    setLoading(false);
  };

  const handleLogin = () => {
    const input = emailInput.trim().toLowerCase();
    
    // Najdi po uporabniškem imenu ALI po polnem e-mailu
    const user = EMPLOYEES.find(e => 
      e.username.toLowerCase() === input || 
      e.email.toLowerCase() === input
    );
    
    if (!user) {
      setAuthError('Uporabniško ime ne obstaja. Preverite vnos.');
      return;
    }
    
    if (passwordInput !== user.password) {
      setAuthError('Napačno uporabniško ime ali geslo.');
      setPasswordInput('');
      return;
    }
    
    setAuthenticated(true);
    setCurrentUser(user);
    setAuthError('');
    try {
      sessionStorage.setItem('as_auth', 'true');
      sessionStorage.setItem('as_user_email', user.email);
    } catch (e) {}
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setCurrentUser(null);
    setEmailInput('');
    setPasswordInput('');
    setTasks([]);
    setMainSection('home'); // reset na home ob odjavi
    try {
      sessionStorage.removeItem('as_auth');
      sessionStorage.removeItem('as_user_email');
    } catch (e) {}
  };

  // === FILE UPLOAD ===
  const handleFileUpload = async (event, taskId) => {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        alert(`Datoteka "${file.name}" je prevelika. Maksimalno 50MB.`);
        continue;
      }

      try {
        // Upload v storage
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const filePath = `task_${taskId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Shrani metadata
        const { error: metaError } = await supabase
          .from('attachments')
          .insert({
            task_id: taskId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
            uploaded_by_email: currentUser.email,
            uploaded_by_name: currentUser.name
          });

        if (metaError) throw metaError;
        
        loadTasks();
      } catch (e) {
        console.error('Napaka pri nalaganju datoteke:', e);
        alert(`Napaka pri nalaganju "${file.name}": ${e.message}`);
      }
    }
  };

  const downloadFile = async (file) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(file.storage_path);
      
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Napaka pri prenosu:', e);
      alert('Napaka pri prenosu datoteke.');
    }
  };

  const removeAttachment = async (attachmentId, storagePath) => {
    try {
      // Odstrani iz storage
      await supabase.storage
        .from('task-attachments')
        .remove([storagePath]);
      
      // Odstrani metadata
      await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);
      
      loadTasks();
    } catch (e) {
      console.error('Napaka pri brisanju:', e);
      alert('Napaka pri brisanju priponke.');
    }
  };

  // === TASKS CRUD ===
  const addTask = async (taskData) => {
    try {
      const { data: insertedTask, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          assigned_to_emails: taskData.assignedToEmails,
          responsible_email: taskData.responsibleEmail,
          responsible_name: taskData.responsibleName,
          company: taskData.company,
          area: taskData.area,
          department: taskData.department,
          priority: taskData.priority,
          due_date: taskData.dueDate,
          status: 'pending',
          recurring_type: taskData.recurringType || 'none',
          add_to_calendar: taskData.addToCalendar || false,
          created_by_email: currentUser.email,
          created_by_name: currentUser.name
        })
        .select()
        .single();

      if (error) throw error;
      // Pošlji v n8n: ustvari Outlook event + email
      if (insertedTask && insertedTask.due_date) {
        const result = await syncTaskWebhook('create', insertedTask, EMPLOYEES, currentUser.name);
        if (result && result.outlook_event_id) {
          await supabase
            .from('tasks')
            .update({ outlook_event_id: result.outlook_event_id })
            .eq('id', insertedTask.id);
        }
      }
      
      // Naloži priponke, če so
      if (taskData.pendingFiles && taskData.pendingFiles.length > 0 && insertedTask) {
        for (const file of taskData.pendingFiles) {
          try {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const filePath = `task_${insertedTask.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('task-attachments')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            await supabase
              .from('attachments')
              .insert({
                task_id: insertedTask.id,
                file_name: file.name,
                file_type: file.type,
                file_size: file.size,
                storage_path: filePath,
                uploaded_by_email: currentUser.email,
                uploaded_by_name: currentUser.name
              });
          } catch (fileErr) {
            console.error('Napaka pri datoteki:', file.name, fileErr);
          }
        }
      }
      
      setShowNewTask(false);
      loadTasks();
    } catch (e) {
      console.error('Napaka pri dodajanju:', e);
      alert(`Napaka pri ustvarjanju naloge: ${e.message}`);
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.assignedToEmails !== undefined) dbUpdates.assigned_to_emails = updates.assignedToEmails;
      if (updates.responsibleEmail !== undefined) dbUpdates.responsible_email = updates.responsibleEmail;
      if (updates.responsibleName !== undefined) dbUpdates.responsible_name = updates.responsibleName;
      if (updates.company !== undefined) dbUpdates.company = updates.company;
      if (updates.area !== undefined) dbUpdates.area = updates.area;
      if (updates.department !== undefined) dbUpdates.department = updates.department;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.recurringType !== undefined) dbUpdates.recurring_type = updates.recurringType;
      if (updates.addToCalendar !== undefined) dbUpdates.add_to_calendar = updates.addToCalendar;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
      if (updates.completedByEmail !== undefined) dbUpdates.completed_by_email = updates.completedByEmail;
      if (updates.completedByName !== undefined) dbUpdates.completed_by_name = updates.completedByName;

      const { error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId);

      if (error) throw error;
      // Pošlji v n8n: posodobi Outlook event + email
      const updatedTask = tasks.find(t => t.id === taskId);
      if (updatedTask && updatedTask.due_date && updatedTask.outlook_event_id) {
        const merged = { ...updatedTask, ...dbUpdates };
        await syncTaskWebhook('update', merged, EMPLOYEES, currentUser.name);
      }
      
      setEditingTask(null);
      loadTasks();
    } catch (e) {
      console.error('Napaka pri posodabljanju:', e);
      alert(`Napaka: ${e.message}`);
    }
  };

  const toggleTaskStatus = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    
    // Preveri ali sme uporabnik zaključiti
    const canComplete = isAdmin || task.responsible_email === currentUser.email;
    
    if (task.status === 'pending' && !canComplete) {
      const respName = task.responsible_name || 'odgovorna oseba';
      alert(`To nalogo lahko zaključi samo ${respName} ali admin (Aleš/Claudia).`);
      return;
    }
    
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    await updateTask(taskId, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      completedByEmail: newStatus === 'completed' ? currentUser.email : null,
      completedByName: newStatus === 'completed' ? currentUser.name : null
    });

    // Če je ponavljajoča in jo zdaj zaključiš → ustvari novo kopijo
    if (newStatus === 'completed' && task.recurring_type && task.recurring_type !== 'none') {
      try {
        // Izračunaj nov rok
        let newDueDate = null;
        if (task.due_date) {
          newDueDate = new Date(task.due_date);
          if (task.recurring_type === 'daily') newDueDate.setDate(newDueDate.getDate() + 1);
          if (task.recurring_type === 'weekly') newDueDate.setDate(newDueDate.getDate() + 7);
          if (task.recurring_type === 'monthly') newDueDate.setMonth(newDueDate.getMonth() + 1);
          newDueDate = newDueDate.toISOString();
        }

        await supabase
          .from('tasks')
          .insert({
            title: task.title,
            description: task.description,
            assigned_to_emails: task.assigned_to_emails,
            responsible_email: task.responsible_email,
            responsible_name: task.responsible_name,
            company: task.company,
            area: task.area,
            department: task.department,
            priority: task.priority,
            due_date: newDueDate,
            status: 'pending',
            recurring_type: task.recurring_type,
            recurring_parent_id: task.recurring_parent_id || task.id,
            created_by_email: task.created_by_email,
            created_by_name: task.created_by_name
          });
        
        loadTasks();
      } catch (e) {
        console.error('Napaka pri ustvarjanju ponovne naloge:', e);
      }
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Ali ste prepričani, da želite izbrisati to nalogo?')) return;
    
    try {
      // Najprej izbrišemo priponke iz storage
      const task = tasks.find(t => t.id === taskId);
      if (task?.attachments?.length > 0) {
        const paths = task.attachments.map(a => a.storage_path);
        await supabase.storage.from('task-attachments').remove(paths);
      }
      // Pošlji v n8n: izbriši Outlook event
      if (task && task.outlook_event_id) {
        await syncTaskWebhook('delete', task, EMPLOYEES, currentUser.name);
      }
      
      // Brišemo nalogo (komentarji in priponke se zbrišejo avtomatsko zaradi CASCADE)
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      loadTasks();
    } catch (e) {
      console.error('Napaka pri brisanju:', e);
      alert(`Napaka: ${e.message}`);
    }
  };

  const editComment = async (taskId, commentId, newText) => {
    if (!newText || !newText.trim()) return;
    try {
      const { error } = await supabase
        .from('comments')
        .update({ text: newText.trim(), updated_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;
      await loadTasks();
    } catch (e) {
      alert('Napaka pri urejanju komentarja: ' + e.message);
    }
  };

  const addComment = async (taskId, commentText) => {
    if (!commentText.trim()) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          text: commentText,
          author_email: currentUser.email,
          author_name: currentUser.name
        });

      if (error) throw error;
      loadTasks();
    } catch (e) {
      console.error('Napaka pri dodajanju komentarja:', e);
      alert('Napaka pri dodajanju komentarja.');
    }
  };

  // === EKRAN ZA PRIJAVO ===
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-as-gray-50 to-as-gray-100">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-as-gray-100">
          <div className="text-center mb-8">
            <img src="/logo.jpg" alt="AS system" className="h-24 mx-auto mb-4 object-contain" />
            <p className="text-as-gray-500 text-sm font-medium mt-4">Interni sistem za upravljanje nalog</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-as-gray-600 mb-2 flex items-center gap-2">
                <User className="w-4 h-4" />
                Uporabniško ime
              </label>
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pwd-input')?.focus()}
                placeholder="ime.priimek"
                className="w-full px-4 py-3 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-as-gray-600 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Geslo
              </label>
              <input
                id="pwd-input"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-200 focus:border-as-red-400"
              />
              {authError && (
                <p className="text-as-red-600 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />{authError}
                </p>
              )}
            </div>
            <button 
              onClick={handleLogin} 
              className="w-full text-white font-semibold py-3 rounded-lg transition shadow-md hover:shadow-lg"
              style={{backgroundColor: '#C8102E'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A50D26'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C8102E'}
            >
              Prijava
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-as-gray-100 text-center">
            <p className="text-xs text-as-gray-400">AS system d.o.o. • Since 1993</p>
            <p className="text-xs text-as-gray-300 mt-1">Dostop samo za zaposlene</p>
          </div>
        </div>
      </div>
    );
  }

  // === FILTRIRANJE ===
  const isAssignedToMe = (task) => {
    if (task.assigned_to_emails && Array.isArray(task.assigned_to_emails)) {
      return task.assigned_to_emails.includes(currentUser.email);
    }
    return false;
  };

  const filteredTasks = tasks.filter(task => {
    if (!isAdmin) {
      const isMine = isAssignedToMe(task);
      const iCreated = task.created_by_email === currentUser.email;
      if (!isMine && !iCreated) return false;
    }

    if (filter === 'pending' && task.status !== 'pending') return false;
    if (filter === 'completed' && task.status !== 'completed') return false;
    if (filter === 'mine' && !isAssignedToMe(task)) return false;
    if (filter === 'created' && task.created_by_email !== currentUser.email) return false;
    
    if (filterPerson !== 'all') {
      if (!task.assigned_to_emails?.includes(filterPerson)) return false;
    }
    if (filterDepartment !== 'all' && task.department !== filterDepartment) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.company?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const visibleTasks = isAdmin ? tasks : tasks.filter(t => isAssignedToMe(t) || t.created_by_email === currentUser.email);
  
  const stats = {
    mine: tasks.filter(t => isAssignedToMe(t) && t.status === 'pending').length,
    created: tasks.filter(t => t.created_by_email === currentUser.email).length,
    pending: visibleTasks.filter(t => t.status === 'pending').length,
    completed: visibleTasks.filter(t => t.status === 'completed').length,
    overdue: visibleTasks.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length,
    mineOverdue: tasks.filter(t => {
      if (!isAssignedToMe(t)) return false;
      if (t.status === 'completed') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length
  };

  const getEmployeeName = (email) => {
    if (!email) return null;
    const emp = EMPLOYEES.find(e => e.email === email);
    return emp ? emp.name : email;
  };

  const getAssignedNames = (task) => {
    const emails = task.assigned_to_emails || [];
    return emails.map(email => getEmployeeName(email));
  };

  // === Helper za navigacijo iz HomePage
  const handleHomeNavigate = (section, opts) => {
    setMainSection(section);
    if (opts?.filter) setFilter(opts.filter);
    if (section === 'tasks') setViewMode('list');
  };

  return (
    <div className="min-h-screen" style={{fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#F5F5F5'}}>
      {/* Header */}
      <header className="bg-white border-b border-as-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMainSection('home')}
                className="hover:opacity-80 transition cursor-pointer"
                title="Domov"
              >
                <img src="/logo.jpg" alt="AS system" className="h-14 object-contain" />
              </button>
              <button
                onClick={() => setMainSection('home')}
                className="hidden md:block border-l border-as-gray-200 pl-3 hover:bg-as-gray-50 rounded transition text-left cursor-pointer"
                title="Domov"
              >
                <p className="text-xs text-as-gray-400 font-medium uppercase tracking-wider">Interno orodje</p>
                <p className="text-sm text-as-gray-600 font-semibold">Upravljanje nalog</p>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* GLAVNO Stikalo: Domov / Naloge / Dnevna / Poročila / Proizvodnja / Montaža / Računovodstvo */}
              <div className="bg-as-gray-100 rounded-lg p-1 flex border border-as-gray-200 flex-wrap">
                <button
                  onClick={() => setMainSection('home')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'home' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  style={mainSection === 'home' ? {backgroundColor: '#C8102E'} : {}}
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Domov</span>
                </button>
                <button
                  onClick={() => handleModuleClick('tasks')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'tasks' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  style={mainSection === 'tasks' ? {backgroundColor: '#C8102E'} : {}}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span className="hidden sm:inline">Naloge</span>
                </button>
                <button
                  onClick={() => handleModuleClick('daily')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'daily' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  style={mainSection === 'daily' ? {backgroundColor: '#C8102E'} : {}}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Dnevna opravila</span>
                </button>
                <button
                  onClick={() => handleModuleClick('reports')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'reports' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  style={mainSection === 'reports' ? {backgroundColor: '#C8102E'} : {}}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Poročila</span>
                </button>
                {canAccessProduction(currentUser?.email) && (
                  <button
                    onClick={() => handleModuleClick('production')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'production' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                    style={mainSection === 'production' ? {backgroundColor: '#C8102E'} : {}}
                  >
                    <Factory className="w-4 h-4" />
                    <span className="hidden sm:inline">Proizvodnja</span>
                  </button>
                )}
                {canAccessAssembly(currentUser?.email) && (
                  <button
                    onClick={() => handleModuleClick('assembly')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'assembly' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                    style={mainSection === 'assembly' ? {backgroundColor: '#C8102E'} : {}}
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Montaža</span>
                  </button>
                )}
                {Object.entries(ODDELKI_CONFIG).map(([key, oddelek]) => {
                  const Icon = oddelek.icon;
                  const allowed = isAdmin || (oddelek.allowedEmails && oddelek.allowedEmails.includes(currentUser?.email));
                  if (!allowed) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => handleModuleClick(key)}
                      className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === key ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                      style={mainSection === key ? {backgroundColor: '#C8102E'} : {}}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden lg:inline">{oddelek.name}</span>
                    </button>
                  );
                })}
                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (mainSection !== 'racunovodstvo') {
                          setMainSection('racunovodstvo');
                          setRacunovodstvoMenuOpen(true);
                        } else if (racunovodstvoMenuOpen) {
                          setRacunovodstvoMenuOpen(false);
                        } else {
                          // dvojni klik na že-aktiven gumb → reset Računovodstva na vse kategorije
                          setRacunovodstvoCategory(null);
                          triggerModuleReset('racunovodstvo');
                        }
                      }}
                      className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${mainSection === 'racunovodstvo' ? 'text-white shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                      style={mainSection === 'racunovodstvo' ? {backgroundColor: '#C8102E'} : {}}
                    >
                      <Wallet className="w-4 h-4" />
                      <span className="hidden sm:inline">Računovodstvo</span>
                      <ChevronDown className={`w-3 h-3 transition ${racunovodstvoMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {racunovodstvoMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setRacunovodstvoMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-as-gray-200 rounded-xl shadow-2xl z-40 overflow-hidden w-72 max-h-[80vh] overflow-y-auto">
                          <button
                            onClick={() => {
                              setRacunovodstvoCategory(null);
                              setMainSection('racunovodstvo');
                              setRacunovodstvoMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-as-gray-50 border-b border-as-gray-100 text-sm font-bold text-as-gray-700 flex items-center gap-2"
                          >
                            <Wallet className="w-4 h-4" style={{color: '#854D0E'}} />
                            Vse kategorije
                          </button>
                          {Object.entries(RACUNOVODSTVO_KATEGORIJE || {}).map(([key, cat]) => {
                            const Icon = cat.icon;
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  setRacunovodstvoCategory(key);
                                  setMainSection('racunovodstvo');
                                  setRacunovodstvoMenuOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-as-gray-50 border-b border-as-gray-50 last:border-b-0 text-sm flex items-center gap-2"
                              >
                                <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{backgroundColor: cat.bgColor}}>
                                  <Icon className="w-3.5 h-3.5" style={{color: cat.color}} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-as-gray-700 truncate">{cat.name}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Stikalo Seznam / Koledar - SAMO ZA NALOGE */}
              {mainSection === 'tasks' && (
                <div className="bg-as-gray-100 rounded-lg p-1 flex">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Seznam</span>
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded transition flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500 hover:text-as-gray-700'}`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    <span className="hidden sm:inline">Koledar</span>
                  </button>
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-as-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Sinhroniziram...
                </div>
              )}

              {stats.mineOverdue > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-as-red-50 border border-as-red-200 rounded-lg text-xs text-as-red-700 font-semibold">
                  <Bell className="w-3.5 h-3.5" />
                  {stats.mineOverdue} zamuda
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2 bg-as-gray-100 rounded-lg text-sm">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{backgroundColor: '#C8102E'}}>
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-as-gray-700 leading-tight">{currentUser.name}</div>
                  <div className="text-xs text-as-gray-400 leading-tight">
                    {currentUser.department}
                    {isAdmin && <span className="ml-1 text-as-red-600 font-bold">• Admin</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-400 hover:text-as-gray-600"
                title="Odjava"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowNewTask(true)}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md hover:shadow-lg ${mainSection !== 'tasks' ? 'hidden' : ''}`}
                style={{backgroundColor: '#C8102E'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A50D26'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#C8102E'}
              >
                <Plus className="w-4 h-4 pointer-events-none" />
                <span className="hidden sm:inline pointer-events-none">Nova naloga</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* GLAVNI POGOJ: Domov / Naloge / Dnevna / Poročila / Proizvodnja / Montaža / Računovodstvo */}
        {mainSection === 'home' ? (
          <HomePage
            currentUser={currentUser}
            isAdmin={isAdmin}
            onNavigate={handleHomeNavigate}
          />
        ) : mainSection === 'racunovodstvo' ? (
          <Racunovodstvo
            currentUser={currentUser}
            isAdmin={isAdmin}
            employees={EMPLOYEES}
            selectedCategoryFromHeader={racunovodstvoCategory}
            onCategoryHandled={() => setRacunovodstvoCategory(undefined)}
            resetSignal={moduleResetCounters.racunovodstvo || 0}
          />
        ) : mainSection === 'nabava' ? (
          <OddelekModule config={ODDELKI_CONFIG.nabava} currentUser={currentUser} isAdmin={isAdmin} employees={EMPLOYEES} resetSignal={moduleResetCounters.nabava || 0} />
        ) : mainSection === 'prodaja' ? (
          <OddelekModule config={ODDELKI_CONFIG.prodaja} currentUser={currentUser} isAdmin={isAdmin} employees={EMPLOYEES} resetSignal={moduleResetCounters.prodaja || 0} />
        ) : mainSection === 'tehnolog' ? (
          <OddelekModule config={ODDELKI_CONFIG.tehnolog} currentUser={currentUser} isAdmin={isAdmin} employees={EMPLOYEES} resetSignal={moduleResetCounters.tehnolog || 0} />
        ) : mainSection === 'komerciala' ? (
          <OddelekModule config={ODDELKI_CONFIG.komerciala} currentUser={currentUser} isAdmin={isAdmin} employees={EMPLOYEES} resetSignal={moduleResetCounters.komerciala || 0} />
        ) : mainSection === 'kakovost' ? (
          <OddelekModule config={ODDELKI_CONFIG.kakovost} currentUser={currentUser} isAdmin={isAdmin} employees={EMPLOYEES} resetSignal={moduleResetCounters.kakovost || 0} />
        ) : mainSection === 'reports' ? (
          <Reports currentUser={currentUser} employees={EMPLOYEES} />
        ) : mainSection === 'daily' ? (
          <DailyReports currentUser={currentUser} employees={EMPLOYEES} />
        ) : mainSection === 'production' ? (
          <ProductionTab currentUser={currentUser} resetSignal={moduleResetCounters.production || 0} />
        ) : mainSection === 'assembly' ? (
          <AssemblyTab currentUser={currentUser} resetSignal={moduleResetCounters.assembly || 0} />
        ) : (
          <>
        {/* Statistike (vedno vidne) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <button
            onClick={() => { setFilter('mine'); setViewMode('list'); }}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'mine' && viewMode === 'list' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold" style={{color: '#C8102E'}}>{stats.mine}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Moje naloge</div>
          </button>
          <button
            onClick={() => { setFilter('created'); setViewMode('list'); }}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'created' && viewMode === 'list' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-as-gray-700">{stats.created}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Sem dodelil</div>
          </button>
          <button
            onClick={() => { setFilter('pending'); setViewMode('list'); }}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'pending' && viewMode === 'list' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">V teku {isAdmin && '(vse)'}</div>
          </button>
          <button
            onClick={() => { setFilter('completed'); setViewMode('list'); }}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'completed' && viewMode === 'list' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Opravljene</div>
          </button>
          <div className="bg-white border border-as-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold" style={{color: '#C8102E'}}>{stats.overdue}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Zamujene</div>
          </div>
        </div>

        {/* POGOJ: Seznam ali Koledar */}
        {viewMode === 'list' ? (
          <>
            <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-as-gray-300" />
                  <input
                    type="text"
                    placeholder="Iskanje nalog..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white font-medium"
                >
                  <option value="mine">Moje naloge</option>
                  <option value="created">Sem dodelil</option>
                  <option value="all">Vse naloge</option>
                  <option value="pending">V teku</option>
                  <option value="completed">Opravljene</option>
                </select>
                <select
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
                >
                  <option value="all">Vsi zaposleni</option>
                  {EMPLOYEES.map(emp => (
                    <option key={emp.email} value={emp.email}>{emp.name}</option>
                  ))}
                </select>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 py-2 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
                >
                  <option value="all">Vsi oddelki</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {loading && tasks.length === 0 ? (
                <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-as-gray-400" />
                  <p className="text-as-gray-500">Nalagam naloge...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="bg-white border border-as-gray-200 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 bg-as-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Circle className="w-8 h-8 text-as-gray-300" />
                  </div>
                  <p className="text-as-gray-600 font-semibold">Ni nalog za prikaz</p>
                  <p className="text-as-gray-400 text-sm mt-1">
                    {filter === 'mine' && 'Trenutno nimate nobenih dodeljenih nalog.'}
                    {filter === 'created' && 'Niste še dodelili nobene naloge.'}
                    {filter === 'all' && 'Ustvarite prvo nalogo s klikom na gumb zgoraj.'}
                    {filter === 'pending' && 'Vse naloge so opravljene.'}
                    {filter === 'completed' && 'Še ni opravljenih nalog.'}
                  </p>
                </div>
              ) : (
                filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isExpanded={expandedTask === task.id}
                    onToggleExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                    onToggleStatus={() => toggleTaskStatus(task.id)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => deleteTask(task.id)}
                    onFileUpload={(e) => handleFileUpload(e, task.id)}
                    onDownloadFile={downloadFile}
                    onRemoveAttachment={removeAttachment}
                    onEditComment={(commentId, newText) => editComment(task.id, commentId, newText)}
                onAddComment={(text) => addComment(task.id, text)}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                    isOverdue={isOverdue(task)}
                    priorityColors={priorityColors}
                    priorityLabels={priorityLabels}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    isAssignedToMe={isAssignedToMe(task)}
                    assignedNames={getAssignedNames(task)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          // KOLEDAR
          <CalendarView
            tasks={tasks}
            currentUser={currentUser}
            isAdmin={isAdmin}
            isAssignedToMe={isAssignedToMe}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            calendarMode={calendarMode}
            setCalendarMode={setCalendarMode}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            filterPerson={filterPerson}
            setFilterPerson={setFilterPerson}
            employees={EMPLOYEES}
            onTaskClick={(task) => {
              setExpandedTask(task.id);
              setViewMode('list');
            }}
            getEmployeeName={getEmployeeName}
            priorityLabels={priorityLabels}
          />
        )}
        </>
        )}
      </main>

      {(showNewTask || editingTask) && (
        <TaskModal
          task={editingTask}
          employees={EMPLOYEES}
          areaSuggestions={AREA_SUGGESTIONS}
          currentUser={currentUser}
          onSave={(data) => {
            if (editingTask) {
              updateTask(editingTask.id, data);
            } else {
              addTask(data);
            }
          }}
          onClose={() => {
            setShowNewTask(false);
            setEditingTask(null);
          }}
        />
      )}

      <footer className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6 text-center">
        <p className="text-xs text-as-gray-400">
          AS system d.o.o. • Since 1993 • Interno orodje za upravljanje nalog
        </p>
      </footer>
    </div>
  );
}

function _UNUSED_TaskCard({ task, isExpanded, onToggleExpand, onToggleStatus, onEdit, onDelete, onFileUpload, onDownloadFile, onRemoveAttachment, onAddComment, getFileIcon, formatFileSize, formatDate, isOverdue, priorityColors, priorityLabels, currentUser, isAdmin, isAssignedToMe, assignedNames }) {
  const [commentText, setCommentText] = useState('');
  const isCompleted = task.status === 'completed';

  return (
    <div className={`bg-white border rounded-xl transition shadow-sm hover:shadow-md ${isCompleted ? 'border-as-gray-200 opacity-70' : isOverdue ? 'border-as-red-300 ring-1 ring-as-red-100' : isAssignedToMe && !isCompleted ? 'border-as-red-200' : 'border-as-gray-200'}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleStatus}
            className="mt-0.5 flex-shrink-0 transition hover:scale-110"
            title={isCompleted ? 'Označi kot v teku' : 'Označi kot opravljeno'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Circle className="w-6 h-6 text-as-gray-300 hover:text-as-red-500" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className={`font-semibold ${isCompleted ? 'line-through text-as-gray-400' : 'text-as-gray-700'}`}>
                {task.title}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                {task.company && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-700 border border-as-gray-200 flex items-center gap-1 font-semibold">
                    <Building className="w-3 h-3" />
                    {task.company}
                  </span>
                )}
                {task.area && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {task.area}
                  </span>
                )}
                {isAssignedToMe && !isCompleted && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{backgroundColor: '#C8102E'}}>
                    Zame
                  </span>
                )}
                {task.priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
                    {priorityLabels[task.priority]}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-as-red-50 text-as-red-700 border border-as-red-200 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3 h-3" />
                    Zamuda
                  </span>
                )}
              </div>
            </div>

            {task.description && (
              <p className={`text-sm mt-1 ${isCompleted ? 'text-as-gray-300' : 'text-as-gray-500'}`}>
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-as-gray-400 flex-wrap">
              {task.responsible_name && (
                <span className="flex items-center gap-1 font-semibold" style={{color: '#C8102E'}}>
                  <User className="w-3 h-3" />
                  Odgovoren: {task.responsible_name}
                </span>
              )}
              {assignedNames.length > 1 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span className="font-medium">+ {assignedNames.length - 1} drugi</span>
                </span>
              )}
              {task.recurring_type && task.recurring_type !== 'none' && (
                <span className="flex items-center gap-1 text-purple-600 font-semibold">
                  <Calendar className="w-3 h-3" />
                  {task.recurring_type === 'daily' && 'Dnevno'}
                  {task.recurring_type === 'weekly' && 'Tedensko'}
                  {task.recurring_type === 'monthly' && 'Mesečno'}
                </span>
              )}
              {task.due_date && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-as-red-600 font-semibold' : ''}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
              {task.attachments?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  {task.attachments.length}
                </span>
              )}
              {task.comments?.length > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {task.comments.length}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onToggleExpand} className="p-1.5 hover:bg-as-gray-100 rounded-lg transition text-as-gray-400" title="Razširi">
              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {(currentUser.email === task.created_by_email || isAdmin) && (
              <>
                <button onClick={onEdit} className="p-1.5 hover:bg-as-gray-100 rounded-lg transition text-as-gray-400" title="Uredi">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={onDelete} className="p-1.5 hover:bg-as-red-50 hover:text-as-red-600 rounded-lg transition text-as-gray-400" title="Izbriši">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-as-gray-100 ml-9">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-as-gray-600 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4" />
                  Priponke ({task.attachments?.length || 0})
                </h4>
                <label className="cursor-pointer text-xs text-as-red-600 hover:text-as-red-700 font-semibold flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Dodaj datoteko
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
                  />
                </label>
              </div>
              {task.attachments?.length > 0 ? (
                <div className="space-y-1.5">
                  {task.attachments.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-as-gray-50 rounded-lg">
                      {getFileIcon(file.file_type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-as-gray-700 truncate">{file.file_name}</div>
                        <div className="text-xs text-as-gray-400">
                          {formatFileSize(file.file_size)} • {file.uploaded_by_name}
                        </div>
                      </div>
                      <button onClick={() => onDownloadFile(file)} className="p-1.5 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600 transition" title="Prenesi">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => onRemoveAttachment(file.id, file.storage_path)} className="p-1.5 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600 transition" title="Odstrani">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-as-gray-400 italic">Ni priponk. Dodajte PDF, Word, Excel ali sliko (max 50MB).</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-as-gray-600 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Komentarji ({task.comments?.length || 0})
              </h4>
              {task.comments?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {task.comments.map(comment => (
                    <div key={comment.id} className="bg-as-gray-50 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-as-gray-700">{comment.author_name}</span>
                        <span className="text-xs text-as-gray-400">
                          {new Date(comment.created_at).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-as-gray-600">{comment.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onAddComment(commentText);
                      setCommentText('');
                    }
                  }}
                  placeholder="Dodaj komentar..."
                  className="flex-1 px-3 py-1.5 text-sm border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
                />
                <button
                  onClick={() => {
                    onAddComment(commentText);
                    setCommentText('');
                  }}
                  className="px-3 py-1.5 text-white text-sm rounded-lg transition font-semibold"
                  style={{backgroundColor: '#C8102E'}}
                >
                  Pošlji
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-as-gray-100 text-xs text-as-gray-400 flex items-center justify-between flex-wrap gap-2">
              <span>Dodelil: <strong>{task.created_by_name}</strong> • {new Date(task.created_at).toLocaleString('sl-SI')}</span>
              {task.completed_at && (
                <span className="text-emerald-600">
                  Opravil: <strong>{task.completed_by_name}</strong> • {new Date(task.completed_at).toLocaleString('sl-SI')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function _UNUSED_TaskModal({ task, employees, areaSuggestions, currentUser, onSave, onClose }) {
  const defaultAssignee = employees.find(e => e.email !== currentUser.email) || employees[0];
  
  const initialAssignedEmails = task?.assigned_to_emails 
    || (task?.assignedToEmail ? [task.assignedToEmail] : [defaultAssignee.email]);
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignedToEmails, setAssignedToEmails] = useState(initialAssignedEmails);
  const [responsibleEmail, setResponsibleEmail] = useState(task?.responsible_email || initialAssignedEmails[0] || '');
  const [company, setCompany] = useState(task?.company || '');
  const [area, setArea] = useState(task?.area || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split('T')[0] : '');
  const [recurringType, setRecurringType] = useState(task?.recurring_type || 'none');
  const [addToCalendar, setAddToCalendar] = useState(task?.add_to_calendar || false);
  const [pendingFiles, setPendingFiles] = useState([]); // priloge ob ustvarjanju (še niso v bazi)

  const toggleAssignee = (email) => {
    if (assignedToEmails.includes(email)) {
      if (assignedToEmails.length > 1) {
        const newList = assignedToEmails.filter(e => e !== email);
        setAssignedToEmails(newList);
        // Če je odgovorna oseba odstranjena, izberi prvo iz seznama
        if (responsibleEmail === email) {
          setResponsibleEmail(newList[0]);
        }
      }
    } else {
      setAssignedToEmails([...assignedToEmails, email]);
    }
  };

  const selectAll = () => {
    const allEmails = employees.map(e => e.email);
    setAssignedToEmails(allEmails);
  };

  const deselectAll = () => {
    // Ohrani vsaj enega - trenutnega uporabnika
    setAssignedToEmails([currentUser.email]);
    setResponsibleEmail(currentUser.email);
  };

  const allSelected = assignedToEmails.length === employees.length;

  const handlePendingFilesAdd = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`Datoteka "${file.name}" je prevelika. Maksimalno 50MB.`);
        return false;
      }
      return true;
    });
    setPendingFiles([...pendingFiles, ...validFiles]);
  };

  const removePendingFile = (idx) => {
    setPendingFiles(pendingFiles.filter((_, i) => i !== idx));
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('Prosim vnesite naslov naloge');
      return;
    }
    if (assignedToEmails.length === 0) {
      alert('Prosim izberite vsaj eno osebo, kateri je naloga dodeljena');
      return;
    }
    if (!responsibleEmail || !assignedToEmails.includes(responsibleEmail)) {
      alert('Prosim izberite odgovorno osebo (mora biti med dodeljenimi)');
      return;
    }
    
    const responsibleUser = employees.find(e => e.email === responsibleEmail);
    const firstAssignee = employees.find(e => e.email === assignedToEmails[0]);
    
    onSave({
      title: title.trim(),
      description: description.trim(),
      assignedToEmails,
      responsibleEmail,
      responsibleName: responsibleUser?.name,
      department: firstAssignee?.department,
      company: company.trim(),
      area: area.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      recurringType,
      addToCalendar,
      pendingFiles // bodo naložene v App komponenti
    });
  };

  return (
    <div className="fixed inset-0 bg-as-gray-900/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-as-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-as-gray-700">
            {task ? 'Uredi nalogo' : 'Nova naloga'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-as-gray-100 rounded-lg text-as-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              Naslov naloge <span className="text-as-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Npr. Pripravi ponudbo"
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              Opis (neobvezno)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Podrobnosti o nalogi..."
              rows={3}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400 resize-none"
            />
          </div>

          {/* MULTI-SELECT prejemnikov */}
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Dodeljeno (komu) <span className="text-as-red-500">*</span>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={allSelected ? deselectAll : selectAll}
                    className="text-xs font-semibold text-as-red-600 hover:text-as-red-700 transition"
                  >
                    {allSelected ? 'Odznači vse' : 'Označi vse'}
                  </button>
                  {assignedToEmails.length > 1 && (
                    <span className="text-xs font-normal text-as-gray-400">
                      Izbrano: {assignedToEmails.length}
                    </span>
                  )}
                </span>
              </span>
            </label>
            <div className="border border-as-gray-200 rounded-lg max-h-56 overflow-y-auto bg-white">
              {employees.map(emp => {
                const isSelected = assignedToEmails.includes(emp.email);
                return (
                  <label
                    key={emp.email}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-as-gray-50 border-b border-as-gray-100 last:border-b-0 ${isSelected ? 'bg-as-red-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAssignee(emp.email)}
                      className="w-4 h-4 rounded border-as-gray-300 cursor-pointer"
                      style={{accentColor: '#C8102E'}}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-as-gray-700">{emp.name}</div>
                      <div className="text-xs text-as-gray-400">{emp.department}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-as-gray-400 mt-1.5">
              Vsi izbrani bodo videli nalogo in lahko dodajajo komentarje.
            </p>
          </div>

          {/* ODGOVORNA OSEBA */}
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" style={{color: '#C8102E'}} />
                Odgovorna oseba <span className="text-as-red-500">*</span>
              </span>
            </label>
            <select
              value={responsibleEmail}
              onChange={(e) => setResponsibleEmail(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
            >
              {assignedToEmails.map(email => {
                const emp = employees.find(e => e.email === email);
                return emp ? (
                  <option key={email} value={email}>
                    {emp.name} ({emp.department})
                  </option>
                ) : null;
              })}
            </select>
            <p className="text-xs text-as-gray-400 mt-1.5">
              Samo odgovorna oseba (ali admin) lahko označi nalogo kot opravljeno.
            </p>
          </div>

          {/* PODJETJE in PODROČJE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4" />
                  Podjetje (neobvezno)
                </span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Npr. JAGER, MUNGO, PROFIX..."
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  Področje (neobvezno)
                </span>
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400 bg-white"
              >
                <option value="">— Izberi področje —</option>
                {areaSuggestions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                Prioriteta
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
              >
                <option value="high">Visoka</option>
                <option value="medium">Srednja</option>
                <option value="low">Nizka</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                Rok (neobvezno)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100"
              />
            </div>
          </div>

          {/* PONAVLJANJE */}
          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Ponavljanje
              </span>
            </label>
            <select
              value={recurringType}
              onChange={(e) => setRecurringType(e.target.value)}
              className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
            >
              <option value="none">Brez ponavljanja (enkratna naloga)</option>
              <option value="daily">Dnevno (vsak dan)</option>
              <option value="weekly">Tedensko (vsak teden)</option>
              <option value="monthly">Mesečno (vsak mesec)</option>
            </select>
            {recurringType !== 'none' && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Naloga se bo avtomatsko ponovila po opraviti. {recurringType === 'daily' && 'Nova kopija se bo ustvarila vsak dan.'}
                {recurringType === 'weekly' && 'Nova kopija se bo ustvarila vsak teden.'}
                {recurringType === 'monthly' && 'Nova kopija se bo ustvarila vsak mesec.'}
              </p>
            )}
          </div>

          {/* OUTLOOK KOLEDAR */}
          <div>
            <label className="flex items-start gap-3 p-3 border border-as-gray-200 rounded-lg cursor-pointer hover:border-as-red-300 hover:bg-as-red-50/30 transition">
              <input
                type="checkbox"
                checked={addToCalendar}
                onChange={(e) => setAddToCalendar(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-as-gray-300 cursor-pointer"
                style={{accentColor: '#C8102E'}}
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-as-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Dodaj v Outlook koledar
                </div>
                <p className="text-xs text-as-gray-400 mt-0.5">
                  Brez tega gre samo email opomnik. Označi, če rabiš nalogo tudi v koledarju.
                </p>
              </div>
            </label>
          </div>

          {/* PRILOGE OB USTVARJANJU - samo za nove naloge */}
          {!task && (
            <div>
              <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4" />
                  Priponke (neobvezno)
                </span>
              </label>
              <label className="flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-as-gray-300 rounded-lg cursor-pointer hover:border-as-red-400 hover:bg-as-red-50 transition">
                <Plus className="w-4 h-4 text-as-gray-400" />
                <span className="text-sm text-as-gray-500 font-medium">Dodaj datoteke</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handlePendingFilesAdd}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
                />
              </label>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {pendingFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-as-gray-50 rounded-lg">
                      <Paperclip className="w-4 h-4 text-as-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-as-gray-700 truncate">{file.name}</div>
                        <div className="text-xs text-as-gray-400">{formatBytes(file.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="p-1 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-as-gray-400 mt-1.5">
                PDF, Word, Excel, slike (max 50MB na datoteko). Več priponk lahko dodaš tudi pozneje.
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-as-gray-200 px-6 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-as-gray-500 hover:bg-as-gray-100 rounded-lg text-sm font-semibold transition">
            Prekliči
          </button>
          <button 
            onClick={handleSubmit} 
            className="px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md"
            style={{backgroundColor: '#C8102E'}}
          >
            {task ? 'Shrani spremembe' : 'Ustvari nalogo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================
// KOLEDAR KOMPONENTA
// =====================================
function _UNUSED_CalendarView({ tasks, currentUser, isAdmin, isAssignedToMe, currentDate, setCurrentDate, calendarMode, setCalendarMode, selectedDay, setSelectedDay, filterPerson, setFilterPerson, employees, onTaskClick, getEmployeeName, priorityLabels }) {
  
  // Filtrirane naloge (admin vidi vse, drugi samo svoje + ki so jih ustvarili)
  const visibleTasks = tasks.filter(task => {
    if (!task.due_date) return false; // Samo naloge z rokom v koledarju
    if (!isAdmin) {
      const isMine = isAssignedToMe(task);
      const iCreated = task.created_by_email === currentUser.email;
      if (!isMine && !iCreated) return false;
    }
    if (filterPerson !== 'all') {
      if (!task.assigned_to_emails?.includes(filterPerson)) return false;
    }
    return true;
  });

  // Pomožne funkcije
  const getMonthName = (date) => {
    const months = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
    return months[date.getMonth()];
  };

  const getDayName = (dayIdx) => {
    return ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'][dayIdx];
  };

  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  const isToday = (date) => isSameDay(date, new Date());

  const getTasksForDay = (date) => {
    return visibleTasks.filter(task => {
      const taskDate = new Date(task.due_date);
      return isSameDay(taskDate, date);
    });
  };

  // Mesečni pogled — pripravi dneve za prikaz
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Prvi dan tedna (pon=0, ned=6)
    let firstDayWeek = firstDay.getDay() - 1;
    if (firstDayWeek < 0) firstDayWeek = 6;
    
    const days = [];
    
    // Dnevi prejšnjega meseca (za zapolnitev prve vrstice)
    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    
    // Dnevi tega meseca
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Dnevi naslednjega meseca (za zapolnitev zadnje vrstice)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  // Tedenski pogled — pripravi dneve
  const getWeekDays = () => {
    const start = new Date(currentDate);
    let day = start.getDay() - 1;
    if (day < 0) day = 6;
    start.setDate(start.getDate() - day);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, isCurrentMonth: true });
    }
    return days;
  };

  // Navigacija
  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (calendarMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    setCurrentDate(d);
    setSelectedDay(null);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (calendarMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    setCurrentDate(d);
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  const days = calendarMode === 'month' ? getMonthDays() : getWeekDays();
  const dayHeaders = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
  
  // Naslov
  const title = calendarMode === 'month' 
    ? `${getMonthName(currentDate)} ${currentDate.getFullYear()}`
    : `Teden ${days[0].date.getDate()}.${days[0].date.getMonth()+1}. - ${days[6].date.getDate()}.${days[6].date.getMonth()+1}.${days[6].date.getFullYear()}`;

  // Naloge za izbrani dan (spodnja sekcija)
  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

  // Barve glede na prioriteto
  const getPriorityColor = (priority) => {
    if (priority === 'high') return '#C8102E';
    if (priority === 'medium') return '#D97706';
    return '#6D6D6D';
  };

  return (
    <div>
      {/* Navigacija koledarja */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-as-gray-700 capitalize min-w-[200px] text-center">
              {title}
            </h2>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="ml-2 px-3 py-1.5 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 rounded-lg text-sm font-semibold transition"
            >
              Danes
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="px-3 py-1.5 border border-as-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-as-red-100 bg-white"
            >
              <option value="all">Vsi zaposleni</option>
              {employees.map(emp => (
                <option key={emp.email} value={emp.email}>{emp.name}</option>
              ))}
            </select>

            <div className="bg-as-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setCalendarMode('month')}
                className={`px-3 py-1 text-xs font-semibold rounded transition ${calendarMode === 'month' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500'}`}
              >
                Mesec
              </button>
              <button
                onClick={() => setCalendarMode('week')}
                className={`px-3 py-1 text-xs font-semibold rounded transition ${calendarMode === 'week' ? 'bg-white text-as-gray-700 shadow-sm' : 'text-as-gray-500'}`}
              >
                Teden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mreža koledarja */}
      <div className="bg-white border border-as-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Glave dni */}
        <div className="grid grid-cols-7 border-b border-as-gray-200 bg-as-gray-50">
          {dayHeaders.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-bold text-as-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Dnevi */}
        <div className="grid grid-cols-7">
          {days.map((dayObj, idx) => {
            const dayTasks = getTasksForDay(dayObj.date);
            const isSelected = selectedDay && isSameDay(dayObj.date, selectedDay);
            const today = isToday(dayObj.date);
            
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(dayObj.date)}
                className={`border-r border-b border-as-gray-100 p-1.5 cursor-pointer transition hover:bg-as-gray-50 ${
                  !dayObj.isCurrentMonth ? 'bg-as-gray-50/50' : ''
                } ${isSelected ? 'bg-as-red-50 ring-2 ring-as-red-200 ring-inset' : ''}`}
                style={{ minHeight: calendarMode === 'month' ? '100px' : '180px' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${
                    !dayObj.isCurrentMonth ? 'text-as-gray-300' : today ? 'text-white' : 'text-as-gray-700'
                  } ${today ? 'rounded-full w-6 h-6 flex items-center justify-center' : ''}`}
                  style={today ? {backgroundColor: '#C8102E'} : {}}>
                    {dayObj.date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-xs font-semibold text-as-gray-400">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, calendarMode === 'month' ? 3 : 8).map(task => {
                    const isCompleted = task.status === 'completed';
                    return (
                      <div
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task);
                        }}
                        className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition ${isCompleted ? 'opacity-50 line-through' : ''}`}
                        style={{
                          backgroundColor: getPriorityColor(task.priority) + '20',
                          color: getPriorityColor(task.priority),
                          borderLeft: `2px solid ${getPriorityColor(task.priority)}`
                        }}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    );
                  })}
                  {dayTasks.length > (calendarMode === 'month' ? 3 : 8) && (
                    <div className="text-xs text-as-gray-400 px-1.5 font-semibold">
                      +{dayTasks.length - (calendarMode === 'month' ? 3 : 8)} več
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spodnja sekcija — naloge izbranega dne */}
      {selectedDay && selectedDayTasks.length > 0 && (
        <div className="mt-4 bg-white border border-as-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-as-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{color: '#C8102E'}} />
            Naloge za {selectedDay.toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <div className="space-y-2">
            {selectedDayTasks.map(task => {
              const isCompleted = task.status === 'completed';
              const isMineTask = isAssignedToMe(task);
              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className={`p-3 border rounded-lg cursor-pointer transition hover:shadow-md ${isCompleted ? 'opacity-60' : ''} ${isMineTask && !isCompleted ? 'border-as-red-200 bg-as-red-50/30' : 'border-as-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-as-gray-300 flex-shrink-0" />
                      )}
                      <span className={`font-semibold ${isCompleted ? 'line-through text-as-gray-400' : 'text-as-gray-700'}`}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {task.company && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-700 border border-as-gray-200 font-semibold">
                          {task.company}
                        </span>
                      )}
                      {task.priority && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" 
                          style={{backgroundColor: getPriorityColor(task.priority) + '20', color: getPriorityColor(task.priority)}}>
                          {priorityLabels[task.priority]}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-xs text-as-gray-500 mt-1 ml-6">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-as-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {(task.assigned_to_emails || []).map(e => getEmployeeName(e)).join(', ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="mt-4 bg-white border border-as-gray-200 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 text-as-gray-600">
            <span className="w-3 h-3 rounded" style={{backgroundColor: '#C8102E'}}></span>
            Visoka prioriteta
          </span>
          <span className="flex items-center gap-1.5 text-as-gray-600">
            <span className="w-3 h-3 rounded" style={{backgroundColor: '#D97706'}}></span>
            Srednja prioriteta
          </span>
          <span className="flex items-center gap-1.5 text-as-gray-600">
            <span className="w-3 h-3 rounded" style={{backgroundColor: '#6D6D6D'}}></span>
            Nizka prioriteta
          </span>
          <span className="text-as-gray-400">•</span>
          <span className="text-as-gray-500 italic">Klikni dan za pregled, nalogo za podrobnosti</span>
        </div>
      </div>
    </div>
  );
}

// =====================================
// MISEL DNEVA - okvirček s citatom
// =====================================
function _UNUSED_QuoteOfTheDay() {
  const [dismissed, setDismissed] = React.useState(false);
  const [quote, setQuote] = React.useState(getTodayQuote());

  React.useEffect(() => {
    // Preveri ali je uporabnik danes že zaprl misel
    try {
      const today = new Date().toDateString();
      const dismissedDate = localStorage.getItem('as_quote_dismissed_date');
      if (dismissedDate === today) {
        setDismissed(true);
      }
    } catch (e) {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('as_quote_dismissed_date', new Date().toDateString());
    } catch (e) {}
  };

  if (dismissed) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-as-red-50 to-amber-50 border border-as-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/50 rounded-full transition text-as-gray-400 hover:text-as-gray-600"
        title="Skrij za danes"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3 pr-6">
        <div className="text-3xl flex-shrink-0">
          {quote.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-as-gray-500">
              Misel dneva
            </span>
          </div>
          <p className="text-sm text-as-gray-700 italic leading-relaxed">
            "{quote.text}"
          </p>
          {quote.author && (
            <p className="text-xs text-as-gray-400 mt-1 font-medium">
              — {quote.author}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
