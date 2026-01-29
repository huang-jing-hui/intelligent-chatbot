import React, { useState } from 'react';
import { MessageSquare, Plus, Trash2, Pencil, Check, X, Settings } from 'lucide-react';
import { ChatSession } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<Props> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Confirmation States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameTargetTitle, setRenameTargetTitle] = useState('');

  const handleStartEdit = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title || '');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveEditTrigger = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!editValue.trim()) return;

    // Open confirmation dialog
    setRenameTargetId(id);
    setRenameTargetTitle(editValue);
    setRenameConfirmOpen(true);
  };

  const confirmRename = async () => {
    if (renameTargetId && renameTargetTitle) {
      await onRenameChat(renameTargetId, renameTargetTitle);
      setEditingId(null);
      setRenameConfirmOpen(false);
    }
  };

  const handleDeleteTrigger = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTargetId) {
      onDeleteChat(deleteTargetId);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm mb-4"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => editingId !== session.id && onSelectSession(session.id)}
            className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
              currentSessionId === session.id
                ? 'bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
            }`}
          >
            <MessageSquare className={`w-4 h-4 shrink-0 ${
               currentSessionId === session.id ? 'text-blue-500' : 'text-gray-400'
            }`} />

            <div className="flex-1 min-w-0">
              {editingId === session.id ? (
                <input
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-gray-700 border-none rounded px-1 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEditTrigger(e as any, session.id);
                    if (e.key === 'Escape') handleCancelEdit(e as any);
                  }}
                />
              ) : (
                <p className={`text-[13px] truncate ${
                  currentSessionId === session.id ? 'font-medium text-gray-900 dark:text-white' : ''
                }`}>
                  {session.title || 'New Conversation'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1">
              {editingId === session.id ? (
                <>
                  <button
                    onClick={(e) => handleSaveEditTrigger(e, session.id)}
                    className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => handleStartEdit(e, session)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTrigger(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="text-center py-10 px-4 text-gray-400 text-sm">
            No chat history
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
         <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500" />
            <div className="flex-1 min-w-0">
               <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">Hjh</p>
               <p className="text-[11px] text-gray-500 truncate">jump</p>
            </div>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-blue-500 transition-all"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
         </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="删除聊天"
        message="你确定要删掉这个聊天吗？这一行为无法撤销。"
        confirmText="Delete"
        isDestructive={true}
      />

      {/* Rename Confirmation */}
      <ConfirmDialog
        isOpen={renameConfirmOpen}
        onClose={() => setRenameConfirmOpen(false)}
        onConfirm={confirmRename}
        title="重新命名聊天"
        message={`你确定要把这个聊天改名为 "${renameTargetTitle}"?`}
        confirmText="Rename"
      />
    </div>
  );
};