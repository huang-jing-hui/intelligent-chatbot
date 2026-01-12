import { Message, ChatSession, ChatRequest, StreamChunk } from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Helper to handle streaming responses
export async function* streamChatCompletion(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
  const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

      if (trimmedLine.startsWith('data: ')) {
        try {
          const jsonStr = trimmedLine.slice(6);
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
export const getChatMessages = async (chatId: string): Promise<Message[]> => {
  const response = await fetch(`${API_BASE_URL}/v1/chat/get_message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "config":
          {
            "configurable": {
              "thread_id": chatId
            }
          }
    })
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
          role: delta.role,
          content: delta.content || '',
          reasoning_content: delta.reasoning_content,
          tool_calls: delta.tool_calls,
          // Normalize single tool_result object to array if present
          tool_result: delta.tool_result ? [delta.tool_result] : undefined,
          interrupt_info: delta.interrupt_info,
          timestamp: innerMsg.created * 1000
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
    const response = await fetch(`${API_BASE_URL}/v1/chat/get_message_title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

export const deleteChat = async (chatId: string) => {
  return fetch(`${API_BASE_URL}/v1/chat/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export const uploadFile = async (url: string): Promise<string> => {
  // 上传文件，传入base64 url，返回上传后文件url
  const response = await fetch(`${API_BASE_URL}/v1/file/upload`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      "file_base64": url
    })
  });
  const data = await response.json();
  if (data.status === 'success') {
    return data.data.url;
  } else {
    throw new Error(`上传失败: ${data.message || '未知错误'}`);
  }
};
