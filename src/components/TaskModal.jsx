import React, { useState } from 'react';
import { X, Users, User, Building, Tag, Calendar, AlertCircle, Paperclip, Plus } from 'lucide-react';

export default function TaskModal({ task, employees, areaSuggestions, currentUser, onSave, onClose }) {
  // Privzeto: trenutni uporabnik (oseba, ki ustvarja nalogo)
  const initialAssignedEmails = task?.assigned_to_emails
    || (task?.assignedToEmail ? [task.assignedToEmail] : [currentUser.email]);

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
  const [pendingFiles, setPendingFiles] = useState([]);

  const toggleAssignee = (email) => {
    if (assignedToEmails.includes(email)) {
      if (assignedToEmails.length > 1) {
        const newList = assignedToEmails.filter(e => e !== email);
        setAssignedToEmails(newList);
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
      pendingFiles
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
