import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, className }) => {
  // Ensure content is a string to prevent crashes
  if (typeof content !== 'string') {
    // If content is falsy, return null
    if (!content) return null;
    
    // If it's an array or object, try to render it responsibly or fallback
    console.warn('MarkdownRenderer received non-string content:', content);
    
    // Attempt to convert to string if it's a number or simple type
    if (typeof content === 'number') {
        content = String(content);
    } else {
        // If it's complex (like an array from a multimodal message), 
        // we probably shouldn't be rendering it as Markdown text directly here.
        // Return null to avoid rendering "[object Object]"
        return null;
    }
  }

  // Safe Pre-processing
  const processedContent = content
    // Fix block math \[ \] -> $$
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `\n$$\n${equation.trim()}\n$$\n`)
    // Fix inline math \( \) -> $
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation.trim()}$`)
    // Better Table Pre-processing: Only add newline if the line starts with | AND the previous line is not a | line and not empty
    .split('\n')
    .map((line, i, arr) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && i > 0) {
        const prevTrimmed = arr[i - 1].trim();
        if (prevTrimmed !== '' && !prevTrimmed.startsWith('|')) {
          return '\n' + line;
        }
      }
      return line;
    })
    .join('\n');

  return (
    <article className={`prose prose-sm lg:prose-base dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Limit image size in Markdown
          img: ({node, ...props}) => (
            <img 
              className="max-w-xs max-h-48 object-contain rounded-lg shadow-sm my-2" 
              {...props} 
            />
          ),
          // Table rendering with forced visible borders and better spacing
          table: ({node, ...props}) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <table className="min-w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-gray-50 dark:bg-white/5" {...props} />,
          th: ({node, ...props}) => <th className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" {...props} />,
          td: ({node, ...props}) => <td className="border-b border-gray-100 dark:border-gray-900 px-4 py-3 text-sm text-gray-600 dark:text-gray-300" {...props} />,
          
          code(props: any) {
            const { children, className, node, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            return match ? (
              <div className="my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
                <SyntaxHighlighter
                  {...rest}
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', background: 'transparent' }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code {...rest} className={`${className} bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-pink-600 dark:text-pink-400 font-mono text-[0.9em]`}>
                {children}
              </code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </article>
  );
};
