import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Message } from '../types';
import { MessageItem } from './MessageItem';
import { User, Bot, X, Download, ArrowDown } from 'lucide-react';

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

export const MessageList: React.FC<Props> = React.memo(({ messages, onInterruptResponse, isLoading, isStreaming, onDeleteMessage, onLoadMore, hasMore, isLoadingMore }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessagesLength = useRef(messages.length);
  const isAutoScrolling = useRef(true);
  const isInitialLoad = useRef(true);
  const previousScrollHeight = useRef(0);
  const [previewMedia, setPreviewMedia] = useState<{ url: string, type: 'image' | 'video' | 'file', name?: string } | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<number>>(new Set());
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.style.scrollBehavior = 'smooth';
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      isAutoScrolling.current = true;
    }
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
        const newScrollHeight = container.scrollHeight;
        const diff = newScrollHeight - previousScrollHeight.current;
        if (diff > 0) {
           container.scrollTop = diff + container.scrollTop;
        }
        previousScrollHeight.current = 0; // Reset
    }
    else if (isNewLoad) {
      container.style.scrollBehavior = 'auto';
      container.scrollTop = container.scrollHeight;
      isAutoScrolling.current = true;
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    } else if (isNewMessage || (isStillStreaming && isAutoScrolling.current)) {
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

    resizeObserver.observe(container);

    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMore && !isLoadingMore && !isLoading && !isInitialLoad.current && onLoadMore) {
          previousScrollHeight.current = container.scrollHeight;
          onLoadMore();
      }

      if (isInitialLoad.current || isLoadingMore) return;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
      isAutoScrolling.current = isAtBottom;
      setShowScrollButton(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoadingMore, isLoading, onLoadMore]);

  return (
    <div className="flex-1 relative flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {isLoadingMore && (
            <div className="flex justify-center py-2">
               <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )}

        {groupedMessages.map((group, groupIndex) => {
          const isUser = group.role === 'user';
          const isLastGroup = groupIndex === groupedMessages.length - 1;

          return (
            <div key={`group-${groupIndex}`} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>

              <div className={`flex flex-col gap-2 max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} w-full`}>

                {group.messages.map((msg, msgIndex) => {
                  const isLast = isLastGroup && msgIndex === group.messages.length - 1;
                  return (
                    <MessageItem
                      key={msg.id || msgIndex} // Use unique ID if available, else index (but index changes if loading previous)
                      msg={msg}
                      isUser={isUser}
                      onDeleteMessage={onDeleteMessage}
                      onInterruptResponse={onInterruptResponse}
                      completedToolIds={completedToolIds}
                      onPreviewMedia={setPreviewMedia}
                      isLast={isLast}
                    />
                  );
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

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-6 right-8 p-2.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all z-20 group animate-in fade-in zoom-in duration-200"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:translate-y-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;

  if (prevProps.messages.length > 0 && nextProps.messages.length > 0) {
    if (nextProps.isStreaming) return false;

    const prevLast = prevProps.messages[prevProps.messages.length - 1];
    const nextLast = nextProps.messages[nextProps.messages.length - 1];

    if (prevLast.content !== nextLast.content) return false;
    if (prevLast.parts?.length !== nextLast.parts?.length) return false;
    if (prevLast.interrupt_info !== nextLast.interrupt_info) return false;
    if (prevLast.interrupted !== nextLast.interrupted) return false;
    if (prevLast.tool_calls?.length !== nextLast.tool_calls?.length) return false;
  }

  return true; 
});