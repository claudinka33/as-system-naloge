import React, { useState, useEffect } from 'react';
import { Plus, Paperclip, Calendar, AlertCircle, Search, FileText, FileSpreadsheet, FileImage, X, MessageSquare, Trash2, Edit2, ChevronDown, User, CheckCircle2, Circle, Download, Lock, LogOut, Mail, Bell, Building, Tag, Users, Loader2 } from 'lucide-react';
import { supabase } from './supabase.js';

const APP_PASSWORD = 'ASsystem2026';

// E-maili z dostopom do VSEH nalog (direktor + marketing)
const ADMIN_EMAILS = ['ales.seidl@as-system.si', 'claudia.seidl@as-system.si'];

// Pravi zaposleni AS system d.o.o.
const EMPLOYEES = [
  { email: 'ales.seidl@as-system.si', name: 'Aleš Seidl', department: 'Direktor' },
  { email: 'alen.drofenik@as-system.si', name: 'Alen Drofenik', department: 'Nabava' },
  { email: 'tjasa.mihevc@as-system.si', name: 'Tjaša Mihevc', department: 'Komerciala-Prodaja' },
  { email: 'matija.marguc@as-system.si', name: 'Matija Marguč', department: 'Komerciala' },
  { email: 'sara.jagodic@as-system.si', name: 'Sara Jagodič', department: 'Računovodstvo' },
  { email: 'cvetka.seidl@as-system.si', name: 'Cvetka Seidl', department: 'Kadrovska' },
  { email: 'claudia.seidl@as-system.si', name: 'Claudia Seidl', department: 'Marketing' },
  { email: 'milena.jancic@as-system.si', name: 'Milena Jančič', department: 'Montaža' },
  { email: 'gregor.koritnik@as-system.si', name: 'Gregor Koritnik', department: 'Tehnolog' },
  { email: 'boris.cernelc@as-system.si', name: 'Boris Černelč', department: 'Proizvodnja' },
  { email: 'kakovost@as-system.si', name: 'Mitja Babič', department: 'Kakovost' },
  { email: 'zan.seidl@as-system.si', name: 'Žan Seidl', department: 'Komercialist' },
  { email: 'feliks.zekar@as-system.si', name: 'Feliks Žekar', department: 'Skladišče' },
];

const DEPARTMENTS = [...new Set(EMPLOYEES.map(e => e.department))];
const AREA_SUGGESTIONS = ['Prodaja', 'Nabava', 'Marketing', 'Računovodstvo', 'Kadrovska', 'Proizvodnja', 'Skladišče', 'Tehnolog', 'Kakovost', 'Montaža'];

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
    const email = emailInput.trim().toLowerCase();
    const user = EMPLOYEES.find(e => e.email.toLowerCase() === email);
    
    if (!user) {
      setAuthError('E-mail ne obstaja v sistemu. Preverite vnos.');
      return;
    }
    
    if (passwordInput !== APP_PASSWORD) {
      setAuthError('Napačno geslo.');
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
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          assigned_to_emails: taskData.assignedToEmails,
          company: taskData.company,
          area: taskData.area,
          department: taskData.department,
          priority: taskData.priority,
          due_date: taskData.dueDate,
          status: 'pending',
          created_by_email: currentUser.email,
          created_by_name: currentUser.name
        });

      if (error) throw error;
      
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
      if (updates.company !== undefined) dbUpdates.company = updates.company;
      if (updates.area !== undefined) dbUpdates.area = updates.area;
      if (updates.department !== undefined) dbUpdates.department = updates.department;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
      if (updates.completedByEmail !== undefined) dbUpdates.completed_by_email = updates.completedByEmail;
      if (updates.completedByName !== undefined) dbUpdates.completed_by_name = updates.completedByName;

      const { error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId);

      if (error) throw error;
      
      setEditingTask(null);
      loadTasks();
    } catch (e) {
      console.error('Napaka pri posodabljanju:', e);
      alert(`Napaka: ${e.message}`);
    }
  };

  const toggleTaskStatus = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(taskId, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      completedByEmail: newStatus === 'completed' ? currentUser.email : null,
      completedByName: newStatus === 'completed' ? currentUser.name : null
    });
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
                <Mail className="w-4 h-4" />
                E-mail
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pwd-input')?.focus()}
                placeholder="ime.priimek@as-system.si"
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
                placeholder="Vnesite geslo..."
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
              onMouseEnter={(e) => e.target.style.backgroundColor = '#A50D26'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#C8102E'}
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

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-as-red-600" />;
    if (fileType?.includes('sheet') || fileType?.includes('excel') || fileType?.includes('csv')) 
      return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    if (fileType?.includes('word') || fileType?.includes('document')) 
      return <FileText className="w-4 h-4 text-blue-600" />;
    if (fileType?.includes('image')) return <FileImage className="w-4 h-4 text-purple-600" />;
    return <FileText className="w-4 h-4 text-as-gray-400" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    if (dateOnly.getTime() === today.getTime()) return 'Danes';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Jutri';
    if (dateOnly.getTime() === yesterday.getTime()) return 'Včeraj';
    return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isOverdue = (task) => {
    if (task.status === 'completed' || !task.due_date) return false;
    return new Date(task.due_date) < new Date();
  };

  const priorityColors = {
    high: 'bg-as-red-50 text-as-red-700 border-as-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-as-gray-100 text-as-gray-500 border-as-gray-200'
  };

  const priorityLabels = { high: 'Visoka', medium: 'Srednja', low: 'Nizka' };

  const getEmployeeName = (email) => {
    if (!email) return null;
    const emp = EMPLOYEES.find(e => e.email === email);
    return emp ? emp.name : email;
  };

  const getAssignedNames = (task) => {
    const emails = task.assigned_to_emails || [];
    return emails.map(email => getEmployeeName(email));
  };

  return (
    <div className="min-h-screen" style={{fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#F5F5F5'}}>
      {/* Header */}
      <header className="bg-white border-b border-as-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="AS system" className="h-14 object-contain" />
              <div className="hidden md:block border-l border-as-gray-200 pl-3">
                <p className="text-xs text-as-gray-400 font-medium uppercase tracking-wider">Interno orodje</p>
                <p className="text-sm text-as-gray-600 font-semibold">Upravljanje nalog</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition shadow-md hover:shadow-lg"
                style={{backgroundColor: '#C8102E'}}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#A50D26'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#C8102E'}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova naloga</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <button
            onClick={() => setFilter('mine')}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'mine' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold" style={{color: '#C8102E'}}>{stats.mine}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Moje naloge</div>
          </button>
          <button
            onClick={() => setFilter('created')}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'created' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-as-gray-700">{stats.created}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Sem dodelil</div>
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'pending' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">V teku {isAdmin && '(vse)'}</div>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`bg-white border rounded-xl p-4 text-left transition hover:shadow-md ${filter === 'completed' ? 'border-as-red-400 ring-2 ring-as-red-100' : 'border-as-gray-200'}`}
          >
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Opravljene</div>
          </button>
          <div className="bg-white border border-as-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold" style={{color: '#C8102E'}}>{stats.overdue}</div>
            <div className="text-xs text-as-gray-500 mt-1 font-medium">Zamujene</div>
          </div>
        </div>

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

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-xs text-as-gray-400">
          AS system d.o.o. • Since 1993 • Interno orodje za upravljanje nalog
        </p>
      </footer>
    </div>
  );
}

function TaskCard({ task, isExpanded, onToggleExpand, onToggleStatus, onEdit, onDelete, onFileUpload, onDownloadFile, onRemoveAttachment, onAddComment, getFileIcon, formatFileSize, formatDate, isOverdue, priorityColors, priorityLabels, currentUser, isAdmin, isAssignedToMe, assignedNames }) {
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
              <span className="flex items-center gap-1">
                {assignedNames.length > 1 ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                <span className="font-medium">{assignedNames.join(', ')}</span>
              </span>
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

function TaskModal({ task, employees, areaSuggestions, currentUser, onSave, onClose }) {
  const defaultAssignee = employees.find(e => e.email !== currentUser.email) || employees[0];
  
  const initialAssignedEmails = task?.assigned_to_emails 
    || (task?.assignedToEmail ? [task.assignedToEmail] : [defaultAssignee.email]);
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignedToEmails, setAssignedToEmails] = useState(initialAssignedEmails);
  const [company, setCompany] = useState(task?.company || '');
  const [area, setArea] = useState(task?.area || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.due_date ? task.due_date.split('T')[0] : '');

  const toggleAssignee = (email) => {
    if (assignedToEmails.includes(email)) {
      if (assignedToEmails.length > 1) {
        setAssignedToEmails(assignedToEmails.filter(e => e !== email));
      }
    } else {
      setAssignedToEmails([...assignedToEmails, email]);
    }
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
    
    const firstAssignee = employees.find(e => e.email === assignedToEmails[0]);
    
    onSave({
      title: title.trim(),
      description: description.trim(),
      assignedToEmails,
      department: firstAssignee?.department,
      company: company.trim(),
      area: area.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null
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

          <div>
            <label className="block text-sm font-semibold text-as-gray-600 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Dodeljeno (komu) <span className="text-as-red-500">*</span>
                {assignedToEmails.length > 1 && (
                  <span className="ml-auto text-xs font-normal text-as-gray-400">
                    Izbrano: {assignedToEmails.length}
                  </span>
                )}
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
              Lahko izberete več oseb hkrati (vsi bodo videli nalogo).
            </p>
          </div>

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
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Npr. Prodaja, Nabava..."
                list="area-suggestions"
                className="w-full px-3 py-2 border border-as-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-as-red-100 focus:border-as-red-400"
              />
              <datalist id="area-suggestions">
                {areaSuggestions.map(a => (
                  <option key={a} value={a} />
                ))}
              </datalist>
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
