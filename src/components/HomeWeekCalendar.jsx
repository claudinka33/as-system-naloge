import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '../supabase.js';

// ============================================
// HomeWeekCalendar - tedenski pregled nalog
// na Domov strani (namesto HITRI PREGLED)
// ============================================

const DAY_HEADERS = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];

function getWeekStart(date) {
  const d = new Date(date);
  let day = d.getDay() - 1;
  if (day < 0) day = 6;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(startDate) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

function getPriorityColor(priority) {
  if (priority === 'high') return '#C8102E';
  if (priority === 'medium') return '#D97706';
  return '#6D6D6D';
}

function formatWeekTitle(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return `Teden ${startDate.getDate()}.${startDate.getMonth() + 1}. - ${endDate.getDate()}.${endDate.getMonth() + 1}.${endDate.getFullYear()}`;
}

export default function HomeWeekCalendar({ currentUser, onNavigate }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));

  useEffect(() => {
    loadTasks();
  }, [currentUser, weekStart]);

  async function loadTasks() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, status, assigned_to_emails')
        .gte('due_date', weekStart.toISOString())
        .lt('due_date', weekEnd.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;

      const mine = (data || []).filter(t =>
        (t.assigned_to_emails || []).includes(currentUser.email)
      );
      setTasks(mine);
    } catch (e) {
      console.error('Error loading week tasks:', e);
    } finally {
      setLoading(false);
    }
  }

  function getTasksForDay(date) {
    return tasks.filter(t => {
      if (!t.due_date) return false;
      return isSameDay(new Date(t.due_date), date);
    });
  }

  function navPrev() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function navNext() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const days = getWeekDays(weekStart);
  const today = new Date();

  return (
    <div>
      {/* Header z navigacijo */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-as-gray-500 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Moj teden
        </h2>
        <button
          onClick={() => onNavigate('tasks')}
          className="text-xs font-semibold text-as-red-500 hover:text-as-red-600 flex items-center gap-1"
        >
          Vse naloge
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation bar */}
      <div className="bg-white border border-as-gray-200 rounded-xl p-3 mb-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={navPrev}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold text-as-gray-700 min-w-[200px] text-center">
              {formatWeekTitle(weekStart)}
            </h3>
            <button
              onClick={navNext}
              className="p-2 hover:bg-as-gray-100 rounded-lg transition text-as-gray-500"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1.5 bg-as-gray-100 hover:bg-as-gray-200 text-as-gray-700 rounded-lg text-sm font-semibold transition"
          >
            Danes
          </button>
        </div>
      </div>

      {/* Tedenska mreža */}
      <div className="bg-white border border-as-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-as-gray-200 bg-as-gray-50">
          {DAY_HEADERS.map(day => (
            <div key={day} className="px-2 py-2 text-center text-xs font-bold text-as-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date, idx) => {
            const dayTasks = getTasksForDay(date);
            const isToday = isSameDay(date, today);

            return (
              <div
                key={idx}
                onClick={() => onNavigate('tasks')}
                className="border-r border-b border-as-gray-100 p-1.5 cursor-pointer transition hover:bg-as-gray-50"
                style={{ minHeight: '140px' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-bold ${isToday ? 'text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-as-gray-700'}`}
                    style={isToday ? { backgroundColor: '#C8102E' } : {}}
                  >
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-xs font-semibold text-as-gray-400">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayTasks.slice(0, 6).map(task => {
                    const isCompleted = task.status === 'completed';
                    return (
                      <div
                        key={task.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${isCompleted ? 'opacity-50 line-through' : ''}`}
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
                  {dayTasks.length > 6 && (
                    <div className="text-xs text-as-gray-400 px-1.5 font-semibold">
                      +{dayTasks.length - 6} več
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex items-center justify-center gap-4 flex-wrap text-xs">
        <span className="flex items-center gap-1.5 text-as-gray-600">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#C8102E' }}></span>
          Visoka
        </span>
        <span className="flex items-center gap-1.5 text-as-gray-600">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#D97706' }}></span>
          Srednja
        </span>
        <span className="flex items-center gap-1.5 text-as-gray-600">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: '#6D6D6D' }}></span>
          Nizka
        </span>
        {loading && (
          <span className="text-as-gray-400 italic">Nalagam...</span>
        )}
      </div>
    </div>
  );
}
