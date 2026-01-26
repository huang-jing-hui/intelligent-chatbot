import React, {useState} from 'react';
import {Message, Attachment, ToolCall, ToolResult} from '../types';
import {ReasoningBlock, ToolCallsBlock, ToolResultBlock, InterruptBlock} from './MessageBlocks';
import {MarkdownRenderer} from './MarkdownRenderer';
import {
    Download,
    Copy,
    Check,
    Trash2,
    FileText,
    FileCode,
    FileSpreadsheet,
    File as FileIcon,
    FileImage,
    FileVideo,
    Loader2
} from 'lucide-react';

interface Props {
    msg: Message;
    isUser: boolean;
    onDeleteMessage?: (id: string) => void;
    onInterruptResponse: (response: string, streamId?: string) => void;
    completedToolIds: Set<string>;
    onPreviewMedia: (media: { url: string, type: 'image' | 'video' | 'file', name?: string }) => void;
    isLast: boolean;
}

const CopyButton = ({content, isUser}: { content: string; isUser: boolean }) => {
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
            {copied ? <Check className="w-3.5 h-3.5 text-green-500"/> : <Copy className="w-3.5 h-3.5"/>}
            <span className="text-[10px] font-medium uppercase tracking-wider">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
    );
};

const DeleteButton = ({isUser, onDelete}: { isUser: boolean; onDelete: () => Promise<void> | void }) => {
    const [confirming, setConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirming) {
            setIsDeleting(true);
            try {
                await onDelete();
            } catch (e) {
                setIsDeleting(false);
            }
        } else {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 3000);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isDeleting}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${isUser
                ? 'bg-blue-100 text-blue-600 hover:bg-red-100 hover:text-red-600 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'} ${isDeleting ? 'opacity-70 cursor-wait' : ''}`}
            title="Delete Message"
        >
            {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin"/>
            ) : (
                <Trash2 className={`w-3.5 h-3.5 ${confirming ? 'text-red-500' : ''}`}/>
            )}
            <span
                className={`text-[10px] font-medium uppercase tracking-wider ${confirming || isDeleting ? 'text-red-500' : ''}`}>
        {isDeleting ? 'Deleting...' : confirming ? 'Confirm?' : 'Delete'}
      </span>
        </button>
    );
};

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
        case 'pdf':
            return <FileText className="w-5 h-5 text-red-500"/>;
        case 'xls':
        case 'xlsx':
        case 'csv':
            return <FileSpreadsheet className="w-5 h-5 text-green-500"/>;
        case 'doc':
        case 'docx':
            return <FileText className="w-5 h-5 text-blue-500"/>;
        case 'js':
        case 'ts':
        case 'tsx':
        case 'jsx':
        case 'py':
        case 'java':
        case 'html':
        case 'css':
        case 'json':
        case 'xml':
            return <FileCode className="w-5 h-5 text-yellow-500"/>;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
        case 'svg':
            return <FileImage className="w-5 h-5 text-purple-500"/>;
        case 'mp4':
        case 'webm':
        case 'mov':
            return <FileVideo className="w-5 h-5 text-pink-500"/>;
        default:
            return <FileIcon className="w-5 h-5 text-gray-500"/>;
    }
};

export const MessageItem: React.FC<Props> = React.memo(({
                                                            msg,
                                                            isUser,
                                                            onDeleteMessage,
                                                            onInterruptResponse,
                                                            completedToolIds,
                                                            onPreviewMedia,
                                                            isLast
                                                        }) => {
    const renderBlocks: React.ReactNode[] = [];
    const msgKey = msg.id;

    // Helper for Text Bubbles
    const wrapInTextBubble = (content: React.ReactNode, key: string, rawText?: string, msgId?: string) => (
        <div key={key}
             className={`w-full rounded-2xl px-4 py-3 shadow-sm group/bubble ${isUser ? 'bg-blue-50 text-gray-800 dark:bg-blue-900/30 dark:text-gray-200 text-[14px]' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-[14px]'}`}>
            {content}

            {/* Footer Actions: Copy & Delete */}
            {(rawText && rawText.trim() || (msg.message_id && onDeleteMessage)) && (
                <div
                    className="flex justify-end mt-2 pt-2 border-t border-black/5 dark:border-white/5 opacity-0 group-hover/bubble:opacity-100 transition-opacity gap-2">
                    {rawText && rawText.trim() && <CopyButton content={rawText} isUser={isUser}/>}

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
    const renderMediaGrid = (mediaItems: Attachment[], keyPrefix: string) => {
        if (!mediaItems || mediaItems.length === 0) return null;

        const content = (
            <div className="flex flex-wrap gap-2">
                {mediaItems.map((item, idx) => (
                    <div
                        key={`${keyPrefix}-${idx}`}
                        className="relative rounded-lg overflow-hidden bg-black/10 dark:bg-white/10 w-24 h-24 shrink-0 cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 dark:border-gray-700"
                        onClick={() => onPreviewMedia(item)}
                    >
                        {item.type === 'image' ? (
                            <img src={item.url} alt={item.name} className="w-full h-full object-cover"/>
                        ) : (
                            <video src={item.url} className="w-full h-full object-cover"/>
                        )}
                    </div>
                ))}
            </div>
        );

        return wrapInTextBubble(content, keyPrefix, '', msg.id);
    };

    // Helper to render file list
    const renderFileList = (files: Attachment[], keyPrefix: string) => {
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
                            <div
                                className="text-sm font-medium truncate text-gray-700 dark:text-gray-200">{file.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{file.extension}</div>
                        </div>
                        <Download className="w-4 h-4 text-gray-400 group-hover/file:text-blue-500 transition-colors"/>
                    </a>
                ))}
            </div>
        );

        return (
            <div key={keyPrefix} className="w-full">
                {content}
            </div>
        );
    };

    // Combine Attachments
    const combinedAttachments: Attachment[] = [];

    // 1. Local Attachments
    if (msg.attachments) {
        msg.attachments.forEach(att => combinedAttachments.push({
            url: att.url,
            type: att.type,
            name: att.name,
            extension: att.extension || getExtension(att.name),
            id: att.id
        }));
    }

    // 2. Server Files
    if (Array.isArray(msg.files)) {
        msg.files.forEach(f => {
            const url = f.file_url;
            const name = f.file_name;
            if (!combinedAttachments.some(att => att.url === url)) {
                const ext = getExtension(name);
                let type: 'image' | 'video' | 'file' = 'file';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) type = 'image';
                else if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';

                combinedAttachments.push({
                    url,
                    type,
                    name,
                    extension: ext
                });
            }
        });
    }

    const visuals = combinedAttachments.filter(a => a.type === 'image' || a.type === 'video');
    const docs = combinedAttachments.filter(a => a.type === 'file');

    if (visuals.length > 0) {
        renderBlocks.push(renderMediaGrid(visuals, `vis-${msgKey}`));
    }
    if (docs.length > 0) {
        renderBlocks.push(renderFileList(docs, `doc-${msgKey}`));
    }

    // Check if message has any substantial content (not just lc_source)
    const hasSubstantialContent = () => {
        if (msg.content && msg.content.trim()) return true;
        if (msg.parts && msg.parts.length > 0) {
            const hasNonLcSourceParts = msg.parts.some(p => p.type !== 'text' || (p.content && p.content.trim()));
            if (hasNonLcSourceParts) return true;
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) return true;
        if (msg.tool_result && msg.tool_result.length > 0) return true;
        if (msg.interrupt_info) return true;
        return false;
    };
    // Render lc_source indicator (intermediate steps)
    const renderLcSource = (lcSource?: string) => {
        if (!lcSource) return null;
        return wrapInTextBubble(
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin"/>
                <span className="text-sm">{lcSource}中。。</span>
            </div>,
            `${msgKey}-lc-source`,
            '',
            undefined
        );
    };
    // Render lc_source indicator if present and no substantial content (for intermediate steps)
    if (msg.lc_source && !hasSubstantialContent()) {
        renderBlocks.push(renderLcSource(msg.lc_source));
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
                <MarkdownRenderer content={cleaned} className={isUser ? '' : ''}/>
                , `${msgId}-content`, cleaned, msg.id);
        }

        if (Array.isArray(content)) {
            const mediaParts = content.filter(p => p.type === 'image_url' || p.type === 'video_url').map(p => ({
                url: p.type === 'image_url' ? p.image_url.url : p.video_url.url,
                type: (p.type === 'image_url' ? 'image' : 'video') as 'image' | 'video',
                name: 'media'
            } as Attachment));
            const textParts = content.filter(p => p.type === 'text');

            return (
                <div key={`${msgId}-multimodal`} className="space-y-2 w-full">
                    {renderMediaGrid(mediaParts, `${msgId}-media`)}
                    {textParts.map((p, i) => {
                        const text = cleanText(p.text || p.content || '');
                        if (!text) return null;
                        return wrapInTextBubble(
                            <MarkdownRenderer content={text} className={isUser ? '' : ''}/>
                            , `${msgId}-txt-${i}`, text, msg.id);
                    })}
                </div>
            );
        }
        return null;
    };

    const renderNakedBlock = (content: React.ReactNode, key: string) => (
        <div key={key} className="w-full">
            {content}
        </div>
    );

    // Parts or Legacy
    if (msg.parts && msg.parts.length > 0) {
        msg.parts.forEach((part, pIdx) => {
            const key = `${msgKey}-p${pIdx}`;
            if (part.type === 'reasoning') {
                renderBlocks.push(renderNakedBlock(<ReasoningBlock content={part.content}/>, key));
            } else if (part.type === 'tool_calls') {
                part.tool_calls.forEach((call, tcIdx) => {
                    renderBlocks.push(renderNakedBlock(<ToolCallsBlock calls={[call]}
                                                                       completedIds={completedToolIds}/>, `${key}-tc${tcIdx}`));
                });
            } else if (part.type === 'tool_result') {
                part.tool_result.forEach((res, rIdx) => {
                    if (!isToolResultEmpty(res.output, res.name)) {
                        renderBlocks.push(renderNakedBlock(
                            <ToolResultBlock content={res.output} toolName={res.name}/>
                            , `${key}-tr${rIdx}`));
                    }
                });
            } else if (part.type === 'text') {
                if (msg.role === 'tool' || msg.role === 'tool_result') {
                    if (!isToolResultEmpty(part.content)) {
                        renderBlocks.push(renderNakedBlock(<ToolResultBlock content={part.content}/>, key));
                    }
                } else {
                    renderBlocks.push(renderMultimodalContent(part.content, key));
                }
            }
        });
    } else {
        // Legacy Rendering
        if (msg.reasoning_content && !isUser) {
            renderBlocks.push(renderNakedBlock(<ReasoningBlock
                content={msg.reasoning_content}/>, `${msgKey}-reasoning`));
        }
        if (msg.content) {
            if (msg.role === 'tool' || msg.role === 'tool_result') {
                if (!isToolResultEmpty(msg.content)) {
                    renderBlocks.push(renderNakedBlock(<ToolResultBlock content={msg.content}/>, `${msgKey}-content`));
                }
            } else {
                renderBlocks.push(renderMultimodalContent(msg.content, msg.id));
            }
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            msg.tool_calls.forEach((call, tcIdx) => {
                renderBlocks.push(renderNakedBlock(<ToolCallsBlock calls={[call]}
                                                                   completedIds={completedToolIds}/>, `${msgKey}-call-${tcIdx}`));
            });
        }
        if (msg.tool_result && msg.tool_result.length > 0) {
            msg.tool_result.forEach((res, rIdx) => {
                if (!isToolResultEmpty(res.output, res.name)) {
                    renderBlocks.push(renderNakedBlock(
                        <ToolResultBlock content={res.output} toolName={res.name}/>
                        , `${msgKey}-res-${rIdx}`));
                }
            });
        }

    }

    // Interrupt
    if (msg.interrupt_info) {
        renderBlocks.push(renderNakedBlock(
            <InterruptBlock
                info={msg.interrupt_info}
                onRespond={(resp) => onInterruptResponse(resp, msg.id)}
                isResponded={!!msg.interrupted}
                isActive={isLast}
            />
            , `${msgKey}-interrupt`));
    }

    return <>{renderBlocks}</>;
}, (prev, next) => {
    // Memoization Check
    // We want to return TRUE if props are equal (DO NOT RENDER)

    if (prev.isUser !== next.isUser) return false;
    if (prev.isLast !== next.isLast) return false;

    // Check msg content/parts
    const pMsg = prev.msg;
    const nMsg = next.msg;

    if (pMsg === nMsg) {
        // If reference is same, verify completedToolIds didn't change relevant to this message
        // If this message has tool calls, we might need to re-render if completedToolIds changed?
        // Yes, ToolCallsBlock uses completedToolIds.
        if (pMsg.tool_calls || pMsg.parts?.some(p => p.type === 'tool_calls')) {
            // We could do deep check, but for now strict set comparison (reference) or size?
            // completedToolIds is a Set. Pasing a new Set every time breaks memo.
            // MessageList creates a new Set every render.
            // We should optimize `completedToolIds` creation or check if it affects THIS message.

            // If we assume `completedToolIds` only grows, we can check size?
            // Or just re-render.
            if (prev.completedToolIds !== next.completedToolIds) {
                // Ideally check intersection with this message's tool calls.
                // Too complex for equality check.
                // If we pass completedToolIds, we probably accept re-render if it changes.
                // But MessageList creates it on every render.
                return false;
            }
        }

        return true;
    }

    // Deep check relevant fields if objects are different
    if (pMsg.content !== nMsg.content) return false;
    if (pMsg.reasoning_content !== nMsg.reasoning_content) return false;
    if (pMsg.interrupted !== nMsg.interrupted) return false;

    // Array lengths
    if (pMsg.parts?.length !== nMsg.parts?.length) return false;
    if (pMsg.tool_calls?.length !== nMsg.tool_calls?.length) return false;
    if (pMsg.tool_result?.length !== nMsg.tool_result?.length) return false;

    // If parts length matches, check last part content?
    // For streaming, last part usually changes.
    // If we are here, references are different.

    return false;
});
