import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
  className?: string;
}

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-[#f6f8fa] dark:bg-gray-900/50 shadow-sm group/code">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="text-[10px] font-medium">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            background: 'transparent',
          }}
          codeTagProps={{
            style: { background: 'transparent' }
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<Props> = ({ content, className }) => {
  // Ensure content is a string to prevent crashes
  if (typeof content !== 'string') {
    if (!content) return null;
    console.warn('MarkdownRenderer received non-string content:', content);
    if (typeof content === 'number') {
        content = String(content);
    } else {
        return null;
    }
  }

  // Safe Pre-processing
  const processedContent = content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `\n$$\n${equation.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation.trim()}$`)
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
          img: ({node, ...props}) => (
            <img 
              className="max-w-xs max-h-48 object-contain rounded-lg shadow-sm my-2" 
              {...props} 
            />
          ),
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
            const language = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');

            if (match) {
              return <CodeBlock language={language} value={value} />;
            }

            return (
              <code {...rest} className={`${className} bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-[0.9em]`}>
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