import {Message, ChatSession, ChatRequest, StreamChunk} from '../types';

const getApiBaseUrl = () => localStorage.getItem('apiUrl') || (window as any).AI_CHATBOT_CONFIG?.AI_CHATBOT_BASE || process.env.AI_CHATBOT_BASE || 'http://localhost:8000';
const getApiKey = () => localStorage.getItem('apiKey') || (window as any).AI_CHATBOT_CONFIG?.AI_CHATBOT_API_KEY || process.env.AI_CHATBOT_API_KEY || '';

// Helper to handle streaming responses
export async function* streamChatCompletion(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk, void, unknown> {
    const apiKey = getApiKey();
    const headers: { 'Content-Type': string; 'Authorization'?: string } = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
                try {
                    const jsonStr = trimmedLine.slice(6);
                    // console.log('Received SSE chunk:', jsonStr);
                    const chunk: StreamChunk = JSON.parse(jsonStr);
                    yield chunk;
                } catch (e) {
                    console.warn('Failed to parse SSE chunk', e);
                }
            }
        }
    }
}

// REST endpoints
export const getChatMessages = async (chatId: string, offset: number, limit: number, signal?: AbortSignal): Promise<Message[]> => {
    const apiKey = getApiKey();
    const headers: { 'Content-Type': string; 'Authorization'?: string } = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/chat/get_message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            "config":
                {
                    "configurable": {
                        "thread_id": chatId
                    }
                },
            "offset": offset,
            "limit": limit
        }),
        signal
    });
    const data = await response.json();
    if (data.status === 'success') {
        const rawMessages = JSON.parse(data.data);
        return rawMessages.map((item: any) => {
            try {
                const innerMsg = JSON.parse(item.message);
                const choice = innerMsg.choices[0];
                const delta = choice.delta;

                return {
                    id: innerMsg.id,
                    message_id: item.message_id,
                    role: delta.role,
                    content: delta.content || '',
                    reasoning_content: delta.reasoning_content,
                    tool_calls: delta.tool_calls,
                    // Normalize single tool_result object to array if present
                    tool_result: delta.tool_result ? [delta.tool_result] : undefined,
                    interrupt_info: delta.interrupt_info,
                    files: Array.isArray(delta.files) ? (delta.files as any[]) : undefined,
                    timestamp: innerMsg.created * 1000,
                    usage: innerMsg.usage,
                };
            } catch (e) {
                console.warn("Failed to parse message item", item, e);
                return null;
            }
        }).filter((msg: any) => msg !== null);
    }
    return [];
};

export const getChatTitles = async (): Promise<ChatSession[]> => {
    try {
        const apiKey = getApiKey();
        const headers: { 'Content-Type': string; 'Authorization'?: string } = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${getApiBaseUrl()}/v1/chat/get_message_title`, {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        const data = await response.json();
        if (data.status === 'success') {
            const raw = JSON.parse(data.data);
            return raw.map((item: any) => ({
                id: item.thread_id,
                title: item.title,
                updated_at: item.updated_at || new Date().toISOString()
            }));
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch titles", error);
        return [];
    }
};

export const updateChatTitle = async (chatId: string, title: string): Promise<boolean> => {
    try {
        const apiKey = getApiKey();
        const headers: { 'Content-Type': string; 'Authorization'?: string } = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${getApiBaseUrl()}/v1/chat/update_title`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                "config":
                    {
                        "configurable": {
                            "thread_id": chatId
                        }
                    },
                "title": title
            })
        });
        const data = await response.json();
        return data.status === 'success';
    } catch (error) {
        console.error("Failed to fetch titles", error);
        return false;
    }
};

export const deleteChat = async (chatId: string) => {
    const apiKey = getApiKey();
    const headers: { 'Content-Type': string; 'Authorization'?: string } = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return fetch(`${getApiBaseUrl()}/v1/chat/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            "config":
                {
                    "configurable": {
                        "thread_id": chatId
                    }
                }
        })
    });
};

export const deleteChatSpecify = async (chatId: string, stream_id: string) => {
    console.log('deleteChatSpecify：',  stream_id);
    const apiKey = getApiKey();
    const headers: { 'Content-Type': string; 'Authorization'?: string } = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/chat/delete/specify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            "config":
                {
                    "configurable": {
                        "thread_id": chatId
                    }
                },
            "stream_id": stream_id
        })
    });
    const data = await response.json();
    if (data.status === 'success') {
        return null
    }else {
        return `删除失败: ${data.message || '未知错误'}`;
    }
};

export const uploadFile = async (url: string,file_name:string,need_parse:boolean): Promise<string> => {
    // 上传文件，传入base64 url 文件名 是否需要解析，返回上传后文件url
    const apiKey = getApiKey();
    const headers: { 'Content-Type': string; 'Authorization'?: string } = {
        'Content-Type': 'application/json',
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${getApiBaseUrl()}/v1/file/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            "file_base64": url,
            "file_name": file_name,
            "need_parse": need_parse,
        })
    });
    const data = await response.json();
    if (data.status === 'success') {
        return data.data.url;
    } else {
        throw new Error(`上传失败: ${data.message || '未知错误'}`);
    }
};

// ==================== 知识库 API ====================

import {
  KnowledgeBase, KBFile, DocumentChunk, SearchResult,
  CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest, DeleteKnowledgeBaseRequest,
  GetKnowledgeBaseRequest, ListKnowledgeBasesRequest, StoreDocumentRequest,
  SearchDocumentsRequest, DeleteDocumentRequest, ListKBFilesRequest, DeleteFileFromKBRequest
} from '../types';

// 知识库管理

export const createKnowledgeBase = async (request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data;
  } else {
    throw new Error(data.message || '创建知识库失败');
  }
};

export const updateKnowledgeBase = async (request: UpdateKnowledgeBaseRequest): Promise<boolean> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/update`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return true;
  } else {
    throw new Error(data.message || '更新知识库失败');
  }
};

export const deleteKnowledgeBase = async (request: DeleteKnowledgeBaseRequest): Promise<boolean> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return true;
  } else {
    throw new Error(data.message || '删除知识库失败');
  }
};

export const getKnowledgeBase = async (request: GetKnowledgeBaseRequest): Promise<KnowledgeBase | null> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/get`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data;
  } else {
    return null;
  }
};

export const listKnowledgeBases = async (request: ListKnowledgeBasesRequest = { limit: 100 }): Promise<KnowledgeBase[]> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/list`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data.knowledge_bases || [];
  } else {
    throw new Error(data.message || '获取知识库列表失败');
  }
};

// 文档管理

export const storeDocument = async (request: StoreDocumentRequest): Promise<string[]> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/document/store`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data.document_ids || [];
  } else {
    throw new Error(data.message || '存储文档失败');
  }
};

export const searchDocuments = async (request: SearchDocumentsRequest): Promise<SearchResult[]> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/document/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data.documents || [];
  } else {
    throw new Error(data.message || '搜索文档失败');
  }
};

export const deleteDocument = async (request: DeleteDocumentRequest): Promise<boolean> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/document/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return true;
  } else {
    throw new Error(data.message || '删除文档失败');
  }
};

export const listKBFiles = async (request: ListKBFilesRequest): Promise<KBFile[]> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/files/list`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data.files || [];
  } else {
    throw new Error(data.message || '获取文件列表失败');
  }
};

export const deleteFileFromKnowledgeBase = async (request: DeleteFileFromKBRequest): Promise<boolean> => {
  const apiKey = getApiKey();
  const headers: { 'Content-Type': string; 'Authorization'?: string } = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${getApiBaseUrl()}/v1/rag/knowledge_base/files/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (data.status === 'success') {
    return true;
  } else {
    throw new Error(data.message || '删除文件失败');
  }
};
