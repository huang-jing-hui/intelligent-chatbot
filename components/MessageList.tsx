import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { ReasoningBlock, ToolCallsBlock, ToolResultBlock, InterruptBlock } from './MessageBlocks';
import { MarkdownRenderer } from './MarkdownRenderer';
import { User, Bot, Terminal } from 'lucide-react';

interface Props {
  messages: Message[];
  onInterruptResponse: (response: string) => void;
  isLoading: boolean;
}

export const MessageList: React.FC<Props> = ({ messages, onInterruptResponse, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isTool = msg.role === 'tool' || msg.role === 'tool_result';
        const isSystem = msg.role === 'system';
        const isInterrupt = msg.role === 'interrupt';

        if (isSystem) return null; // Optionally hide system messages

        return (
          <div key={msg.id || index} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isUser ? 'bg-blue-600' : (isTool || isInterrupt) ? 'bg-purple-600' : 'bg-emerald-600'
            }`}>
              {isUser ? <User className="w-5 h-5 text-white" /> : 
               (isTool || isInterrupt) ? <Terminal className="w-4 h-4 text-white" /> : 
               <Bot className="w-5 h-5 text-white" />}
            </div>

            {/* Content Bubble */}
            <div className={`flex flex-col max-w-[85%] lg:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
              <div className={`w-full rounded-2xl px-5 py-4 shadow-sm ${
                isUser 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
              }`}>
                {/* 1. Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.attachments.map((att) => (
                      <div key={att.id} className="relative rounded-lg overflow-hidden bg-black/10 dark:bg-white/10">
                        {att.type === 'image' ? (
                          <img 
                            src={att.url} 
                            alt="attachment" 
                            className="max-w-full max-h-64 object-contain rounded-lg" 
                          />
                        ) : (
                          <video 
                            src={att.url} 
                            controls 
                            className="max-w-full max-h-64 rounded-lg" 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Render Parts if available (New Logic) */}
                {msg.parts && msg.parts.length > 0 ? (
                  <div className="space-y-4">
                    {msg.parts.map((part, idx) => {
                      if (part.type === 'reasoning') {
                        return <ReasoningBlock key={idx} content={part.content} />;
                      } else if (part.type === 'tool_calls') {
                        return <ToolCallsBlock key={idx} calls={part.tool_calls} />;
                      } else if (part.type === 'tool_result') {
                        return (
                          <div key={idx} className="space-y-2">
                            {part.tool_result.map((res, rIdx) => (
                              <ToolResultBlock 
                                key={rIdx} 
                                content={res.output} 
                                toolName={res.name} 
                              />
                            ))}
                          </div>
                        );
                      } else if (part.type === 'text') {
                         return (
                           <div key={idx} className={isUser ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>
                             {isTool ? (
                                <ToolResultBlock content={part.content} />
                             ) : (
                                <MarkdownRenderer content={part.content} className={isUser ? 'prose-invert' : ''}/>
                             )}
                           </div>
                         );
                      }
                      return null;
                    })}
                  </div>
                ) : (
                  /* Fallback to Legacy Rendering */
                  <>
                    {/* 2. Reasoning Block (DeepSeek/O1 style) */}
                    {msg.reasoning_content && !isUser && (
                      <ReasoningBlock content={msg.reasoning_content} />
                    )}

                    {/* 3. Tool Calls */}
                    {msg.tool_calls && msg.tool_calls.length > 0 && (
                      <ToolCallsBlock calls={msg.tool_calls} />
                    )}

                    {/* 4. Tool Results (Legacy) */}
                    {msg.tool_result && msg.tool_result.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {msg.tool_result.map((res, rIdx) => (
                          <ToolResultBlock 
                            key={rIdx} 
                            content={res.output} 
                            toolName={res.name} 
                          />
                        ))}
                      </div>
                    )}

                    {/* 5. Main Content */}
                    {msg.content && (
                      <div className={isUser ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>
                        {isTool ? (
                           <ToolResultBlock content={msg.content} />
                        ) : (
                           <MarkdownRenderer content={msg.content} className={isUser ? 'prose-invert' : ''}/>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* 5. Interrupt Info */}
                {msg.interrupt_info && (
                  <InterruptBlock 
                    info={msg.interrupt_info} 
                    onRespond={onInterruptResponse}
                    isResponded={!!msg.interrupted} // Logic to check if this specific interrupt has been handled
                    isActive={index === messages.length - 1} // Pass isActive prop
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {isLoading && (
        <div className="flex gap-4">
           <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
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
      <div ref={bottomRef} />
    </div>
  );
};
