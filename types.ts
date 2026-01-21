export interface Attachment {
  id?: string;
  type: 'image' | 'video' | 'file';
  url: string; // Data URL or remote URL
  name: string;
  extension?: string; // 文件扩展名
}

// 支持的文档类型
export const vlm_handlers = [
  "pdf",
  "pptx",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
];

export const txt_handlers = [
  "txt",
  "md",
  "html",
  "java",
  "py",
  "ts",
  "css",
  "js",
  "xml",
  "json",
  "tsx",
  "yml",
  "yaml",
];

export type MessagePart =
  | { type: 'reasoning'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[] }
  | { type: 'tool_result'; tool_result: ToolResult[] }
  | { type: 'text'; content: string };

export interface Message {
  id: string;
  message_id?: string;
  role: 'user' | 'assistant' | 'tool' | 'system' | 'tool_result' | 'interrupt';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_result?: ToolResult[];
  parts?: MessagePart[];
  tool_call_id?: string; // For tool messages
  interrupted?: boolean;
  interrupt_info?: InterruptInfo;
  files?: File[];
  attachments?: Attachment[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolResult{
  tool_call_id: string
  name: string
  output: string
  status: string
}

export interface InterruptInfo {
  type: 'approval_required' | 'input_required';
  message: string;
  payload: any;
}

export interface StreamChunk {
  id: string;
  message_id?: string;
  object: string;
  created: number;
  model: string;
  choices: [
    {
      index: number;
      delta: {
        reasoning_content?: string;
        content?: string;
        tool_calls?: ToolCallChunk[];
        tool_result?: ToolResult;
        interrupt_info?: InterruptInfo;
      };
      finish_reason?: 'stop' | 'tool_calls' | 'interrupt' | null;
    }
  ];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ToolCallChunk {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

export interface File {
  file_name: string;
  file_url: string;
}

export interface ChatRequest {
  model: string;
  stream_id?: string;
  messages: Array<{
    role: string;
    content: string | any[]; // Relaxed to support array of content parts
    files?: File[]; // 用户上传的文档url列表（可选）
  }>;
  stream?: boolean;
  config?: {
    configurable?: {
      thread_id?: string;
    }
  };
}
