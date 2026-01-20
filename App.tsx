import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Menu } from 'lucide-react';
import { Message, ChatSession, ToolCall, Attachment, ToolResult } from './types';
import { streamChatCompletion, getChatTitles, getChatMessages, deleteChat, updateChatTitle, deleteChatSpecify } from './services/api';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { ChatInput } from './components/ChatInput';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const lastStreamedIdRef = useRef<string | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = uuidv4();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Pagination State
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  // Initialize
  useEffect(() => {
    loadSessions(true);
  }, []);

  // Load chat messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      if (currentSessionId === lastStreamedIdRef.current) {
        lastStreamedIdRef.current = null;
        return;
      }
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  const loadSessions = async (selectFirst: boolean = false) => {
    try {
      const titles = await getChatTitles();
      setSessions(titles);
      if (selectFirst && !currentSessionId && titles.length > 0) {
        setCurrentSessionId(titles[0].id);
      }
    } catch (error) {
      console.error("Failed to load sessions", error);
    }
  };

  const loadMessages = async (id: string, isLoadMore: boolean = false) => {
    if (isLoading || isFetchingHistory) return;
    try {
      if (isLoadMore) {
        setIsFetchingHistory(true);
      } else {
        setIsLoading(true);
      }

      const currentOffset = isLoadMore ? offset : 0;

      const msgs = await getChatMessages(id, currentOffset, LIMIT);

      // The API returns messages in reverse order (newest first), so we reverse them for display
      const orderedMsgs = [...msgs].reverse();

      setMessages(prev => {
        const existingIds = new Set(isLoadMore ? prev.map(m => m.message_id).filter(Boolean) : []);
        const uniqueNewMsgs = orderedMsgs.filter(m => !m.message_id || !existingIds.has(m.message_id));

        return isLoadMore ? [...uniqueNewMsgs, ...prev] : uniqueNewMsgs;
      });

      if (msgs.length < LIMIT) {
        setHasMore(false);
      } else {
        setHasMore(true);
        setOffset(currentOffset + LIMIT);
      }
    } catch (e) {
      console.error(e);
      if (!isLoadMore) setMessages([]);
    } finally {
      if (isLoadMore) {
        setIsFetchingHistory(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setOffset(0);
    setHasMore(false);
    lastStreamedIdRef.current = null;
  };

  const handleDeleteChat = async (id: string) => {
    try {
      const response = await deleteChat(id);
      if (!response.ok) {
        throw new Error(`Failed to delete chat: ${response.status} ${response.statusText}`);
      }

      if (currentSessionId === id) {
        createNewChat();
      }

      await loadSessions(false);
    } catch (error) {
      console.error("Failed to delete chat", error);
    }
  };

  const handleDeleteMessage = async (msgUniqueId: string) => {
    if (!currentSessionId) return;

    try {
      const result = await deleteChatSpecify(currentSessionId, msgUniqueId);
      if (result) {
        showToast(result, 'error');
      }else {
        // Update UI: Remove all messages with this grouping ID
        setMessages(prev => prev.filter(m => m.id !== msgUniqueId));
        showToast('Message deleted', 'success');
      }

    } catch (error) {
      console.error("Failed to delete message", error);
      showToast("Failed to delete message", 'error');
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      const success = await updateChatTitle(id, newTitle);
      if (success) {
        await loadSessions(false);
      } else {
        showToast("Failed to update chat title", 'error');
      }
    } catch (error) {
      console.error("Failed to rename chat", error);
    }
  };

  const updateLastMessage = (updater: (msg: Message) => Message) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') return prev;
      
      const updatedLast = updater({ ...last });
      
      // If the ID changed (e.g. from temp UUID to backend ID), update preceding messages in this turn
      if (updatedLast.id !== last.id) {
        const newMessages = prev.map(m => m.id === last.id ? { ...m, id: updatedLast.id } : m);
        newMessages[newMessages.length - 1] = updatedLast;
        return newMessages;
      }

      const newMessages = [...prev];
      newMessages[newMessages.length - 1] = updatedLast;
      return newMessages;
    });
  };

  const handleSendMessage = async (content: string, attachments: Attachment[], interrupt: boolean = false, streamId?: string) => {
    if ((!content.trim() && attachments.length === 0) || isLoading) return;

    setIsLoading(true);

    const sessionId = currentSessionId || uuidv4();
    const currentStreamId = streamId || uuidv4(); // Generate or reuse stream ID (which is also the message ID)
    lastStreamedIdRef.current = sessionId;

    // Add user message to UI
    const userMsg: Message = {
      id: currentStreamId, // Use stream ID as message ID
      role: 'user',
      content: content,
      attachments: attachments,
      timestamp: Date.now()
    };

    if (!interrupt) {
      setMessages(prev => [...prev, userMsg]);
    }

    try {
      // Create placeholder assistant message
      const assistantId = currentStreamId; // Use same ID for grouping
      const initialAssistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        parts: [], // Initialize parts
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, initialAssistantMsg]);

      // Prepare messages for API (handle multimodal)
      const apiMessages = [ userMsg].map(m => {
        const files: any[] = [];
        let content: any = m.content || '';

        if (m.attachments && m.attachments.length > 0) {
          const contentParts: any[] = [];
          
          // Add attachments
          m.attachments.forEach(att => {
             if (att.type === 'image') {
               contentParts.push({
                 type: 'image_url',
                 image_url: { url: att.url }
               });
             } else if (att.type === 'video') {
               contentParts.push({
                 type: 'video_url',
                 video_url: { url: att.url }
               });
             } else if (att.type === 'file') {
                 files.push({
                     file_name: att.name,
                     file_url: att.url
                 });
             }
          });

          // Add text if exists
          if (m.content) {
            contentParts.push({ type: 'text', text: m.content });
          }
          
          // If we have visual media, use contentParts. If only files, we can keep content as string if we want,
          // but if we have mixed content (text + files), text is in content.
          // Wait, if we have files, content can still be string. 
          // Only if we have image/video do we force content array?
          // Actually, if contentParts has > 0 (images/videos/text), use it.
          if (contentParts.length > 0) {
              content = contentParts;
          }
        }

        const msgObj: any = { role: m.role, content: content };
        if (files.length > 0) {
            msgObj.files = files;
        }
        return msgObj;
      });

      const stream = streamChatCompletion({
        model: 'deepseek-reasoner',
        stream_id: currentStreamId,
        messages: apiMessages,
        stream: true,
        config: { configurable: { thread_id: sessionId } }
      });

      let currentToolCalls: { [index: number]: ToolCall } = {};

      // Optimization: Local buffer to reduce React state updates
      let accumulatedMessage = { ...initialAssistantMsg };
      let lastUpdateTime = 0;
      const MIN_UPDATE_INTERVAL = 100; // Increased from 50ms to 100ms
      let rafId: number | null = null;
      let pendingUpdate = false;

      // Smart update scheduler using requestAnimationFrame
      const scheduleUpdate = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          const now = performance.now();
          if (now - lastUpdateTime >= MIN_UPDATE_INTERVAL) {
            // Shallow copy is sufficient - parts are mutated in place
            updateLastMessage(() => ({ ...accumulatedMessage }));
            lastUpdateTime = now;
            pendingUpdate = false;
          } else {
            // Schedule next check
            pendingUpdate = false;
            scheduleUpdate();
          }
          rafId = null;
        });
      };

      for await (const chunk of stream) {
        // Update message ID if provided by backend
        if (chunk.id && accumulatedMessage.id !== chunk.id) {
            accumulatedMessage.id = chunk.id;
        }
        if (chunk.message_id && accumulatedMessage.message_id !== chunk.message_id) {
            accumulatedMessage.message_id = chunk.message_id;
        }

        if (chunk.usage) {
          if (!accumulatedMessage.usage) {
            accumulatedMessage.usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
          }
          accumulatedMessage.usage.prompt_tokens += chunk.usage.prompt_tokens;
          accumulatedMessage.usage.completion_tokens += chunk.usage.completion_tokens;
          accumulatedMessage.usage.total_tokens += chunk.usage.total_tokens;
        }

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 1. Process Tool Call Deltas (Mutation Phase - Run ONCE)
        if (delta.tool_calls) {
           delta.tool_calls.forEach(tc => {
              if (tc.id || !currentToolCalls[tc.index]) {
                currentToolCalls[tc.index] = {
                  id: tc.id || uuidv4(),
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }
              if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
           });
        }

        // Apply changes to local accumulator
        const msg = accumulatedMessage;
        if (!msg.parts) msg.parts = [];

        const getLastPart = () => {
            if (msg.parts!.length === 0) return null;
            return msg.parts![msg.parts!.length - 1];
        };

        // Handle Reasoning
        if (delta.reasoning_content) {
            const lastPart = getLastPart();
            if (lastPart?.type === 'reasoning') {
                lastPart.content += delta.reasoning_content;
            } else {
                msg.parts.push({ type: 'reasoning', content: delta.reasoning_content });
            }
            msg.reasoning_content = (msg.reasoning_content || '') + delta.reasoning_content;
        }

        // Handle Tool Calls (Structural Phase)
        if (delta.tool_calls) {
            const lastPart = getLastPart();
            let toolPart: { type: 'tool_calls', tool_calls: ToolCall[] };

            if (lastPart?.type === 'tool_calls') {
                toolPart = lastPart as any;
            } else {
                toolPart = { type: 'tool_calls', tool_calls: [] };
                msg.parts.push(toolPart);
            }

            delta.tool_calls.forEach(tc => {
                const activeTool = currentToolCalls[tc.index];
                if (activeTool && !toolPart.tool_calls.includes(activeTool)) {
                    toolPart.tool_calls.push(activeTool);
                }
            });

            msg.tool_calls = Object.values(currentToolCalls);
        }

        // Handle Tool Results
        if (delta.tool_result) {
            const lastPart = getLastPart();
            let resultPart: { type: 'tool_result', tool_result: ToolResult[] };

            if (lastPart?.type === 'tool_result') {
                resultPart = lastPart as any;
            } else {
                resultPart = { type: 'tool_result', tool_result: [] };
                msg.parts.push(resultPart);
            }
            resultPart.tool_result.push(delta.tool_result);

             // Legacy update
            msg.tool_result = msg.tool_result ? [...msg.tool_result] : [];
            msg.tool_result.push(delta.tool_result);
        }

        // Handle Content
        if (delta.content) {
            const lastPart = getLastPart();
            if (lastPart?.type === 'text') {
                lastPart.content += delta.content;
            } else {
                msg.parts.push({ type: 'text', content: delta.content });
            }
            msg.content += delta.content;
        }

        if (delta.interrupt_info) {
            msg.interrupt_info = delta.interrupt_info;
            msg.interrupted = false;
        }

        // Schedule UI update using RAF
        scheduleUpdate();
      }

      // Cancel any pending RAF and do final update
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      updateLastMessage(() => ({ ...accumulatedMessage }));

      if (!currentSessionId) {
        setCurrentSessionId(sessionId);
        loadSessions(false);
      }

    } catch (error) {
      console.error('Streaming error', error);
      updateLastMessage(msg => ({ ...msg, content: msg.content + "\n\n[Error generating response]" }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterruptResponse = (response: string, streamId?: string) => {
    // updateLastMessage(msg => ({ ...msg, interrupted: true }));
    handleSendMessage(response, [], true, streamId);
  };

  return (
    <div className="flex h-full w-full bg-white dark:bg-black text-gray-900 dark:text-gray-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${ 
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewChat={createNewChat}
          onDeleteChat={handleDeleteChat}
          onRenameChat={handleRenameChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50 backdrop-blur-md sticky top-0 z-10">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-semibold text-xs lg:text-sm">
              {sessions.find(s => s.id === currentSessionId)?.title || 'New Chat'}
            </h1>
            <span className="text-[10px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Online
            </span>
          </div>
        </header>

        <MessageList
          messages={messages}
          onInterruptResponse={handleInterruptResponse}
          isLoading={isLoading && messages.length === 0}
          isStreaming={isLoading}
          onDeleteMessage={handleDeleteMessage}
          onLoadMore={() => currentSessionId && loadMessages(currentSessionId, true)}
          hasMore={hasMore}
          isLoadingMore={isFetchingHistory}
        />

        {/* Input Area */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};


export default App;
