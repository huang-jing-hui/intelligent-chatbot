import React, { useEffect, useRef, useMemo } from 'react';
import { Message, MessagePart, ToolCall, ToolResult, Attachment } from '../types';
import { ReasoningBlock, ToolCallsBlock, ToolResultBlock, InterruptBlock } from './MessageBlocks';
import { MarkdownRenderer } from './MarkdownRenderer';
import { User, Bot, Terminal } from 'lucide-react';

interface Props {
  messages: Message[];
  onInterruptResponse: (response: string) => void;
  isLoading: boolean;
}

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

export const MessageList: React.FC<Props> = ({ messages, onInterruptResponse, isLoading }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessagesLength = useRef(messages.length);
  const isAutoScrolling = useRef(true);
  const isInitialLoad = useRef(true);

  // Group messages logic
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


  // Handle automatic scrolling to bottom
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const isNewLoad = lastMessagesLength.current === 0 && messages.length > 0;
    const isNewMessage = messages.length > lastMessagesLength.current && lastMessagesLength.current > 0;
    const isStreaming = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && isLoading;

    if (isNewLoad) {
      container.style.scrollBehavior = 'auto';
      container.scrollTop = container.scrollHeight;
      isAutoScrolling.current = true;
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    } else if (isNewMessage || (isStreaming && isAutoScrolling.current)) {
      container.style.scrollBehavior = 'smooth';
      container.scrollTop = container.scrollHeight;
    }

    lastMessagesLength.current = messages.length;
  }, [messages, isLoading]);

  // Handle height changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!isInitialLoad.current && isAutoScrolling.current) {
        container.style.scrollBehavior = 'auto';
        container.scrollTop = container.scrollHeight;
      }
    });

    Array.from(container.children).forEach(child => resizeObserver.observe(child));
    
    const handleScroll = () => {
      if (isInitialLoad.current) return;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      isAutoScrolling.current = isAtBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
      {groupedMessages.map((group, groupIndex) => {
        const isUser = group.role === 'user';
        // For Bot group, we just use the Bot icon. 
        // If we really wanted to distinguish 'Tool' vs 'Bot' we could check the first message, 
        // but grouping implies unified identity. 
        // We'll stick to 'Bot' icon for AI groups unless it's ONLY tool messages? 
        // The prompt asked for "one robot avatar".

        return (
          <div key={`group-${groupIndex}`} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isUser ? 'bg-blue-600' : 'bg-emerald-600'
            }`}>
              {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>

            {/* Content Column */}
            <div className={`flex flex-col gap-2 max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
              
              {group.messages.map((msg, msgIndex) => {
                // Flatten content logic
                const renderBlocks: React.ReactNode[] = [];

                // 1. Attachments
                if (msg.attachments && msg.attachments.length > 0) {
                   renderBlocks.push(
                     <div key={`att-${msg.id}`} className={`w-full rounded-2xl px-5 py-4 shadow-sm ${
                        isUser ? 'bg-blue-600' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                     }`}>
                        <div className="flex flex-wrap gap-2">
                            {msg.attachments.map((att) => (
                            <div key={att.id} className="relative rounded-lg overflow-hidden bg-black/10 dark:bg-white/10 max-w-xs">
                                {att.type === 'image' ? (
                                <img src={att.url} alt="attachment" className="w-full max-h-48 object-contain rounded-lg" />
                                ) : (
                                <video src={att.url} controls className="w-full max-h-48 rounded-lg" />
                                )}
                            </div>
                            ))}
                        </div>
                     </div>
                   );
                }

                // Helper to wrap content in a bubble
                const wrapInBubble = (content: React.ReactNode, key: string, isText: boolean = false) => (
                    <div key={key} className={`w-full rounded-2xl px-5 py-4 shadow-sm ${
                        isUser && isText
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                    }`}>
                        {content}
                    </div>
                );

                // 2. Parts or Legacy
                if (msg.parts && msg.parts.length > 0) {
                    msg.parts.forEach((part, pIdx) => {
                        const key = `${msg.id}-p${pIdx}`;
                        if (part.type === 'reasoning') {
                            renderBlocks.push(wrapInBubble(<ReasoningBlock content={part.content} />, key));
                        } else if (part.type === 'tool_calls') {
                            renderBlocks.push(wrapInBubble(<ToolCallsBlock calls={part.tool_calls} />, key));
                        } else if (part.type === 'tool_result') {
                            // Check if any result is valid before rendering the bubble
                            const validResults = part.tool_result.filter(res => !isToolResultEmpty(res.output, res.name));
                            if (validResults.length > 0) {
                                renderBlocks.push(wrapInBubble(
                                    <div className="space-y-2">
                                        {part.tool_result.map((res, rIdx) => (
                                            <ToolResultBlock key={rIdx} content={res.output} toolName={res.name} />
                                        ))}
                                    </div>
                                , key));
                            }
                        } else if (part.type === 'text') {
                            if (msg.role === 'tool' || msg.role === 'tool_result') {
                                // Fallback if 'text' part is used for tool result? Unlikely based on types, but safe handling
                                if (!isToolResultEmpty(part.content)) {
                                    renderBlocks.push(wrapInBubble(<ToolResultBlock content={part.content} />, key));
                                }
                            } else {
                                renderBlocks.push(wrapInBubble(
                                    <MarkdownRenderer content={part.content} className={isUser ? 'prose-invert' : ''} />
                                , key, true));
                            }
                        }
                    });
                } else {
                    // Legacy Rendering
                    // Reasoning
                    if (msg.reasoning_content && !isUser) {
                        renderBlocks.push(wrapInBubble(<ReasoningBlock content={msg.reasoning_content} />, `${msg.id}-reasoning`));
                    }
                    // Tool Calls
                    if (msg.tool_calls && msg.tool_calls.length > 0) {
                        renderBlocks.push(wrapInBubble(<ToolCallsBlock calls={msg.tool_calls} />, `${msg.id}-calls`));
                    }
                    // Tool Results
                    if (msg.tool_result && msg.tool_result.length > 0) {
                         const validResults = msg.tool_result.filter(res => !isToolResultEmpty(res.output, res.name));
                         if (validResults.length > 0) {
                             renderBlocks.push(wrapInBubble(
                                <div className="space-y-2">
                                    {msg.tool_result.map((res, rIdx) => (
                                        <ToolResultBlock key={rIdx} content={res.output} toolName={res.name} />
                                    ))}
                                </div>
                             , `${msg.id}-results`));
                         }
                    }
                    // Content
                    if (msg.content) {
                        if (msg.role === 'tool' || msg.role === 'tool_result') {
                             if (!isToolResultEmpty(msg.content)) {
                                renderBlocks.push(wrapInBubble(<ToolResultBlock content={msg.content} />, `${msg.id}-content`));
                             }
                        } else {
                            renderBlocks.push(wrapInBubble(
                                <MarkdownRenderer content={msg.content} className={isUser ? 'prose-invert' : ''} />
                            , `${msg.id}-content`, true));
                        }
                    }
                }

                // Interrupt (Universal)
                if (msg.interrupt_info) {
                    renderBlocks.push(wrapInBubble(
                       <InterruptBlock 
                         info={msg.interrupt_info} 
                         onRespond={onInterruptResponse}
                         isResponded={!!msg.interrupted}
                         isActive={msgIndex === group.messages.length - 1 && groupIndex === groupedMessages.length - 1}
                       />
                    , `${msg.id}-interrupt`));
                }

                return renderBlocks;
              })}
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
    </div>
  );
};