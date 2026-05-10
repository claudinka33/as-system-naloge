import React, { useState } from 'react';
import {
  CheckCircle2, Circle, ChevronDown, Edit2, Trash2, Plus, User, Users,
  Calendar, Paperclip, MessageSquare, FileText, FileSpreadsheet, FileImage, Download, X
} from 'lucide-react';

export default function TaskCard({
  task, isExpanded, onToggleExpand, onToggleStatus, onEdit, onDelete,
  onFileUpload, onDownloadFile, onRemoveAttachment, onAddComment,
  getFileIcon, formatFileSize, formatDate, isOverdue,
  priorityColors, priorityLabels, currentUser, isAdmin, isAssignedToMe, assignedNames
}) {
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
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: priorityColors[task.priority] }}
                >
                  {priorityLabels[task.priority]}
                </span>
                {task.company && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-600">
                    {task.company}
                  </span>
                )}
                {task.area && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-as-gray-100 text-as-gray-600">
                    {task.area}
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
                  {task.attachments.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-as-gray-50 rounded-lg group">
                      <button
                        onClick={() => onDownloadFile(file)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-as-red-600 transition"
                      >
                        {getFileIcon(file.file_type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-as-gray-700 truncate">{file.file_name}</p>
                          <p className="text-xs text-as-gray-400">{formatFileSize(file.file_size)}</p>
                        </div>
                        <Download className="w-4 h-4 text-as-gray-400 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                      {(currentUser.email === task.created_by_email || file.uploaded_by_email === currentUser.email || isAdmin) && (
                        <button
                          onClick={() => onRemoveAttachment(file.id, file.storage_path)}
                          className="p-1 hover:bg-as-red-50 hover:text-as-red-600 rounded text-as-gray-400 opacity-0 group-hover:opacity-100 transition ml-2"
                          title="Odstrani"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-as-gray-400 italic">Brez priponk</p>
              )}
            </div>

            <div className="mb-3">
              <h4 className="text-sm font-semibold text-as-gray-600 mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Komentarji ({task.comments?.length || 0})
              </h4>
              {task.comments?.length > 0 && (
                <div className="space-y-2 mb-2">
                  {task.comments.map(comment => (
                    <div key={comment.id} className="bg-as-gray-50 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-as-gray-600">{comment.author_name}</span>
                        <span className="text-xs text-as-gray-400">
                          {new Date(comment.created_at).toLocaleString('sl-SI')}
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
