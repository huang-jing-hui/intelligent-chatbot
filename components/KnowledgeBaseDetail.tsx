import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, RefreshCw, Upload, Trash2, X, FileText,
  AlertCircle, RefreshCw as RefreshIcon, Eye, FileIcon
} from 'lucide-react';
import {
  listKBFiles, deleteFileFromKnowledgeBase, storeDocument, searchDocuments
} from '../services/api';
import { KnowledgeBase, KBFile, SearchResult } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { FileIconComponent } from './KnowledgeBaseManager';

interface KnowledgeBaseDetailProps {
  kb: KnowledgeBase;
  onBack: () => void;
}

// 文档块查看器组件
const DocumentChunkViewer: React.FC<{
  kbId: string;
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}> = ({ kbId, fileUrl, fileName, onClose }) => {
  const [chunks, setChunks] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadChunks();
  }, []);

  const loadChunks = async () => {
    setIsLoading(true);
    try {
      const results = await searchDocuments({
        query: '',
        knowledge_base_id: kbId,
        k: 100,
      });
      const fileChunks = results.filter(
        (r) => r.metadata?.source === fileUrl || r.metadata?.file_url === fileUrl
      );
      setChunks(fileChunks);
    } catch (error) {
      console.error('加载文档块失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-3xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <FileIconComponent fileName={fileName} />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">文档块列表</h3>
              <p className="text-sm text-gray-500 line-clamp-1">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshIcon className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mb-3 text-gray-300" />
              <p>暂无文档块</p>
              <p className="text-sm mt-1">该文件可能尚未完成处理</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      块 #{chunk.metadata?.chunk_index ?? index + 1}
                    </span>
                    {chunk.metadata?.parent_id && (
                      <span className="text-xs text-gray-500">
                        父文档: {chunk.metadata.parent_id.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">共 {chunks.length} 个文档块</span>
            <button
              onClick={loadChunks}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <RefreshIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const KnowledgeBaseDetail: React.FC<KnowledgeBaseDetailProps> = ({ kb, onBack }) => {
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetFile, setDeleteTargetFile] = useState<KBFile | null>(null);

  // 加载文件列表
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await listKBFiles({ kb_id: kb.kb_id });
      setFiles(result);
    } catch (error) {
      console.error('加载文件列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [kb.kb_id]);

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  // 上传文件
  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(uploadFile);
      reader.onload = async () => {
        const base64 = reader.result as string;

        try {
          const { uploadFile: uploadToServer } = await import('../services/api');
          const fileUrl = await uploadToServer(base64, uploadFile.name, true);

          await storeDocument({
            file_url: fileUrl,
            file_base64: base64.split(',')[1],
            knowledge_base_id: kb.kb_id,
            file_name: uploadFile.name,
          });

          await loadFiles();
          setUploadModalOpen(false);
          setUploadFile(null);
        } catch (err) {
          console.error('上传失败:', err);
        }
      };
    } catch (error) {
      console.error('上传文件失败:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // 删除文件
  const handleDeleteFile = (file: KBFile) => {
    setDeleteTargetFile(file);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!deleteTargetFile) return;

    try {
      await deleteFileFromKnowledgeBase({
        file_url: deleteTargetFile.file_url,
        kb_id: kb.kb_id,
      });
      await loadFiles();
    } catch (error) {
      console.error('删除文件失败:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTargetFile(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{kb.name}</h3>
            {kb.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{kb.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
              <span>ID: {kb.kb_id}</span>
              <span>创建于: {new Date(kb.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFiles}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            上传文件
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">文件列表</h4>
            <span className="text-xs text-gray-500">共 {files.length} 个文件</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mb-3 text-gray-300" />
            <p>暂无文件</p>
            <p className="text-sm mt-1">点击上方"上传文件"按钮添加</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {files.map((file) => {
              const fileName = file.file_url.split('/').pop() || file.file_url;
              return (
                <div
                  key={file.id}
                  className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <FileIconComponent fileName={fileName} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{fileName}</p>
                        <p className="text-xs text-gray-500">ID: {file.id} · 创建于: {new Date(file.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteFile(file)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 文件上传弹窗 */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">上传文件</h3>
              <button
                onClick={() => {
                  setUploadModalOpen(false);
                  setUploadFile(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                {uploadFile ? (
                  <div className="space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-blue-500" />
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                    <button
                      onClick={() => setUploadFile(null)}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      移除文件
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">点击选择文件或拖拽到此处</p>
                    <p className="text-xs text-gray-400 mt-1">支持 PDF、Word、TXT、MD 等格式</p>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setUploadModalOpen(false);
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  {isUploading ? '上传中...' : '上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 删除文件确认 */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetFile(null);
        }}
        onConfirm={confirmDeleteFile}
        title="删除文件"
        message={deleteTargetFile ? `确定要从知识库中删除文件 "${deleteTargetFile.file_url.split('/').pop()}" 吗？此操作无法撤销。` : ''}
        confirmText="删除"
        isDestructive={true}
      />
    </div>
  );
};
