import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Eye, FolderOpen, FileText,
  ChevronLeft, RefreshCw, Database, Upload, X, FileCode,
  FileSpreadsheet, FileImage, File as FileIcon
} from 'lucide-react';
import {
  listKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase
} from '../services/api';
import { KnowledgeBase } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { KnowledgeBaseDetail } from './KnowledgeBaseDetail';

// 文件图标组件
export const FileIconComponent: React.FC<{ fileName: string }> = ({ fileName }) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-5 h-5 text-blue-500" />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    case 'ppt':
    case 'pptx':
      return <FileText className="w-5 h-5 text-orange-500" />;
    case 'md':
    case 'txt':
      return <FileCode className="w-5 h-5 text-gray-500" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <FileImage className="w-5 h-5 text-purple-500" />;
    default:
      return <FileIcon className="w-5 h-5 text-gray-400" />;
  }
};

export const KnowledgeBaseManager: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'edit'>('list');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // 删除确认状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetKB, setDeleteTargetKB] = useState<KnowledgeBase | null>(null);

  // 保存加载状态
  const [isSaving, setIsSaving] = useState(false);

  // 加载知识库列表
  const loadKnowledgeBases = async () => {
    setIsLoading(true);
    try {
      const result = await listKnowledgeBases({ limit: 100 });
      setKnowledgeBases(result);
    } catch (error) {
      console.error('加载知识库失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  // 查看知识库详情
  const handleViewKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setView('detail');
  };

  // 编辑知识库
  const handleEditKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setFormName(kb.name);
    setFormDescription(kb.description || '');
    setView('edit');
  };

  // 创建知识库
  const handleCreateKB = () => {
    setFormName('');
    setFormDescription('');
    setView('create');
  };

  // 保存知识库（创建或编辑）
  const handleSaveKB = async () => {
    if (!formName.trim()) return;

    try {
      if (view === 'create') {
        await createKnowledgeBase({
          name: formName,
          description: formDescription,
        });
      } else if (view === 'edit' && selectedKB) {
        await updateKnowledgeBase({
          kb_id: selectedKB.kb_id,
          name: formName,
          description: formDescription,
        });
      }
      await loadKnowledgeBases();
      setView('list');
    } catch (error) {
      console.error('保存知识库失败:', error);
    }
  };

  // 删除知识库
  const handleDeleteKB = (kb: KnowledgeBase) => {
    setDeleteTargetKB(kb);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteKB = async () => {
    if (!deleteTargetKB) return;

    try {
      await deleteKnowledgeBase({ kb_id: deleteTargetKB.kb_id });
      await loadKnowledgeBases();
    } catch (error) {
      console.error('删除知识库失败:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTargetKB(null);
    }
  };

  // 知识库列表视图
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">知识库列表</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadKnowledgeBases}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateKB}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增知识库
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Database className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium">暂无知识库</p>
            <p className="text-sm mt-1">点击上方"新增知识库"按钮创建一个</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.kb_id}
                className="group p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleViewKB(kb)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">{kb.name}</h4>
                      <p className="text-xs text-gray-500">{new Date(kb.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {kb.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{kb.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">ID: {kb.kb_id.slice(0, 8)}...</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditKB(kb);
                      }}
                      className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKB(kb);
                      }}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setDeleteTargetKB(null);
          }}
          onConfirm={confirmDeleteKB}
          title="删除知识库"
          message={deleteTargetKB ? `确定要删除知识库 "${deleteTargetKB.name}" 吗？此操作将同时删除所有相关文件，且无法撤销。` : ''}
          confirmText="删除"
          isDestructive={true}
        />
      </div>
    );
  }

  // 创建/编辑表单视图
  if (view === 'create' || view === 'edit') {
    return (
      <div className="max-w-lg">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {view === 'create' ? '新增知识库' : '编辑知识库'}
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              名称 *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="输入知识库名称"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              描述
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="输入知识库描述（可选）"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveKB}
              disabled={!formName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 知识库详情视图
  if (view === 'detail' && selectedKB) {
    return (
      <KnowledgeBaseDetail
        kb={selectedKB}
        onBack={() => setView('list')}
      />
    );
  }

  return null;
};
