import React, { useState, useEffect } from 'react';
import { X, Server, Database, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { KnowledgeBaseManager } from './KnowledgeBaseManager';
import { sqlStorageService } from '../services/sql-storage';

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'server' | 'knowledgeBase';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export const SettingsPage: React.FC<SettingsPageProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('server');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedConfig();
    }
  }, [isOpen]);

  const loadSavedConfig = async () => {
    setIsLoading(true);
    try {
      // Try to load from SQL storage first
      const config = await sqlStorageService.loadConfig();
      if (config) {
        setApiUrl(config.apiUrl);
        setApiKey(config.apiKey);
      } else {
        // Fallback to localStorage
        const savedApiUrl = localStorage.getItem('apiUrl');
        const savedApiKey = localStorage.getItem('apiKey');
        if (savedApiUrl) setApiUrl(savedApiUrl);
        if (savedApiKey) setApiKey(savedApiKey);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Fallback to localStorage on error
      const savedApiUrl = localStorage.getItem('apiUrl');
      const savedApiKey = localStorage.getItem('apiKey');
      if (savedApiUrl) setApiUrl(savedApiUrl);
      if (savedApiKey) setApiKey(savedApiKey);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    setErrorMessage('');

    try {
      // Try to save to SQL storage
      await sqlStorageService.saveConfig({
        apiUrl,
        apiKey,
      });

      setSaveStatus('success');

      // Reload after 1 second to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
      setErrorMessage('保存失败，请重试');

      // Still save to localStorage as fallback
      localStorage.setItem('apiUrl', apiUrl);
      localStorage.setItem('apiKey', apiKey);

      // Clear error message after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setErrorMessage('');
      }, 3000);
    }
  };

  const menuItems = [
    { id: 'server' as SettingsSection, label: '服务端配置', icon: Server },
    { id: 'knowledgeBase' as SettingsSection, label: '知识库配置', icon: Database },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-5xl h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                  activeSection === item.id ? 'rotate-90' : ''
                }`} />
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {menuItems.find(item => item.id === activeSection)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSection === 'server' && (
              <div className="space-y-6 max-w-lg">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>加载配置中...</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API URL
                      </label>
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="http://localhost:8000"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    {/* Status Messages */}
                    {saveStatus === 'success' && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span>保存成功！正在刷新...</span>
                      </div>
                    )}

                    {saveStatus === 'error' && (
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="w-5 h-5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="pt-4">
                      <button
                        onClick={handleSaveSettings}
                        disabled={saveStatus === 'saving' || saveStatus === 'success'}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saveStatus === 'saving' && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {saveStatus === 'saving' ? '保存中...' : '保存设置'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeSection === 'knowledgeBase' && (
              <KnowledgeBaseManager />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
