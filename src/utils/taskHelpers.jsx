import React from 'react';
import { FileText, FileSpreadsheet, FileImage, Paperclip } from 'lucide-react';

// === HELPER FUNKCIJE ===
export const getFileIcon = (fileType) => {
  if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-as-red-600" />;
  if (fileType?.includes('sheet') || fileType?.includes('excel') || fileType?.includes('csv'))
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (fileType?.includes('image')) return <FileImage className="w-4 h-4 text-blue-600" />;
  if (fileType?.includes('word') || fileType?.includes('document')) return <FileText className="w-4 h-4 text-blue-700" />;
  return <Paperclip className="w-4 h-4 text-as-gray-400" />;
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Danes';
  if (date.toDateString() === tomorrow.toDateString()) return 'Jutri';
  if (date.toDateString() === yesterday.toDateString()) return 'Včeraj';

  return date.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' });
};

export const isOverdue = (task) => {
  if (!task.due_date || task.status === 'completed') return false;
  return new Date(task.due_date) < new Date();
};

export const priorityColors = {
  high: 'bg-as-red-50 text-as-red-700 border-as-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-as-gray-100 text-as-gray-600 border-as-gray-200'
};

export const priorityLabels = {
  high: 'Visoka',
  medium: 'Srednja',
  low: 'Nizka'
};
