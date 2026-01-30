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
  "ipynb",
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

export interface Model {
  id: string;
  name: string;
  isVlm: boolean;
}

// coding
export const AVAILABLE_MODELS: Model[] = [
  { id: 'doubao-seed-code-preview-latest', name: 'doubao-seed-code-preview-latest', isVlm: true },
  { id: 'ark-code-latest', name: 'ark-code-latest', isVlm: true },
];

/*export const AVAILABLE_MODELS: Model[] = [
  { id: 'kimi-k2-250905', name: 'kimi-k2-250905', isVlm: false },
  { id: 'kimi-k2-thinking-251104', name: 'kimi-k2-thinking-251104', isVlm: false },
  { id: 'deepseek-v3-2-251201', name: 'deepseek-v3-2-251201', isVlm: false },
  { id: 'doubao-seed-1-8-251228', name: 'doubao-seed-1-8-251228', isVlm: true },
  { id: 'doubao-seed-code-preview-251028', name: 'doubao-seed-code-preview-251028', isVlm: true },
  { id: 'glm-4-7-251222', name: 'glm-4-7-251222', isVlm: false },
];*/

export const DEFAULT_MODEL = 'ark-code-latest'; // Fallback default model

// 备用模型列表（当API加载失败时使用）
export const FALLBACK_MODELS: Model[] = [
  { id: 'doubao-seed-code-preview-latest', name: 'doubao-seed-code-preview-latest', isVlm: true },
  { id: 'ark-code-latest', name: 'ark-code-latest', isVlm: true },
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
  lc_source?: string; // 中间步骤标识（如上下压缩、摘要等）
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
        lc_source?: string;
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

// ==================== 知识库类型定义 ====================

export interface KnowledgeBase {
  kb_id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface KBFile {
  id: string;
  file_url: string;
  file_name: string;
  kb_id: string;
  user_id: string;
  created_at: string;
}

export interface DocumentChunk {
  content: string;
  metadata: {
    source?: string;
    parent_id?: string;
    chunk_index?: number;
    [key: string]: any;
  };
}

export interface SearchResult {
  content: string;
  metadata: {
    source?: string;
    parent_id?: string;
    chunk_index?: number;
    [key: string]: any;
  };
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseRequest {
  kb_id: string;
  name?: string;
  description?: string;
}

export interface DeleteKnowledgeBaseRequest {
  kb_id: string;
}

export interface GetKnowledgeBaseRequest {
  kb_id: string;
}

export interface ListKnowledgeBasesRequest {
  limit: number;
}

export interface StoreDocumentRequest {
  file_url: string;
  file_base64: string;
  knowledge_base_id: string;
  file_name?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  metadata?: Record<string, any>;
  use_parent_child?: boolean;
  parent_chunk_size?: number;
  parent_chunk_overlap?: number;
  child_chunk_size?: number;
  child_chunk_overlap?: number;
}

export interface SearchDocumentsRequest {
  query: string;
  knowledge_base_id: string;
  k?: number;
  score_threshold?: number;
  filter_metadata?: Record<string, any>;
  enable_rerank?: boolean;
  dense_limit?: number;
  sparse_limit?: number;
}

export interface DeleteDocumentRequest {
  file_url: string;
  knowledge_base_id: string;
  parent_id?: string;
}

export interface ListKBFilesRequest {
  kb_id: string;
}

export interface DeleteFileFromKBRequest {
  file_url: string;
  kb_id: string;
}

// ==================== 模型配置类型定义 ====================

export interface ModelsConfigResponse {
  model: string;
  is_vllm: boolean;
}
