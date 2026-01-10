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
    return JSON.parse(data.data);
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
