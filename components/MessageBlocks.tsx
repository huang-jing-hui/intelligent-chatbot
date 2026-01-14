import React, { useState } from 'react';
import { BrainCircuit, Wrench, Terminal, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCall, InterruptInfo } from '../types';

export const ReasoningBlock: React.FC<{ content: string }> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!content) return null;

  return (
    <div className="my-2 border border-blue-100 dark:border-blue-900/30 rounded-lg overflow-hidden bg-blue-50/50 dark:bg-blue-900/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors"
      >
        <BrainCircuit className="w-4 h-4" />
        <span>Thinking Process</span>
        {isExpanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 text-[13px] text-gray-600 dark:text-gray-300 font-mono border-t border-blue-100 dark:border-blue-900/30 bg-white/50 dark:bg-black/20">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
};

export const ToolCallsBlock: React.FC<{ calls: ToolCall[], completedIds?: Set<string> }> = ({ calls, completedIds }) => {
  if (!calls || calls.length === 0) return null;

  return (
    <div className="my-2 flex flex-col gap-2 w-full">
      {calls.map((call, idx) => (
        <ToolCallItem 
          key={call.id || idx} 
          call={call} 
          isCompleted={completedIds ? completedIds.has(call.id) : true} 
        />
      ))}
    </div>
  );
};

const ToolCallItem: React.FC<{ call: ToolCall, isCompleted: boolean }> = ({ call, isCompleted }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Safety check for streaming/partial data
  const functionName = call.function?.name || 'Tool';
  const args = call.function?.arguments || '';

  return (
    <div className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-900/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
      >
        {isCompleted ? (
          <Wrench className="w-3.5 h-3.5" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        )}
        <span className="truncate">{functionName}</span>
        {isExpanded ? <ChevronDown className="w-3 h-3 ml-auto shrink-0" /> : <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto border-t border-purple-200 dark:border-purple-800 bg-white/50 dark:bg-black/20">
          {args}
        </div>
      )}
    </div>
  );
};

export const ToolResultBlock: React.FC<{ content: string, toolName?: string }> = ({ content, toolName }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  let processedContent = content;
  let isUrl = false;
  let isImage = false;
  let isVideo = false;

  // Clean up toolName for display/logic
  const displayToolName = toolName && toolName.trim() !== '' && toolName.toLowerCase() !== 'unknown' ? toolName : null;

  try {
    const parsed = JSON.parse(content);
    // If it's a simple JSON object for status or empty data, set processedContent to empty string
    // This allows the block to be hidden if there's no useful info
    if (Object.keys(parsed).length === 0 || (parsed.status && Object.keys(parsed).length === 1 && !parsed.content && !parsed.results)) {
        processedContent = '';
    } else {
        processedContent = JSON.stringify(parsed, null, 2); // Pretty print JSON
    }
  } catch (e) {
    // Not JSON, check for URL
    try {
        const url = new URL(content);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
            isUrl = true;
            const path = url.pathname.toLowerCase();
            if (/\.(jpeg|jpg|gif|png|webp|svg)$/.test(path)) {
                isImage = true;
            } else if (/\.(mp4|webm|ogg|mov)$/.test(path)) {
                isVideo = true;
            }
        }
    } catch (e2) {
        // Not a valid URL
    }
  }

  // If there is no processed content (after all parsing/filtering) AND no meaningful tool name, hide the block entirely.
  // This addresses the user's request to not render if there's "no value".
  if (!processedContent.trim() && !displayToolName) {
      return null;
  }

  return (
    <div className="my-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Terminal className="w-3.5 h-3.5" />
        <span>{displayToolName ? `: ${displayToolName}` : ''} complete</span>
        {isExpanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 font-mono border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/20">
          {isImage ? (
            <a href={content} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline block mb-2 max-w-xs">
              <img src={content} alt={`Generated by ${displayToolName || 'tool'}`} className="w-full max-h-48 object-contain rounded-md" />
            </a>
          ) : isVideo ? (
            <div className="max-w-xs mb-2">
              <video src={content} controls className="w-full max-h-48 rounded-md" />
              <a href={content} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs mt-1 block">
                Open video in new tab
              </a>
            </div>
          ) : isUrl ? (
            <a href={content} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
              {content}
            </a>
          ) : (
            processedContent.trim() ? ( // Only render Markdown if there's actual content
              <MarkdownRenderer content={processedContent} />
            ) : (
              <span className="text-gray-500 dark:text-gray-400">No detailed output.</span> // Fallback message here, but only if processedContent is empty
            )
          )}
        </div>
      )}
    </div>
  );
};

interface InterruptBlockProps {
  info: InterruptInfo;
  onRespond: (response: string) => void;
  isResponded: boolean;
  isActive: boolean; // New prop
}

export const InterruptBlock: React.FC<InterruptBlockProps> = ({ info, onRespond, isResponded, isActive }) => {
  const [inputValue, setInputValue] = useState('');

  const showControls = !isResponded && isActive;

  return (
    <div className="my-3 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-r-lg shadow-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
            {info.type === 'approval_required' ? 'Approval Required' : 'Input Required'}
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{info.message}</p>

          {isResponded && (
             <div className="flex items-center gap-2 mt-2 text-green-700 dark:text-green-400 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Action completed</span>
             </div>
          )}

          {showControls && info.type === 'approval_required' && (
            <div className="flex gap-3">
              <button
                onClick={() => onRespond('yes')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Approve
              </button>
              <button
                onClick={() => onRespond('no')}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
              >
                <XCircle className="w-4 h-4" />
                No, Reject
              </button>
            </div>
          )}

          {showControls && info.type === 'input_required' && (
             <form
               onSubmit={(e) => { e.preventDefault(); onRespond(inputValue); }}
               className="flex gap-2"
             >
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-md bg-white dark:bg-black/20 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Enter your input..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                    Submit
                </button>
             </form>
          )}
        </div>
      </div>
    </div>
  );
};
