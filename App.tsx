import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Menu } from 'lucide-react';
import { Message, ChatSession, ToolCall, Attachment, ToolResult } from './types';
import { streamChatCompletion, getChatTitles, getChatMessages, deleteChat, updateChatTitle } from './services/api';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';
import { ChatInput } from './components/ChatInput';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const lastStreamedIdRef = useRef<string | null>(null);

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

  const loadMessages = async (id: string) => {
    try {
      setIsLoading(true);
      const msgs = await getChatMessages(id);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
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

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      const success = await updateChatTitle(id, newTitle);
      if (success) {
        await loadSessions(false);
      } else {
        alert("Failed to update chat title");
      }
    } catch (error) {
      console.error("Failed to rename chat", error);
    }
  };

  const updateLastMessage = (updater: (msg: Message) => Message) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), updater({ ...last })];
    });
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    if ((!content.trim() && attachments.length === 0) || isLoading) return;

    setIsLoading(true);

    const sessionId = currentSessionId || uuidv4();
    lastStreamedIdRef.current = sessionId;

    // Add user message to UI
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: content,
      attachments: attachments,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      // Create placeholder assistant message
      const assistantId = uuidv4();
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        parts: [], // Initialize parts
        timestamp: Date.now()
      }]);

      // Prepare messages for API (handle multimodal)
      const apiMessages = [ userMsg].map(m => {
        if (m.attachments && m.attachments.length > 0) {
          const contentParts: any[] = [];

          // Add attachments first
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
             }
          });

          // Add text if exists
          if (m.content) {
            contentParts.push({ type: 'text', text: m.content });
          }

          return { role: m.role, content: contentParts };
        }

        return { role: m.role, content: m.content || '' };
      });

      const stream = streamChatCompletion({
        model: 'deepseek-reasoner',
        messages: apiMessages,
        stream: true,
        config: { configurable: { thread_id: sessionId } }
      });

      let currentToolCalls: { [index: number]: ToolCall } = {};

      for await (const chunk of stream) {
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

        updateLastMessage(prevMsg => {
          // 1. Shallow copy the message object
          const msg = { ...prevMsg };

          // 2. Shallow copy the parts array
          msg.parts = msg.parts ? [...msg.parts] : [];

          const getLastPart = () => {
             if (msg.parts!.length === 0) return null;
             return msg.parts![msg.parts!.length - 1];
          };

          // Handle Reasoning
          if (delta.reasoning_content) {
            const lastPart = getLastPart();

            if (lastPart?.type === 'reasoning') {
              const newPart = { ...lastPart, content: lastPart.content + delta.reasoning_content };
              msg.parts![msg.parts!.length - 1] = newPart;
            } else {
              msg.parts!.push({ type: 'reasoning', content: delta.reasoning_content });
            }
            msg.reasoning_content = (msg.reasoning_content || '') + delta.reasoning_content;
          }

          // Handle Tool Calls (Structural Phase)
          if (delta.tool_calls) {
            const lastPart = getLastPart();
            let toolPart: { type: 'tool_calls', tool_calls: ToolCall[] };

            if (lastPart?.type === 'tool_calls') {
              toolPart = { ...lastPart, tool_calls: [...(lastPart as any).tool_calls] } as any;
              msg.parts![msg.parts!.length - 1] = toolPart;
            } else {
              toolPart = { type: 'tool_calls', tool_calls: [] };
              msg.parts!.push(toolPart);
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
              resultPart = { ...lastPart, tool_result: [...(lastPart as any).tool_result] } as any;
              msg.parts![msg.parts!.length - 1] = resultPart;
            } else {
              resultPart = { type: 'tool_result', tool_result: [] };
              msg.parts!.push(resultPart);
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
              const newPart = { ...lastPart, content: lastPart.content + delta.content };
              msg.parts![msg.parts!.length - 1] = newPart;
            } else {
              msg.parts!.push({ type: 'text', content: delta.content });
            }
            msg.content += delta.content;
          }

          if (delta.interrupt_info) {
            msg.interrupt_info = delta.interrupt_info;
            msg.interrupted = false;
          }

          return msg;
        });
      }

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

  const handleInterruptResponse = (response: string) => {
    // updateLastMessage(msg => ({ ...msg, interrupted: true }));
    handleSendMessage(response, []);
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
            <h1 className="font-semibold text-sm lg:text-base">
              {sessions.find(s => s.id === currentSessionId)?.title || 'New Chat'}
            </h1>
            <span className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              Online
            </span>
          </div>
        </header>

        <MessageList
          messages={messages}
          onInterruptResponse={handleInterruptResponse}
          isLoading={isLoading && messages.length === 0}
        />

        {/* Input Area */}
        <ChatInput 
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default App;
