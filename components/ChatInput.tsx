import { uploadFile } from '../services/api';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Maximize2, Minimize2, Loader2, Download, Eye, FileVideo, FileText, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Attachment, vlm_handlers, txt_handlers, Model } from '../types';

interface PendingAttachment extends Attachment {
  id: string; // Explicitly require id for pending attachments
  isLoading: boolean;
}

interface ChatInputProps {
  onSendMessage: (content: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStop: () => void;
  onVisualMediaChange: (hasVisual: boolean) => void;
  availableModels: Model[];
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  isLoading, 
  onStop, 
  onVisualMediaChange,
  availableModels,
  selectedModel,
  onModelSelect
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<PendingAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent about visual media presence
  useEffect(() => {
    const hasVisual = attachments.some(a => a.type === 'image' || a.type === 'video');
    onVisualMediaChange(hasVisual);
  }, [attachments, onVisualMediaChange]);

  const getFileType = (file: File): 'image' | 'video' | 'file' => {
      const ext = getExtension(file.name);
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
      if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
      return 'file';
  };

  const getExtension = (filename: string): string => {
      return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isSupportedFile = (file: File) => {
      const ext = getExtension(file.name);
      return vlm_handlers.includes(ext) || 
             txt_handlers.includes(ext) || 
             ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mov', 'm4v'].includes(ext);
  };

  const processFiles = async (files: File[]) => {
    const newPendingAttachments: PendingAttachment[] = files.map(file => {
      const type = getFileType(file);
      const ext = getExtension(file.name);
      return {
        id: uuidv4(),
        type,
        url: '', // Will be filled later
        name: file.name,
        extension: ext,
        isLoading: true
      };
    });

    // Add placeholders immediately
    setAttachments(prev => [...prev, ...newPendingAttachments]);

    // Process each file concurrently
    await Promise.all(files.map(async (file, index) => {
        const att = newPendingAttachments[index];
        try {
            const base64Data = await readFileAsDataURL(file);
            const ext = getExtension(file.name);
            const needParse = vlm_handlers.includes(ext) || txt_handlers.includes(ext);

            // Upload to server and get real URL
            const serverUrl = await uploadFile(base64Data, file.name, needParse);

            setAttachments(prev => prev.map(p =>
                p.id === att.id ? { ...p, url: serverUrl, isLoading: false } : p
            ));
        } catch (error) {
            console.error("Failed to upload file", file.name, error);
            // Remove failed attachment
            setAttachments(prev => prev.filter(p => p.id !== att.id));
        }
    }));
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(isSupportedFile);
      if (validFiles.length > 0) {
          processFiles(validFiles);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isSupportedFile(file)) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleSend = () => {
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;

    // Filter out still loading attachments or ensure we wait?
    // For now, we only send ready attachments.
    const readyAttachments = attachments.filter(a => !a.isLoading);

    onSendMessage(inputValue, readyAttachments);

    setInputValue('');
    setAttachments([]);
    setIsExpanded(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isExpanded) {
        return;
      }
      e.preventDefault();
      handleSend();
    }
  };

  const renderPreviewIcon = (att: PendingAttachment) => {
      if (att.isLoading) return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
      if (att.type === 'image') return <img src={att.url} alt={att.name} className="w-full h-full object-cover" />;
      if (att.type === 'video') return <FileVideo className="w-8 h-8 text-gray-400" />;
      return <FileText className="w-8 h-8 text-gray-400" />;
  };

  return (
    <>
      <div
        className={`p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black transition-all duration-300 ease-in-out ${
            isExpanded ? 'h-[50vh]' : 'h-auto'
        }`}
      >
        <div className={`relative flex flex-col h-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus-within:border-blue-500/50 rounded-xl overflow-hidden transition-all ${
            isExpanded ? 'p-4' : 'p-2'
        }`}>

           {/* Attachment List */}
           {attachments.length > 0 && (
             <div className="flex gap-4 mb-3 overflow-x-auto pb-2 shrink-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
               {attachments.map(att => (
                 <div key={att.id} className="relative group shrink-0 w-24 flex flex-col items-center">
                   <div
                     className="w-24 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer relative"
                     onClick={() => !att.isLoading && setPreviewAttachment(att)}
                   >
                     {renderPreviewIcon(att)}

                     {/* Hover Overlay for Preview icon */}
                     {!att.isLoading && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                        </div>
                     )}
                   </div>

                   <div className="mt-1 w-full flex flex-col items-center px-1">
                       <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center font-medium" title={att.name}>
                           {att.name}
                       </span>
                       {att.extension && (
                           <span className="text-[9px] px-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded uppercase font-bold leading-tight">
                               {att.extension}
                           </span>
                       )}
                   </div>

                   <button
                     onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                     className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 </div>
               ))}
             </div>
           )}

           <textarea
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
             onPaste={handlePaste}
             onKeyDown={handleKeyDown}
             placeholder={isLoading ? "Generating response..." : "Send a message... (Paste images/videos/files supported)"}
             disabled={isLoading}
             className={`flex-1 w-full bg-transparent border-0 focus:ring-0 outline-none resize-none py-2 text-sm ${
                 isExpanded ? 'h-full' : 'max-h-32 min-h-[44px]'
             }`}
           />

           {/* Bottom Toolbar */}
           <div className="flex items-center justify-between mt-2 pt-2 border-t border-transparent shrink-0">
              <div className="flex items-center gap-2">
                  <div className="relative group min-w-[120px]">
                    <select
                        value={selectedModel}
                        onChange={(e) => onModelSelect(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs py-1.5 pl-3 pr-8 rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors truncate"
                        disabled={isLoading}
                    >
                        {availableModels.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                  </div>

                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                  <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title="Upload image, video or file"
                      disabled={isLoading}
                  >
                      <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="*"
                      multiple
                  />
                  <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                      title={isExpanded ? "Collapse input" : "Expand input"}
                  >
                      {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
              </div>

              <div className="flex items-center gap-2">
                  {isLoading ? (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Stop</span>
                    </button>
                  ) : (
                    <button
                        onClick={handleSend}
                        disabled={(!inputValue.trim() && attachments.length === 0)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm font-medium text-sm"
                    >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                    </button>
                  )}
              </div>
           </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewAttachment(null)}>
           <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
              <button
                  onClick={() => setPreviewAttachment(null)}
                  className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
              >
                  <X className="w-8 h-8" />
              </button>

              <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 w-auto h-auto flex justify-center items-center">
                 {previewAttachment.type === 'image' ? (
                     <img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full max-h-[80vh] object-contain" />
                 ) : previewAttachment.type === 'video' ? (
                     <video src={previewAttachment.url} controls className="max-w-full max-h-[80vh]" />
                 ) : (
                     <div className="flex flex-col items-center justify-center p-20 bg-gray-900 text-white">
                         <FileText className="w-24 h-24 mb-4" />
                         <span className="text-xl">{previewAttachment.name}</span>
                     </div>
                 )}
              </div>

              <div className="flex gap-4 mt-4">
                  <a
                    href={previewAttachment.url}
                    download={previewAttachment.name}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-full font-medium transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                      <Download className="w-4 h-4" />
                      Download
                  </a>
              </div>
           </div>
        </div>
      )}
    </>
  );
};
