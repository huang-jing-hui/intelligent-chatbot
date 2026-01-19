import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Message, MessagePart, ToolCall, ToolResult, Attachment } from '../types';
import { ReasoningBlock, ToolCallsBlock, ToolResultBlock, InterruptBlock } from './MessageBlocks';
import { MarkdownRenderer } from './MarkdownRenderer';
import { User, Bot, Terminal, X, Download, Copy, Check, Trash2, FileText, FileCode, FileSpreadsheet, File as FileIcon, FileImage, FileVideo } from 'lucide-react';

interface Props {
  messages: Message[];
  onInterruptResponse: (response: string, streamId?: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  onDeleteMessage?: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

const CopyButton = ({ content, isUser }: { content: string; isUser: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${isUser
        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-blue-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-400'}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="text-[10px] font-medium uppercase tracking-wider">{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
};

const DeleteButton = ({ isUser, onDelete }: { isUser: boolean; onDelete: () => void }) => {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${isUser
        ? 'bg-blue-100 text-blue-600 hover:bg-red-100 hover:text-red-600 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
        : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'}`}
      title="Delete Message"
    >
      <Trash2 className={`w-3.5 h-3.5 ${confirming ? 'text-red-500' : ''}`} />
      <span className={`text-[10px] font-medium uppercase tracking-wider ${confirming ? 'text-red-500' : ''}`}>
        {confirming ? 'Confirm?' : 'Delete'}
      </span>
    </button>
  );
};

// Helper to check if a tool result is "empty" to avoid rendering empty bubbles
const isToolResultEmpty = (content: string, name?: string) => {
  if (!content && !name) return true;
  try {
    const parsed = JSON.parse(content);
    if (Object.keys(parsed).length === 0 || (parsed.status && Object.keys(parsed).length === 1 && !parsed.content && !parsed.results)) {
      return true;
    }
  } catch (e) {
    // Not JSON
  }
  return false;
};

const getExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
};

const getFileIcon = (filename: string) => {
    const ext = getExtension(filename);
    switch (ext) {
        case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
        case 'xls':
        case 'xlsx':
        case 'csv': return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
        case 'doc':
        case 'docx': return <FileText className="w-5 h-5 text-blue-500" />;
        case 'js':
        case 'ts':
        case 'tsx':
        case 'jsx':
        case 'py':
        case 'java':
        case 'html':
        case 'css':
        case 'json':
        case 'xml': return <FileCode className="w-5 h-5 text-yellow-500" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg': return <FileImage className="w-5 h-5 text-purple-500" />;
        case 'mp4':
        case 'webm':
        case 'mov': return <FileVideo className="w-5 h-5 text-pink-500" />;
        default: return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
};

interface UnifiedAttachment {
    url: string;
    type: 'image' | 'video' | 'file';
    name: string;
    extension?: string;
}

export const MessageList: React.FC<Props> = React.memo(({ messages, onInterruptResponse, isLoading, isStreaming, onDeleteMessage, onLoadMore, hasMore, isLoadingMore }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessagesLength = useRef(messages.length);
  const isAutoScrolling = useRef(true);
  const isInitialLoad = useRef(true);
  const previousScrollHeight = useRef(0);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' | 'file', name?: string } | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<number>>(new Set());

  const toggleTokenExpansion = (groupIndex: number) => {
    setExpandedTokens(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupIndex)) {
        newSet.delete(groupIndex);
      } else {
        newSet.add(groupIndex);
      }
      return newSet;
    });
  };

  // Compute completed tool call IDs to pass to ToolCallsBlock
  const completedToolIds = useMemo(() => {
    const ids = new Set<string>();
    messages.forEach(msg => {
      // Check legacy tool_result
      if (msg.tool_result) {
        msg.tool_result.forEach(res => {
            if (res.tool_call_id) ids.add(res.tool_call_id);
        });
      }
      // Check parts
      if (msg.parts) {
        msg.parts.forEach(part => {
          if (part.type === 'tool_result') {
            part.tool_result.forEach(res => {
                if (res.tool_call_id) ids.add(res.tool_call_id);
            });
          }
        });
      }
      // Check direct message role
      if ((msg.role === 'tool' || msg.role === 'tool_result') && msg.tool_call_id) {
          ids.add(msg.tool_call_id);
      }
    });
    return ids;
  }, [messages]);

  // Group messages logic - optimized with shallow comparison
  const groupedMessages = useMemo(() => {
    const groups: { role: 'user' | 'bot'; messages: Message[] }[] = [];

    messages.forEach((msg) => {
      if (msg.role === 'system') return;

      const isUser = msg.role === 'user';
      const groupRole = isUser ? 'user' : 'bot'; // group assistant, tool, tool_result, interrupt as 'bot'

      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.role === groupRole) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({
          role: groupRole,
          messages: [msg]
        });
      }
    });
    return groups;
  }, [messages]);

  // Calculate token usage for each group
  const groupedTokenStats = useMemo(() => {
    return groupedMessages.map(group => {
      const stats = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      const messageIds = new Set<string>();

      group.messages.forEach(msg => {
        if (msg.id && msg.usage) {
          messageIds.add(msg.id);
          stats.prompt_tokens += msg.usage.prompt_tokens || 0;
          stats.completion_tokens += msg.usage.completion_tokens || 0;
          stats.total_tokens += msg.usage.total_tokens || 0;
        }
      });

      return stats;
    });
  }, [groupedMessages]);


  // Handle automatic scrolling and scroll restoration
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const isNewLoad = lastMessagesLength.current === 0 && messages.length > 0;
    const isNewMessage = messages.length > lastMessagesLength.current && lastMessagesLength.current > 0;
    const isStillStreaming = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && isStreaming;

    // Check if we finished loading more messages
    const justFinishedLoadingMore = !isLoadingMore && (messages.length > lastMessagesLength.current);

    // If we were fetching more and messages increased, restore scroll position
    if (justFinishedLoadingMore && previousScrollHeight.current > 0) {
        // We need to ensure the DOM has updated. usually useEffect runs after render, so scrollHeight should be new.
        // However, if the new messages are prepended, we want to maintain the relative scroll position.
        const newScrollHeight = container.scrollHeight;
        const diff = newScrollHeight - previousScrollHeight.current;
        if (diff > 0) {
           container.scrollTop = diff + container.scrollTop; // Usually scrollTop was 0 or small, so this sets it to diff
        }
        previousScrollHeight.current = 0; // Reset
    }
    else if (isNewLoad) {
      container.style.scrollBehavior = 'auto';
      container.scrollTop = container.scrollHeight;
      isAutoScrolling.current = true;
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    } else if (isNewMessage || (isStillStreaming && isAutoScrolling.current)) {
      // Only auto-scroll if we are not fetching older messages
      if (!isLoadingMore) {
          container.style.scrollBehavior = 'smooth';
          container.scrollTop = container.scrollHeight;
      }
    }

    lastMessagesLength.current = messages.length;
  }, [messages, isStreaming, isLoadingMore]);

  // Handle height changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!isInitialLoad.current && isAutoScrolling.current && !isLoadingMore) {
        requestAnimationFrame(() => {
          container.style.scrollBehavior = 'auto';
          container.scrollTop = container.scrollHeight;
        });
      }
    });

    // Only observe the container, not all children
    resizeObserver.observe(container);

    const handleScroll = () => {
      // Logic for infinite scroll
      if (container.scrollTop === 0 && hasMore && !isLoadingMore && !isLoading && !isInitialLoad.current && onLoadMore) {
          previousScrollHeight.current = container.scrollHeight;
          onLoadMore();
      }

      if (isInitialLoad.current || isLoadingMore) return;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      isAutoScrolling.current = isAtBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
      {/* Loading Spinner for Load More */}
      {isLoadingMore && (
          <div className="flex justify-center py-2">
             <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
      )}


      {groupedMessages.map((group, groupIndex) => {
        const isUser = group.role === 'user';

        return (
          <div key={`group-${groupIndex}`} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-emerald-600'}`}>
              {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>

            {/* Content Column */}
            <div className={`flex flex-col gap-2 max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} w-full`}>

              {group.messages.map((msg, msgIndex) => {
                const renderBlocks: React.ReactNode[] = [];
                const msgKey = `${msg.id}-${msgIndex}`;

                // Helper for Text Bubbles ONLY
                const wrapInTextBubble = (content: React.ReactNode, key: string, rawText?: string, msgId?: string) => (
                  <div key={key} className={`w-full rounded-2xl px-4 py-3 shadow-sm group/bubble ${isUser ? 'bg-blue-50 text-gray-800 dark:bg-blue-900/30 dark:text-gray-200 text-[14px]' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-[14px]'}`}>
                    {content}

                    {/* Footer Actions: Copy & Delete */}
                    {(rawText && rawText.trim() || (msg.message_id && onDeleteMessage)) && (
                      <div className="flex justify-end mt-2 pt-2 border-t border-black/5 dark:border-white/5 opacity-0 group-hover/bubble:opacity-100 transition-opacity gap-2">
                        {rawText && rawText.trim() && <CopyButton content={rawText} isUser={isUser} />}

                        {/* Only show delete button if message has a message_id (persisted on server) */}
                        {msg.message_id && onDeleteMessage && (
                          <DeleteButton
                            isUser={isUser}
                            onDelete={() => onDeleteMessage(msg.id)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );

                // Helper to render media grid
                const renderMediaGrid = (mediaItems: UnifiedAttachment[], keyPrefix: string) => {
                  if (!mediaItems || mediaItems.length === 0) return null;

                  const content = (
                    <div className="flex flex-wrap gap-2">
                      {mediaItems.map((item, idx) => (
                        <div
                          key={`${keyPrefix}-${idx}`}
                          className="relative rounded-lg overflow-hidden bg-black/10 dark:bg-white/10 w-24 h-24 shrink-0 cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 dark:border-gray-700"
                          onClick={() => setPreviewMedia(item)}
                        >
                          {item.type === 'image' ? (
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <video src={item.url} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  );

                  return wrapInTextBubble(content, keyPrefix, '', msg.id);
                };

                // Helper to render file list
                const renderFileList = (files: UnifiedAttachment[], keyPrefix: string) => {
                    if (!files || files.length === 0) return null;

                    const content = (
                        <div className="flex flex-col gap-2">
                            {files.map((file, idx) => (
                                <a
                                    key={`${keyPrefix}-${idx}`}
                                    href={file.url}
                                    download={file.name}
                                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group/file"
                                >
                                    <div className="shrink-0">
                                        {getFileIcon(file.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate text-gray-700 dark:text-gray-200">{file.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{file.extension}</div>
                                    </div>
                                    <Download className="w-4 h-4 text-gray-400 group-hover/file:text-blue-500 transition-colors" />
                                </a>
                            ))}
                        </div>
                    );

                    // We wrap it in a bubble container logic, but maybe we don't need the standard bubble bg?
                    // Let's use naked div for file list to look like cards
                    return (
                        <div key={keyPrefix} className="w-full">
                           {content}
                        </div>
                    );
                };

                // Combine Attachments (Local) and Files (Server)
                const combinedAttachments: UnifiedAttachment[] = [];

                // 1. Local Attachments (Pre-upload/sending state or just sent)
                if (msg.attachments) {
                    msg.attachments.forEach(att => combinedAttachments.push({
                        url: att.url,
                        type: att.type,
                        name: att.name,
                        extension: att.extension || getExtension(att.name)
                    }));
                }

                // 2. Server Files (History)
                if (Array.isArray(msg.files)) {
                    msg.files.forEach(f => {
                        const url = f.file_url;
                        const name = f.file_name;
                        // Check if this URL is already in attachments to avoid duplicates
                        if (!combinedAttachments.some(att => att.url === url)) {
                             const ext = getExtension(name);
                             let type: 'image' | 'video' | 'file' = 'file';
                             if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) type = 'image';
                             else if (['mp4','webm','mov'].includes(ext)) type = 'video';

                             combinedAttachments.push({
                                 url,
                                 type,
                                 name,
                                 extension: ext
                             });
                        }
                    });
                }

                // Split into Visuals and Docs
                const visuals = combinedAttachments.filter(a => a.type === 'image' || a.type === 'video');
                const docs = combinedAttachments.filter(a => a.type === 'file');

                // Render Visuals First
                if (visuals.length > 0) {
                     renderBlocks.push(renderMediaGrid(visuals, `vis-${msgKey}`));
                }
                // Render Docs Second
                if (docs.length > 0) {
                     renderBlocks.push(renderFileList(docs, `doc-${msgKey}`));
                }


                const cleanText = (text: string) => {
                  if (!text) return '';
                  const marker = "\n\n [User's attachment]：\n\n";
                  const index = text.indexOf(marker);
                  if (index !== -1) {
                    return text.substring(0, index);
                  }
                  return text;
                };

                const renderMultimodalContent = (content: any, msgId: string) => {
                  if (typeof content === 'string') {
                    const cleaned = cleanText(content);
                    if (!cleaned) return null;
                    return wrapInTextBubble(
                      <MarkdownRenderer content={cleaned} className={isUser ? '' : ''} />
                      , `${msgId}-content`, cleaned, msg.id);
                  }

                  if (Array.isArray(content)) {
                    const mediaParts = content.filter(p => p.type === 'image_url' || p.type === 'video_url').map(p => ({
                      url: p.type === 'image_url' ? p.image_url.url : p.video_url.url,
                      type: (p.type === 'image_url' ? 'image' : 'video') as 'image' | 'video',
                      name: 'media'
                    }));
                    const textParts = content.filter(p => p.type === 'text');

                    return (
                      <div key={`${msgId}-multimodal`} className="space-y-2 w-full">
                        {renderMediaGrid(mediaParts, `${msgId}-media`)}
                        {textParts.map((p, i) => {
                          const text = cleanText(p.text || p.content || '');
                          if (!text) return null;
                          return wrapInTextBubble(
                            <MarkdownRenderer content={text} className={isUser ? '' : ''} />
                            , `${msgId}-txt-${i}`, text, msg.id);
                        })}
                      </div>
                    );
                  }
                  return null;
                };

                // Helper for Naked Blocks (No Bubble, just the component)
                // These components (Reasoning, ToolCalls, ToolResult) already have their own borders/backgrounds.
                // We add 'w-full' to ensure they take available width in the flex column.
                const renderNakedBlock = (content: React.ReactNode, key: string) => (
                  <div key={key} className="w-full">
                    {content}
                  </div>
                );

                // 2. Parts or Legacy
                if (msg.parts && msg.parts.length > 0) {
                  msg.parts.forEach((part, pIdx) => {
                    const key = `${msgKey}-p${pIdx}`;
                    if (part.type === 'reasoning') {
                      renderBlocks.push(renderNakedBlock(<ReasoningBlock content={part.content} />, key));
                    } else if (part.type === 'tool_calls') {
                      part.tool_calls.forEach((call, tcIdx) => {
                        renderBlocks.push(renderNakedBlock(<ToolCallsBlock calls={[call]} completedIds={completedToolIds} />, `${key}-tc${tcIdx}`));
                      });
                    } else if (part.type === 'tool_result') {
                      part.tool_result.forEach((res, rIdx) => {
                        if (!isToolResultEmpty(res.output, res.name)) {
                          renderBlocks.push(renderNakedBlock(
                            <ToolResultBlock content={res.output} toolName={res.name} />
                            , `${key}-tr${rIdx}`));
                        }
                      });
                    } else if (part.type === 'text') {
                      if (msg.role === 'tool' || msg.role === 'tool_result') {
                        if (!isToolResultEmpty(part.content)) {
                          renderBlocks.push(renderNakedBlock(<ToolResultBlock content={part.content} />, key));
                        }
                      } else {
                        // Multimodal check inside parts if content is not just a string
                        renderBlocks.push(renderMultimodalContent(part.content, key));
                      }
                    }
                  });
                } else {
                  // Legacy Rendering
                  // Reasoning
                  if (msg.reasoning_content && !isUser) {
                    renderBlocks.push(renderNakedBlock(<ReasoningBlock content={msg.reasoning_content} />, `${msgKey}-reasoning`));
                  }
                  // Tool Calls
                  if (msg.tool_calls && msg.tool_calls.length > 0) {
                    msg.tool_calls.forEach((call, tcIdx) => {
                      renderBlocks.push(renderNakedBlock(<ToolCallsBlock calls={[call]} completedIds={completedToolIds} />, `${msgKey}-call-${tcIdx}`));
                    });
                  }
                  // Tool Results
                  if (msg.tool_result && msg.tool_result.length > 0) {
                    msg.tool_result.forEach((res, rIdx) => {
                      if (!isToolResultEmpty(res.output, res.name)) {
                        renderBlocks.push(renderNakedBlock(
                          <ToolResultBlock content={res.output} toolName={res.name} />
                          , `${msgKey}-res-${rIdx}`));
                      }
                    });
                  }
                  // Content
                  if (msg.content) {
                    if (msg.role === 'tool' || msg.role === 'tool_result') {
                      if (!isToolResultEmpty(msg.content)) {
                        renderBlocks.push(renderNakedBlock(<ToolResultBlock content={msg.content} />, `${msgKey}-content`));
                      }
                    } else {
                      renderBlocks.push(renderMultimodalContent(msg.content, msg.id));
                    }
                  }
                }

                // Interrupt (Universal)
                if (msg.interrupt_info) {
                  renderBlocks.push(renderNakedBlock(
                    <InterruptBlock
                      info={msg.interrupt_info}
                      onRespond={(resp) => onInterruptResponse(resp, msg.id)}
                      isResponded={!!msg.interrupted}
                      isActive={msgIndex === group.messages.length - 1 && groupIndex === groupedMessages.length - 1}
                    />
                    , `${msgKey}-interrupt`));
                }

                return renderBlocks;
              })}

              {!isUser && groupedTokenStats[groupIndex].total_tokens > 0 && (
                <div
                  onClick={() => toggleTokenExpansion(groupIndex)}
                  className={`self-start mt-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-all ${
                    isUser 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {!expandedTokens.has(groupIndex) ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Total Usage: {groupedTokenStats[groupIndex].total_tokens} tokens
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Token Usage</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Input:</span>
                          <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">
                            {groupedTokenStats[groupIndex].prompt_tokens} tokens
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Output:</span>
                          <span className="ml-1 font-mono text-gray-700 dark:text-gray-300">
                            {groupedTokenStats[groupIndex].completion_tokens} tokens
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 border border-gray-100 dark:border-gray-700 flex items-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewMedia(null)}>
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-8 h-8" />
            </button>

            <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 w-auto h-auto flex justify-center items-center">
              {previewMedia.type === 'image' ? (
                <img src={previewMedia.url} alt={previewMedia.name} className="max-w-full max-h-[80vh] object-contain" />
              ) : (
                <video src={previewMedia.url} controls className="max-w-full max-h-[80vh]" />
              )}
            </div>

            <div className="flex gap-4 mt-4">
              <a
                href={previewMedia.url}
                download={previewMedia.name || 'media'}
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
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  // Only re-render if messages actually changed meaningfully
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;

  // If lengths are same, check if last message content changed
  if (prevProps.messages.length > 0 && nextProps.messages.length > 0) {
    // If we are streaming, we always want to re-render to show updates
    if (nextProps.isStreaming) return false;

    const prevLast = prevProps.messages[prevProps.messages.length - 1];
    const nextLast = nextProps.messages[nextProps.messages.length - 1];

    if (prevLast.content !== nextLast.content) return false;
    if (prevLast.parts?.length !== nextLast.parts?.length) return false;
    if (prevLast.interrupt_info !== nextLast.interrupt_info) return false;
    if (prevLast.interrupted !== nextLast.interrupted) return false;
    if (prevLast.tool_calls?.length !== nextLast.tool_calls?.length) return false;
  }

  return true; // Props are equal, skip re-render
});
