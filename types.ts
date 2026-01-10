export interface Attachment {
  id: string;
  type: 'image' | 'video';
  url: string; // Data URL or remote URL
  name: string;
}

export type MessagePart =
  | { type: 'reasoning'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[] }
  | { type: 'tool_result'; tool_result: ToolResult[] }
  | { type: 'text'; content: string };

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  parts?: MessagePart[];
  tool_call_id?: string; // For tool messages
  interrupted?: boolean;
  interrupt_info?: InterruptInfo;
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

export interface ChatRequest {
  model: string;
  messages: {
    role: string;
    content: string | any[]; // Relaxed to support array of content parts
  }[];
  stream?: boolean;
  config?: {
    configurable?: {
      thread_id?: string;
    }
  };
}
