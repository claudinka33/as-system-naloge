import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, User, CheckCircle2, Circle } from 'lucide-react';

export default function CalendarView({ tasks, currentUser, isAdmin, isAssignedToMe, currentDate, setCurrentDate, calendarMode, setCalendarMode, selectedDay, setSelectedDay, filterPerson, setFilterPerson, employees, onTaskClick, getEmployeeName, priorityLabels }) {

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

  const getMonthName = (date) => {
    const months = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
    return months[date.getMonth()];
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

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let firstDayWeek = firstDay.getDay() - 1;
    if (firstDayWeek < 0) firstDayWeek = 6;

    const days = [];

    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  };

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

  const title = calendarMode === 'month'
    ? `${getMonthName(currentDate)} ${currentDate.getFullYear()}`
    : `Teden ${days[0].date.getDate()}.${days[0].date.getMonth()+1}. - ${days[6].date.getDate()}.${days[6].date.getMonth()+1}.${days[6].date.getFullYear()}`;

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

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
        <div className="grid grid-cols-7 border-b border-as-gray-200 bg-as-gray-50">
          {dayHeaders.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-bold text-as-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

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
