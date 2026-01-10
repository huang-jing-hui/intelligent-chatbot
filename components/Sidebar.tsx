import React from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { ChatSession } from '../types';

interface Props {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<Props> = ({ sessions, currentSessionId, onSelectSession, onNewChat, onDeleteChat }) => {
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
            onClick={() => onSelectSession(session.id)}
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
              <p className={`text-sm truncate ${
                 currentSessionId === session.id ? 'font-medium text-gray-900 dark:text-white' : ''
              }`}>
                {session.title || 'New Conversation'}
              </p>
            </div>
            <button
              onClick={(e) => onDeleteChat(session.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
               <p className="text-sm font-medium text-gray-900 dark:text-white truncate">User</p>
               <p className="text-xs text-gray-500 truncate">Pro Plan</p>
            </div>
         </div>
      </div>
    </div>
  );
};
