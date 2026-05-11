// Pomožne funkcije za naloge
import React from 'react';
import { FileText, FileSpreadsheet, FileImage } from 'lucide-react';

export const getFileIcon = (fileType) => {
  if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-as-red-600" />;
  if (fileType?.includes('sheet') || fileType?.includes('excel') || fileType?.includes('csv'))
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  if (fileType?.includes('word') || fileType?.includes('document'))
    return <FileText className="w-4 h-4 text-blue-600" />;
  if (fileType?.includes('image')) return <FileImage className="w-4 h-4 text-purple-600" />;
  return <FileText className="w-4 h-4 text-as-gray-400" />;
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

export const formatDate = (dateString) => {
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

export const isOverdue = (task) => {
  if (task.status === 'completed' || !task.due_date) return false;
  return new Date(task.due_date) < new Date();
};

export const priorityColors = {
  high: 'bg-as-red-50 text-as-red-700 border-as-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-as-gray-100 text-as-gray-500 border-as-gray-200'
};

export const priorityLabels = { high: 'Visoka', medium: 'Srednja', low: 'Nizka' };
