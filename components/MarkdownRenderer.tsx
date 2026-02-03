import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface Props {
    content: string;
    className?: string;
    onContentChange?: (newContent: string) => void;
}

const LANGUAGES = [
    'python', 'javascript', 'typescript', 'json', 'html', 'css',
    'bash', 'cpp', 'java', 'go', 'rust', 'php', 'sql', 'xml', 'yaml', 'markdown', 'text'
];

// --- 1. 提取表格组件样式，方便复用 ---
const TableComponents = {
    table: ({ node, ...props }: any) => (
        <div className="my-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm text-[13px]">
            <table className="min-w-full border-collapse" {...props} />
        </div>
    ),
    thead: ({ node, ...props }: any) => <thead className="bg-gray-50 dark:bg-white/5" {...props} />,
    th: ({ node, ...props }: any) => <th className="border-b border-gray-200 dark:border-gray-800 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400" {...props} />,
    td: ({ node, ...props }: any) => <td className="border-b border-gray-100 dark:border-gray-900 px-3 py-2 text-[13px] text-gray-600 dark:text-gray-300" {...props} />,
};

const CodeBlock = ({ language, value, fullContent, onContentChange }: { language: string; value: string; fullContent?: string; onContentChange?: (c: string) => void }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!onContentChange || !fullContent) return;
        const newLang = e.target.value;
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(\`\`\`)${language}(\\s*\\n)${escapedValue}`, 'm');
        const match = fullContent.match(regex);

        if (match) {
            const newContent = fullContent.replace(regex, `$1${newLang}$2${value}`);
            onContentChange(newContent);
        }
    };

    return (
        <div className="my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-[#f6f8fa] dark:bg-gray-900/50 shadow-sm group/code not-prose">
            <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {onContentChange ? (
                    <select
                        value={language}
                        onChange={handleLanguageChange}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-none outline-none focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 p-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {LANGUAGES.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                        {!LANGUAGES.includes(language) && <option value={language}>{language}</option>}
                    </select>
                ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {language || 'text'}
            </span>
                )}
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
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.4',
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

export const MarkdownRenderer: React.FC<Props> = React.memo(({ content, className, onContentChange }) => {
    if (typeof content !== 'string') {
        if (!content) return null;
        if (typeof content === 'number') {
            content = String(content);
        } else {
            return null;
        }
    }

    const processedContent = (() => {
        if (typeof content !== 'string') return content;

        const codeBlocks: string[] = [];
        // Protect code blocks
        const tempContent = content.replace(/(```[\s\S]*?```|`[\s\S]*?`)/g, (match) => {
            const placeholder = `___CODE_BLOCK_${codeBlocks.length}___`;
            codeBlocks.push(match);
            return placeholder;
        });

        // Process math and table spacing
        const result = tempContent
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

        return result.replace(/___CODE_BLOCK_(\d+)___/g, (_, index) => codeBlocks[Number(index)]);
    })();

    return (
        <article className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                    pre: ({ children }) => <>{children}</>,
                    // 使用复用的表格组件
                    ...TableComponents,

                    a: ({ node, href, children, ...props }: any) => {
                        if (!href) return <a {...props}>{children}</a>;
                        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(href.split('?')[0]);
                        if (isVideo) {
                            return (
                                <video src={href} controls className="max-w-full max-h-96 rounded-lg shadow-sm my-2 block">
                                    Your browser does not support the video tag.
                                </video>
                            );
                        }
                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" {...props}>
                                {children}
                            </a>
                        );
                    },
                    img: ({ node, ...props }: any) => (
                        <img className="max-w-full max-h-96 object-contain rounded-lg shadow-sm my-2" {...props} />
                    ),

                    // --- 核心修改部分 ---
                    code(props: any) {
                        const { children, className, node, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';
                        const value = String(children).replace(/\n$/, '');

                        // 1. 特殊处理 markdown 类型的代码块
                        if (language === 'markdown') {
                            return (
                                <div className="my-4 w-full">
                                    {/* 嵌套渲染 ReactMarkdown，解包显示内容 */}
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm, remarkMath]}
                                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                                        components={{
                                            // 确保内部的表格也使用相同的样式
                                            ...TableComponents,
                                            // 内部如果还有代码块，依然使用高亮显示（防止无限递归，通常内部不会再套一层markdown block）
                                            code: ({children, className, ...rest}) => {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return match ? (
                                                    <CodeBlock
                                                        language={match[1]}
                                                        value={String(children).replace(/\n$/, '')}
                                                        // 内部代码块通常不需要支持修改，所以不传 onContentChange
                                                    />
                                                ) : (
                                                    <code className={`${className} not-prose bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-[0.9em]`} {...rest}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                        }}
                                    >
                                        {value}
                                    </ReactMarkdown>
                                </div>
                            );
                        }

                        const isCodeBlock = match || (className && className.includes('language-')) || value.includes('\n');

                        if (isCodeBlock) {
                            return <CodeBlock language={language || 'text'} value={value} fullContent={content} onContentChange={onContentChange} />;
                        }

                        return (
                            <code {...rest} className={`${className} not-prose bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-[0.9em]`}>
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
}, (prevProps, nextProps) => {
    return prevProps.content === nextProps.content &&
        prevProps.className === nextProps.className &&
        prevProps.onContentChange === nextProps.onContentChange;
});
