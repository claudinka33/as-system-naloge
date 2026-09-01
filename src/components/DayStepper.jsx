// DayStepper.jsx — datumski izbirnik s puščicama ‹ › za korak po en dan + gumb "Danes".
// Uporablja lokalni čas (ne toISOString), da ni zamika zaradi UTC+2.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function shiftDay(dateStr, n) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DayStepper({ value, onChange, className, showToday = true }) {
  const inputCls = className || 'px-3 py-2 border border-as-gray-200 rounded-lg bg-white text-base sm:text-sm';
  const btnCls = 'p-2 border border-as-gray-200 rounded-lg bg-white hover:bg-as-gray-100 text-as-gray-600 transition';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" title="Prejšnji dan" aria-label="Prejšnji dan"
        onClick={() => onChange(shiftDay(value, -1))} className={btnCls}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      <button type="button" title="Naslednji dan" aria-label="Naslednji dan"
        onClick={() => onChange(shiftDay(value, 1))} className={btnCls}>
        <ChevronRight className="w-4 h-4" />
      </button>
      {showToday && value !== todayStr() && (
        <button type="button" onClick={() => onChange(todayStr())}
          className="px-3 py-2 border border-as-gray-200 rounded-lg bg-white hover:bg-as-gray-100 text-xs font-bold text-as-gray-600 transition">
          Danes
        </button>
      )}
    </div>
  );
}
