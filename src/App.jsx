import React, { useState, useEffect } from 'react';
import { Plus, Paperclip, Calendar, AlertCircle, Search, FileText, FileSpreadsheet, FileImage, X, MessageSquare, Trash2, Edit2, ChevronDown, User, CheckCircle2, Circle, Download, Lock, LogOut, Briefcase, Mail, Bell, Building, Tag, Users } from 'lucide-react';

const APP_PASSWORD = 'ASsystem2026';
const STORAGE_TASKS_KEY = 'as_system_tasks_v3';

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

// Predlogi področij za naloge
const AREA_SUGGESTIONS = ['Prodaja', 'Nabava', 'Marketing', 'Računovodstvo', 'Kadrovska', 'Proizvodnja', 'Skladišče', 'Tehnolog', 'Kakovost', 'Montaža'];

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filter, setFilter] = useState('mine');
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTask, setExpandedTask] = useState(null);

  const isAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email);

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
      loadTasks();
    } catch (e) {}
  }, []);

  const loadTasks = () => {
    try {
      const data = localStorage.getItem(STORAGE_TASKS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setTasks(parsed);
      }
    } catch (e) {
      console.error('Napaka pri nalaganju nalog:', e);
    }
  };

  const saveTasks = (newTasks) => {
    try {
      localStorage.setItem(STORAGE_TASKS_KEY, JSON.stringify(newTasks));
    } catch (e) {
      alert('Napaka pri shranjevanju. Lahko ste presegli prostor (5MB). Odstranite priponke.');
    }
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
    try {
      sessionStorage.removeItem('as_auth');
      sessionStorage.removeItem('as_user_email');
    } catch (e) {}
  };

  const handleFileUpload = (event, taskId) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        alert(`Datoteka "${file.name}" je prevelika. Maksimalno 2MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: e.target.result,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser.name
        };
        const updatedTasks = tasks.map(t => 
          t.id === taskId ? { ...t, attachments: [...(t.attachments || []), fileData] } : t
        );
        saveTasks(updatedTasks);
        setTasks(updatedTasks);
      };
      reader.readAsDataURL(file);
    });
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    link.click();
  };

  const removeAttachment = (taskId, fileIndex) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, attachments: t.attachments.filter((_, i) => i !== fileIndex) } : t
    );
    saveTasks(updatedTasks);
    setTasks(updatedTasks);
  };

  const addTask = (taskData) => {
    const newTask = {
      id: Date.now().toString(),
      ...taskData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      createdByEmail: currentUser.email,
      attachments: [],
      comments: []
    };
    const updatedTasks = [newTask, ...tasks];
    saveTasks(updatedTasks);
    setTasks(updatedTasks);
    setShowNewTask(false);
  };

  const updateTask = (taskId, updates) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
    saveTasks(updatedTasks);
    setTasks(updatedTasks);
    setEditingTask(null);
  };

  const toggleTaskStatus = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask(taskId, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
      completedBy: newStatus === 'completed' ? currentUser.name : null
    });
  };

  const deleteTask = (taskId) => {
    if (confirm('Ali ste prepričani, da želite izbrisati to nalogo?')) {
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      saveTasks(updatedTasks);
      setTasks(updatedTasks);
    }
  };

  const addComment = (taskId, commentText) => {
    if (!commentText.trim()) return;
    const comment = {
      id: Date.now().toString(),
      text: commentText,
      author: currentUser.name,
      createdAt: new Date().toISOString()
    };
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, comments: [...(t.comments || []), comment] } : t
    );
    saveTasks(updatedTasks);
    setTasks(updatedTasks);
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

  // Naloga je "moja", če sem v assignedToEmails ali (za nazaj kompatibilnost) assignedToEmail
  const isAssignedToMe = (task) => {
    if (task.assignedToEmails && Array.isArray(task.assignedToEmails)) {
      return task.assignedToEmails.includes(currentUser.email);
    }
    return task.assignedToEmail === currentUser.email;
  };

  const filteredTasks = tasks.filter(task => {
    // Admin (Aleš in Claudia) vidita VSE, drugi samo svoje (dodeljene ali ki so jih ustvarili)
    if (!isAdmin) {
      const isMine = isAssignedToMe(task);
      const iCreated = task.createdByEmail === currentUser.email;
      if (!isMine && !iCreated) return false;
    }

    if (filter === 'pending' && task.status !== 'pending') return false;
    if (filter === 'completed' && task.status !== 'completed') return false;
    if (filter === 'mine' && !isAssignedToMe(task)) return false;
    if (filter === 'created' && task.createdByEmail !== currentUser.email) return false;
    
    if (filterPerson !== 'all') {
      const assignedEmails = task.assignedToEmails || (task.assignedToEmail ? [task.assignedToEmail] : []);
      if (!assignedEmails.includes(filterPerson)) return false;
    }
    if (filterDepartment !== 'all' && task.department !== filterDepartment) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.company?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Statistike (admin vidi vse, drugi vidijo svoje)
  const visibleTasks = isAdmin ? tasks : tasks.filter(t => isAssignedToMe(t) || t.createdByEmail === currentUser.email);
  
  const stats = {
    mine: tasks.filter(t => isAssignedToMe(t) && t.status === 'pending').length,
    created: tasks.filter(t => t.createdByEmail === currentUser.email).length,
    pending: visibleTasks.filter(t => t.status === 'pending').length,
    completed: visibleTasks.filter(t => t.status === 'completed').length,
    overdue: visibleTasks.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length,
    mineOverdue: tasks.filter(t => {
      if (!isAssignedToMe(t)) return false;
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
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
    if (task.status === 'completed' || !task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
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
    const emails = task.assignedToEmails || (task.assignedToEmail ? [task.assignedToEmail] : []);
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
        {/* Statistike */}
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

        {/* Filtri */}
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

        {/* Seznam nalog */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
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
                onRemoveAttachment={(idx) => removeAttachment(task.id, idx)}
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
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-as-red-600 font-semibold' : ''}`}>
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.dueDate)}
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
            {(currentUser.email === task.createdByEmail || isAdmin) && (
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
            {/* Priponke */}
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
                  {task.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-as-gray-50 rounded-lg">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-as-gray-700 truncate">{file.name}</div>
                        <div className="text-xs text-as-gray-400">
                          {formatFileSize(file.size)} • {file.uploadedBy}
                        </div>
                      </div>
                      <button onClick={() => onDownloadFile(file)} className="p-1.5 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600 transition" title="Prenesi">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => onRemoveAttachment(idx)} className="p-1.5 hover:bg-white rounded text-as-gray-400 hover:text-as-red-600 transition" title="Odstrani">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-as-gray-400 italic">Ni priponk. Dodajte PDF, Word, Excel ali sliko (max 2MB).</p>
              )}
            </div>

            {/* Komentarji */}
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
                        <span className="text-xs font-bold text-as-gray-700">{comment.author}</span>
                        <span className="text-xs text-as-gray-400">
                          {new Date(comment.createdAt).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

            {/* Meta podatki */}
            <div className="mt-3 pt-3 border-t border-as-gray-100 text-xs text-as-gray-400 flex items-center justify-between flex-wrap gap-2">
              <span>Dodelil: <strong>{task.createdBy}</strong> • {new Date(task.createdAt).toLocaleString('sl-SI')}</span>
              {task.completedAt && (
                <span className="text-emerald-600">
                  Opravil: <strong>{task.completedBy}</strong> • {new Date(task.completedAt).toLocaleString('sl-SI')}
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
  
  // Podpora za starejše naloge (assignedToEmail) in nove (assignedToEmails)
  const initialAssignedEmails = task?.assignedToEmails 
    || (task?.assignedToEmail ? [task.assignedToEmail] : [defaultAssignee.email]);
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignedToEmails, setAssignedToEmails] = useState(initialAssignedEmails);
  const [company, setCompany] = useState(task?.company || '');
  const [area, setArea] = useState(task?.area || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.split('T')[0] : '');

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

          {/* MULTI-SELECT prejemnikov */}
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
