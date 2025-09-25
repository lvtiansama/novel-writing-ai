// 动态获取API基础URL，支持ngrok和代理
const getApiBase = () => {
  // 检查是否有环境变量或URL参数指定后端地址
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 
                     new URLSearchParams(window.location.search).get('backend');
  
  if (backendUrl) {
    // 如果指定了后端URL，使用完整URL
    return `${backendUrl}/api`;
  } else {
    // 否则使用相对路径，让Vite代理处理
    return '/api';
  }
};

const API_BASE = getApiBase();
const CHAT_BASE = `${API_BASE}/chat`;
const AGENT_BASE = `${API_BASE}/agent`;

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
}

// 获取文件树
export async function getFileTree(): Promise<FileNode[]> {
  try {
    const response = await fetch(`${API_BASE}/files`);
    if (!response.ok) throw new Error('Failed to fetch file tree');
    return await response.json();
  } catch (error) {
    console.error('Error fetching file tree:', error);
    return [];
  }
}

// 读取文件内容
export async function readFile(filePath: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}`);
    if (!response.ok) {
      if (response.status === 404) {
        return '';
      }
      throw new Error('Failed to read file');
    }
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error reading file:', error);
    return '';
  }
}

// 保存文件内容
export async function restoreFile(filePath: string, content: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/files/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath,
        content: content,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('Error restoring file:', error);
    return false;
  }
}

export async function saveFile(filePath: string, content: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
}

// 创建文件或文件夹
export async function createFileOrFolder(parentPath: string, name: string, type: 'file' | 'folder'): Promise<{ ok: boolean; conflict?: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: parentPath, name, type }),
    });
    if (response.status === 409) return { ok: false, conflict: true };
    return { ok: response.ok };
  } catch (error) {
    console.error('Error creating file/folder:', error);
    return { ok: false };
  }
}

// 删除文件或文件夹
export async function deleteFileOrFolder(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting file/folder:', error);
    return false;
  }
}

// 重命名文件或文件夹
export async function renameFileOrFolder(filePath: string, newName: string): Promise<{ ok: boolean; conflict?: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newName }),
    });
    if (response.status === 409) return { ok: false, conflict: true };
    return { ok: response.ok };
  } catch (error) {
    console.error('Error renaming file/folder:', error);
    return { ok: false };
  }
}

// 读取指定行
export async function readLine(filePath: string, lineNumber: number): Promise<{ 
  content?: string; 
  lineNumber?: number; 
  totalLines?: number; 
  error?: string 
}> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}/line/${lineNumber}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to read line' }));
      return { error: errorData.error || 'Failed to read line' };
    }
    return await response.json();
  } catch (error) {
    console.error('Error reading line:', error);
    return { error: 'Failed to read line' };
  }
}

// 编辑指定行
export async function editLine(filePath: string, lineNumber: number, newContent: string): Promise<{ 
  success?: boolean; 
  lineNumber?: number; 
  oldContent?: string; 
  newContent?: string; 
  totalLines?: number; 
  error?: string 
}> {
  try {
    const response = await fetch(`${API_BASE}/files/${filePath}/line/${lineNumber}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: newContent }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to edit line' }));
      return { error: errorData.error || 'Failed to edit line' };
    }
    return await response.json();
  } catch (error) {
    console.error('Error editing line:', error);
    return { error: 'Failed to edit line' };
  }
}

// 流式聊天（SSE透传）
export async function streamChat(params: {
  apiKey: string;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  systemPrompt?: string;
  systemPrompts?: string[];
  selectedFile?: string | null;
  editorContent?: string;
  onToken: (delta: string) => void;
  onToolCall?: (toolCall: { name: string; parameters: any }) => void;
  signal?: AbortSignal; // 添加中断信号支持
}): Promise<void> {
  console.log('[STREAM CHAT] 开始调用streamChat');
  console.log('[STREAM CHAT] 消息数量:', params.messages.length);
  console.log('[STREAM CHAT] systemPrompt长度:', params.systemPrompt?.length || 0);
  
  const response = await fetch(`${CHAT_BASE}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal, // 传递中断信号
    body: JSON.stringify({
      apiKey: params.apiKey,
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      systemPrompts: params.systemPrompts,
      selectedFile: params.selectedFile,
      editorContent: params.editorContent,
    }),
  });

  if (!response.ok || !response.body) {
    console.error('[STREAM CHAT] 请求失败:', response.status);
    throw new Error('Chat stream failed');
  }

  console.log('[STREAM CHAT] 开始读取响应流');
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let totalTokens = 0;
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      console.log('[STREAM CHAT] 流读取完成，总共接收token数:', totalTokens);
      break;
    }
    
    const chunk = decoder.decode(value, { stream: true });
    // 透传 OpenAI 兼容的 data: 行
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        console.log('[STREAM CHAT] 收到[DONE]信号');
        break;
      }
      try {
        const obj = JSON.parse(data);
        
        // 检查是否是错误信息
        if (obj?.error) {
          console.error('[STREAM CHAT] 收到服务器错误:', obj.error, obj.detail);
          console.log('[STREAM CHAT] 错误对象完整内容:', JSON.stringify(obj));
          console.log('[STREAM CHAT] 错误类型检查:', typeof obj.error, `"${obj.error}"`);
          
          // 特殊处理API Key错误，直接使用友好的错误消息
          if (obj.error === 'API Key 无效或已过期') {
            console.log('[STREAM CHAT] 命中API Key特殊处理逻辑');
            const currentDomain = window.location.origin;
            const friendlyMsg = `❌ API Key 无效或已过期，请检查 API 设置：${currentDomain}/key`;
            console.log('[STREAM CHAT] 抛出友好错误消息:', friendlyMsg);
            throw new Error(friendlyMsg);
          }
          console.log('[STREAM CHAT] 未命中特殊处理，使用默认错误处理');
          const errorMsg = `${obj.error}: ${obj.detail || obj.error}`;
          console.log('[STREAM CHAT] 默认错误消息:', errorMsg);
          throw new Error(errorMsg);
        }
        
        // 检查是否是工具调用事件
        if (obj?.toolCallEvent) {
          console.log('[STREAM CHAT] 收到工具调用事件:', obj.toolCallEvent);
          // 直接触发工具调用处理
          if (params.onToolCall) {
            params.onToolCall(obj.toolCallEvent);
          }
          continue;
        }
        
        const delta = obj?.choices?.[0]?.delta?.content
          ?? obj?.Choices?.[0]?.Delta?.Content
          ?? '';
        if (delta) {
          totalTokens++;
          console.log(`[STREAM CHAT] 收到token #${totalTokens}:`, delta.substring(0, 20) + (delta.length > 20 ? '...' : ''));
          
          // 检查是否包含 <tool_call> 标记，如果是则跳过
          if (delta.includes('<tool_call>') || delta.includes('</tool_call>')) {
            console.log('[STREAM CHAT] 检测到tool_call标签，跳过不传递给前端');
            // 跳过，不传递给前端
            continue;
          }
          
          // 直接输出内容，前端会处理 <user> 标签
          params.onToken(delta);
        }
      } catch {
        // 直接作为文本追加
        if (data) {
          console.log('[STREAM CHAT] JSON解析失败，直接传递:', data.substring(0, 50) + '...');
          console.log('[STREAM CHAT] 原始数据全内容:', JSON.stringify(data));
          // 检查是否包含错误信息
          if (data.includes('"error"') && data.includes('无效或已过期')) {
            console.log('[STREAM CHAT] 检测到非标准JSON中包含API Key错误');
            const friendlyMsg = `❌ API Key 无效或已过期，请检查 API 设置：${window.location.origin}/key`;
            console.log('[STREAM CHAT] 作为非标准JSON抛出友好错误:', friendlyMsg);
            throw new Error(friendlyMsg);
          }
          params.onToken(data);
        }
      }
    }
  }
}

export async function streamAgent(params: {
  apiKey: string;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  selectedFile?: string | null;
  editorContent?: string;
  onToken: (delta: string) => void;
  onChangedFiles?: (files: string[], modifiedLines?: Record<string, number[]>, diffData?: Record<string, { oldContent: string; newContent: string }>) => void;
  onToolEvent?: (evt: { tool: string; action?: string; path?: string; status: 'start' | 'success' | 'error'; message?: string; agent?: string }) => void;
  onAgentEvent?: (evt: { agent: string; agentName: string; task: string; status: 'start' | 'success' | 'error'; result?: string }) => void;
  systemPrompts?: string[];
  signal?: AbortSignal; // 添加中断信号
}): Promise<void> {
  const response = await fetch(`${AGENT_BASE}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal, // 传递中断信号
    body: JSON.stringify({
      apiKey: params.apiKey,
      messages: params.messages,
      selectedFile: params.selectedFile,
      editorContent: params.editorContent,
      systemPrompts: params.systemPrompts,
    }),
  });
  if (!response.ok || !response.body) throw new Error('Agent stream failed');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') break;
      try {
        const obj = JSON.parse(data);
        
        // 检查是否是错误信息
        if (obj?.error) {
          console.error('[STREAM AGENT] 收到服务器错误:', obj.error, obj.detail);
          console.log('[STREAM AGENT] 错误对象完整内容:', JSON.stringify(obj));
          console.log('[STREAM AGENT] 错误类型检查:', typeof obj.error, `"${obj.error}"`);
          
          // 特殊处理API Key错误，直接使用友好的错误消息
          if (obj.error === 'API Key 无效或已过期') {
            console.log('[STREAM AGENT] 命中API Key特殊处理逻辑');
            const currentDomain = window.location.origin;
            const friendlyMsg = `❌ API Key 无效或已过期，请检查 API 设置：${currentDomain}/key`;
            console.log('[STREAM AGENT] 抛出友好错误消息:', friendlyMsg);
            throw new Error(friendlyMsg);
          }
          console.log('[STREAM AGENT] 未命中特殊处理，使用默认错误处理');
          const errorMsg = `${obj.error}: ${obj.detail || obj.error}`;
          console.log('[STREAM AGENT] 默认错误消息:', errorMsg);
          throw new Error(errorMsg);
        }
        
        // Agent事件
        if (obj?.agentEvent && params.onAgentEvent) {
          const ae = obj.agentEvent;
          params.onAgentEvent({
            agent: ae.agent,
            agentName: ae.agentName,
            task: ae.task,
            status: ae.status,
            result: ae.result,
          });
          continue;
        }
        // 工具事件
        if (obj?.toolEvent && params.onToolEvent) {
          const te = obj.toolEvent;
          params.onToolEvent({
            tool: te.tool,
            action: te.action,
            path: te.path,
            status: te.status,
            message: te.message,
            agent: te.agent,
          });
          continue;
        }
        if (Array.isArray(obj?.changedFiles)) {
          params.onChangedFiles?.(obj.changedFiles, obj?.modifiedLines, obj?.diffData);
          continue;
        }
        const delta = obj?.choices?.[0]?.delta?.content
          ?? obj?.Choices?.[0]?.Delta?.Content
          ?? '';
        if (delta) {
          // 检查是否包含 <tool> 标记，如果是则跳过
          if (delta.includes('<tool>') || delta.includes('</tool>')) {
            continue;
          }
          
          // 直接输出内容，前端会处理 <user> 标签
          params.onToken(delta);
        }
      } catch {
        if (data) {
          console.log('[STREAM AGENT] JSON解析失败，原始数据:', JSON.stringify(data));
          // 检查是否包含错误信息
          if (data.includes('"error"') && data.includes('无效或已过期')) {
            console.log('[STREAM AGENT] 检测到非标准JSON中包含API Key错误');
            const friendlyMsg = `❌ API Key 无效或已过期，请检查 API 设置：${window.location.origin}/key`;
            throw new Error(friendlyMsg);
          }
          params.onToken(data);
        }
      }
    }
  }
}
export async function agentRun(params: {
  apiKey: string;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  selectedFile?: string | null;
  editorContent?: string;
  systemPrompts?: string[];
}): Promise<{ content: string; changedFiles?: string[] }> {
  const response = await fetch(`${AGENT_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: params.apiKey,
      messages: params.messages,
      selectedFile: params.selectedFile,
      editorContent: params.editorContent,
      systemPrompts: params.systemPrompts,
    }),
  });
  if (!response.ok) {
    throw new Error('Agent run failed');
  }
  const data = await response.json();
  return { content: data?.content || '', changedFiles: data?.changedFiles || [] };
}
