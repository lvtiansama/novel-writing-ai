import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { NOVEL_SYSTEM_PROMPTS, MAIN_AGENT_PROMPT, SUB_AGENTS } from './prompts/novel_prompts.js';

// 检测文件修改的行号
function detectModifiedLines(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const modifiedLines = [];
  
  // 比较每一行，找出修改的行
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      modifiedLines.push(i + 1); // 行号从1开始
    }
  }
  
  return modifiedLines;
}

// 获取当前文件的目录路径 (ES模块中的 __dirname 替代)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DEBUG_LLM = process.env.DEBUG_LLM === '0' ? false : true; // 默认开启，设置 DEBUG_LLM=0 可关闭

app.use(cors());
app.use(express.json());

// 递归读取目录结构
async function readDirectoryTree(dirPath, relativePath = '') {
  try {
    const items = await fs.readdir(dirPath);
    const tree = [];

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const itemRelativePath = relativePath ? `${relativePath}/${item}` : item;
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        const children = await readDirectoryTree(fullPath, itemRelativePath);
        tree.push({
          name: item,
          type: 'folder',
          path: itemRelativePath,
          children
        });
      } else {
        tree.push({
          name: item,
          type: 'file',
          path: itemRelativePath
        });
      }
    }

    return tree.sort((a, b) => {
      // 文件夹排在前面，然后按名称排序
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

// 获取文件树
app.get('/api/files', async (req, res) => {
  try {
    const tree = await readDirectoryTree(DATA_DIR, 'data');
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read directory' });
  }
});

// 读取文件内容
app.get('/api/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(__dirname, filePath);
    
    // 安全检查 - 确保文件在data目录内
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Failed to read file' });
    }
  }
});

// 保存文件内容
app.put('/api/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const { content } = req.body;
    const fullPath = path.join(__dirname, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 确保目录存在
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// 创建文件或文件夹
app.post('/api/files', async (req, res) => {
  try {
    const { path: filePath, type, name } = req.body;
    const fullPath = path.join(__dirname, filePath, name);
    
    // 安全检查
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 同名检查：若已存在则返回 409 冲突
    const exists = await fs.stat(fullPath).then(() => true).catch(() => false);
    if (exists) {
      return res.status(409).json({ error: 'File or folder already exists' });
    }

    if (type === 'folder') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      // 确保目录存在
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, '', 'utf8');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating file/folder:', error);
    res.status(500).json({ error: 'Failed to create file/folder' });
  }
});

// 删除文件或文件夹
app.delete('/api/files/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(__dirname, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file/folder:', error);
    res.status(500).json({ error: 'Failed to delete file/folder' });
  }
});

// 重命名文件或文件夹
app.patch('/api/files/*', async (req, res) => {
  try {
    const oldFilePath = req.params[0];
    const { newName } = req.body;
    const oldFullPath = path.join(__dirname, oldFilePath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    
    // 安全检查
    if (!oldFullPath.startsWith(path.join(__dirname, 'data')) || 
        !newFullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 同名检查：目标新路径若已存在则返回 409
    const exists = await fs.stat(newFullPath).then(() => true).catch(() => false);
    if (exists) {
      return res.status(409).json({ error: 'Target already exists' });
    }

    await fs.rename(oldFullPath, newFullPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming file/folder:', error);
    res.status(500).json({ error: 'Failed to rename file/folder' });
  }
});

// ========== 工具：管理 data 目录的文件与文件夹 ==========
function isSafeInData(fullPath) {
  const dataRoot = path.join(__dirname, 'data');
  return fullPath.startsWith(dataRoot);
}

function resolveDataPath(relPath = '') {
  const target = path.join(DATA_DIR, relPath || '');
  if (!isSafeInData(target)) {
    throw new Error('Access denied');
  }
  return target;
}

// 恢复文件内容
app.post('/api/files/restore', async (req, res) => {
  try {
    const { path: relPath, content } = req.body || {};
    if (!relPath) return res.status(400).json({ error: 'Missing path' });
    
    const filePath = resolveDataPath(relPath);
    await fs.writeFile(filePath, content || '', 'utf8');
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: String(error?.message || error) });
  }
});

app.post('/api/tools/manage-file', async (req, res) => {
  try {
    const { action, path: relPath, content, new_path, recursive } = req.body || {};
    const changedFiles = [];

    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    if (action === 'list') {
      const listPath = resolveDataPath(relPath || '');
      const stat = await fs.stat(listPath).catch(() => null);
      if (!stat) return res.status(404).json({ error: 'Path not found' });
      if (!stat.isDirectory()) return res.status(400).json({ error: 'Path is not a directory' });
      const items = await fs.readdir(listPath, { withFileTypes: true });
      const payload = items.map(d => ({ name: d.name, type: d.isDirectory() ? 'folder' : 'file' }));
      return res.json({ success: true, data: payload });
    }

    if (action === 'read') {
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const filePath = resolveDataPath(relPath);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) return res.status(404).json({ error: 'File not found' });
      if (!stat.isFile()) return res.status(400).json({ error: 'Path is not a file' });
      const data = await fs.readFile(filePath, 'utf8');
      return res.json({ success: true, data });
    }

    if (action === 'create_dir') {
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const dirPath = resolveDataPath(relPath);
      
      // 检查目录是否已存在
      const stat = await fs.stat(dirPath).catch(() => null);
      if (stat) {
        return res.status(409).json({ error: '目录已存在' });
      }
      
      await fs.mkdir(dirPath, { recursive: true });
      return res.json({ success: true, changedFiles });
    }

    if (action === 'create_file') {
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const filePath = resolveDataPath(relPath);
      
      // 检查文件是否已存在
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat) {
        return res.status(409).json({ error: '文件已存在' });
      }
      
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content ?? '', 'utf8');
      changedFiles.push(`data/${relPath}`);
      return res.json({ success: true, changedFiles });
    }

    if (action === 'update') {
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const filePath = resolveDataPath(relPath);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat || !stat.isFile()) return res.status(404).json({ error: 'File not found' });
      await fs.writeFile(filePath, content ?? '', 'utf8');
      changedFiles.push(`data/${relPath}`);
      return res.json({ success: true, changedFiles });
    }

    if (action === 'rename') {
      if (!relPath || !new_path) return res.status(400).json({ error: 'Missing path or new_path' });
      const oldPath = resolveDataPath(relPath);
      const newPath = resolveDataPath(new_path);
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.rename(oldPath, newPath);
      changedFiles.push(`data/${relPath}`, `data/${new_path}`);
      return res.json({ success: true, changedFiles });
    }

    if (action === 'delete') {
      if (!relPath) return res.status(400).json({ error: 'Missing path' });
      const targetPath = resolveDataPath(relPath);
      const stat = await fs.stat(targetPath).catch(() => null);
      if (!stat) return res.status(404).json({ error: 'Path not found' });
      if (stat.isDirectory()) {
        if (recursive) {
          await fs.rm(targetPath, { recursive: true, force: true });
        } else {
          await fs.rmdir(targetPath);
        }
      } else {
        await fs.unlink(targetPath);
      }
      changedFiles.push(`data/${relPath}`);
      return res.json({ success: true, changedFiles });
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (error) {
    console.error('manage-file error:', error);
    return res.status(500).json({ error: 'Failed to manage file' });
  }
});

// 代理 DeepSeek 流式输出
app.post('/api/chat/stream', async (req, res) => {
  try {
    const {
      messages = [],
      systemPrompt,
      systemPrompts,
      apiKey,
      selectedFile,
      editorContent
    } = req.body || {};

    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }

    const baseUrl = 'https://api.lkeap.cloud.tencent.com/v1';

    // 组装 OpenAI 兼容消息
    const assembled = [];
    if (Array.isArray(systemPrompts) && systemPrompts.length) {
      for (const sp of systemPrompts) {
        if (sp && typeof sp === 'string') assembled.push({ role: 'system', content: sp });
      }
    } else if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
      assembled.push({ role: 'system', content: systemPrompt.trim() });
    }

    // 注入前端上下文（不保存的编辑器内容 & 当前文件）
    if (selectedFile || editorContent) {
      const ctxLines = [];
      if (selectedFile) ctxLines.push(`当前打开文件: ${selectedFile}`);
      if (typeof editorContent === 'string' && editorContent.length) {
        // 截断保护，避免超长
        const maxLen = 8000; // 约 8k 字符
        const content = editorContent.length > maxLen ? editorContent.slice(0, maxLen) + '\n...[截断]' : editorContent;
        ctxLines.push(`编辑器未保存内容:\n${content}`);
      }
      if (ctxLines.length) {
        assembled.push({ role: 'system', content: ctxLines.join('\n') });
      }
    }

    for (const m of messages) {
      if (!m) continue;
      // 兼容前端传入的消息结构
      const role = m.role || m.Role || 'user';
      const content = m.content ?? m.Content ?? '';
      if (content) assembled.push({ role, content });
    }

    const payload = {
      model: 'deepseek-v3.1',
      stream: true,
      messages: assembled,
    };

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return res.status(502).json({ error: 'Upstream error', detail: text });
    }

    // 以 SSE 方式回传
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('chat/stream error:', err);
    res.status(500).json({ error: 'Failed to stream completion' });
  }
});

// 非流式：多Agent/工具循环（最小实现）
app.post('/api/agent/run', async (req, res) => {
  try {
    const { apiKey, messages = [], selectedFile, editorContent, systemPrompts } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Missing API key' });

    const baseUrl = 'https://api.lkeap.cloud.tencent.com/v1';

    // 系统提示：指导模型以 JSON 方式发起工具调用
    const toolSpec = `你可以使用工具 manage_novel_files 来管理 data 目录中的文件和文件夹。调用工具时，使用以下JSON格式：
{
  "tool": "manage_novel_files",
  "args": {
    "action": "create_file|create_dir|list|read|update|rename|delete",
    "path": "相对 data 的路径",
    "content": "可选，文件内容",
    "new_path": "可选，重命名或移动的新路径",
    "recursive": false
  }
}`;

    const contextAddon = [];
    if (selectedFile) contextAddon.push(`当前打开文件: ${selectedFile}`);
    if (typeof editorContent === 'string' && editorContent.length) {
      const maxLen = 8000;
      const content = editorContent.length > maxLen ? editorContent.slice(0, maxLen) + '\n...[截断]' : editorContent;
      contextAddon.push(`编辑器未保存内容:\n${content}`);
    }

    const assembled = [];
    if (Array.isArray(systemPrompts) && systemPrompts.length) {
      for (const sp of systemPrompts) {
        if (typeof sp === 'string' && sp.trim()) assembled.push({ role: 'system', content: sp });
      }
    } else {
      for (const sp of NOVEL_SYSTEM_PROMPTS) {
        assembled.push({ role: 'system', content: sp });
      }
    }
    assembled.push({ role: 'system', content: toolSpec });
    if (contextAddon.length) assembled.push({ role: 'system', content: contextAddon.join('\n') });
    for (const m of messages) {
      const role = m.role || m.Role || 'user';
      const content = m.content ?? m.Content ?? '';
      if (content) assembled.push({ role, content });
    }

    const changedFiles = new Set();
    const modifiedLines = {}; // 存储每个文件的修改行号

    async function callLLM(chatMessages) {
      if (DEBUG_LLM) {
        try {
          console.log('[LLM][agent/run] request', {
            url: `${baseUrl}/chat/completions`,
            model: 'deepseek-v3.1',
            stream: false,
            messagesCount: chatMessages.length,
            lastMessage: chatMessages[chatMessages.length - 1],
          });
        } catch {}
      }
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'deepseek-v3.1', stream: false, messages: validMessages }),
      });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        console.error('[LLM] Request failed:', resp.status, errorText);
        throw new Error(`LLM request failed: ${resp.status} ${errorText}`);
      }
      const data = await resp.json();
      if (DEBUG_LLM) {
        try {
          const preview = JSON.stringify(data).slice(0, 1000);
          console.log('[LLM][agent/run] response ok, preview:', preview);
        } catch {}
      }
      const content = data?.choices?.[0]?.message?.content || '';
      return content;
    }

    function tryParseToolCall(text) {
      // 提取代码块或直接JSON
      const codeMatch = text.match(/```json[\s\S]*?```/i);
      const jsonStr = codeMatch ? codeMatch[0].replace(/```json|```/gi, '').trim() : text.trim();
      try {
        const obj = JSON.parse(jsonStr);
        if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
      } catch { /* ignore */ }
      return null;
    }



    async function runTool(args) {
      const { action, path: relPath, content, new_path, recursive } = args || {};
      if (!action) return { ok: false, message: 'Missing action' };
      // 直接复用与路由相同的逻辑
      try {
        if (action === 'list') {
          const listPath = resolveDataPath(relPath || '');
          const stat = await fs.stat(listPath).catch(() => null);
          if (!stat) return { ok: false, message: 'Path not found' };
          if (!stat.isDirectory()) return { ok: false, message: 'Path is not a directory' };
          const items = await fs.readdir(listPath, { withFileTypes: true });
          const payload = items.map(d => ({ name: d.name, type: d.isDirectory() ? 'folder' : 'file' }));
          return { ok: true, data: payload };
        }
        if (action === 'read') {
          const filePath = resolveDataPath(relPath);
          const data = await fs.readFile(filePath, 'utf8');
          return { ok: true, data };
        }
        if (action === 'create_dir') {
          const dirPath = resolveDataPath(relPath);
          
          // 检查目录是否已存在
          const stat = await fs.stat(dirPath).catch(() => null);
          if (stat) {
            return { ok: false, message: '目录已存在' };
          }
          
          await fs.mkdir(dirPath, { recursive: true });
          return { ok: true };
        }
        if (action === 'create_file') {
          const filePath = resolveDataPath(relPath);
          
          // 检查文件是否已存在
          const stat = await fs.stat(filePath).catch(() => null);
          if (stat) {
            return { ok: false, message: '文件已存在' };
          }
          
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, content ?? '', 'utf8');
          changedFiles.add(`data/${relPath}`);
          return { ok: true };
        }
        if (action === 'update') {
          const filePath = resolveDataPath(relPath);
          
          // 读取旧文件内容来比较行号
          let oldContent = '';
          try {
            oldContent = await fs.readFile(filePath, 'utf8');
          } catch (e) {
            // 文件不存在，所有行都是新增的
          }
          
          await fs.writeFile(filePath, content ?? '', 'utf8');
          changedFiles.add(`data/${relPath}`);
          
          // 检测修改的行号
          const linesModified = detectModifiedLines(oldContent, content ?? '');
          if (linesModified.length > 0) {
            modifiedLines[`data/${relPath}`] = linesModified;
            // 收集修改前后的内容
            diffData[`data/${relPath}`] = {
              oldContent: oldContent,
              newContent: content ?? ''
            };
          }
          // 返回修改前后的内容用于对比
          return { 
            ok: true, 
            modifiedLines: linesModified,
            oldContent: oldContent,
            newContent: content ?? ''
          };
        }
        if (action === 'rename') {
          const oldPath = resolveDataPath(relPath);
          const newPath = resolveDataPath(new_path);
          await fs.mkdir(path.dirname(newPath), { recursive: true });
          await fs.rename(oldPath, newPath);
          changedFiles.add(`data/${relPath}`);
          changedFiles.add(`data/${new_path}`);
          return { ok: true };
        }
        if (action === 'delete') {
          const targetPath = resolveDataPath(relPath);
          const stat = await fs.stat(targetPath).catch(() => null);
          if (!stat) return { ok: false, message: 'Path not found' };
          if (stat.isDirectory()) {
            if (recursive) await fs.rm(targetPath, { recursive: true, force: true });
            else await fs.rmdir(targetPath);
          } else {
            await fs.unlink(targetPath);
          }
          changedFiles.add(`data/${relPath}`);
          return { ok: true };
        }
        return { ok: false, message: 'Unsupported action' };
      } catch (e) {
        return { ok: false, message: String(e?.message || e) };
      }
    }

    const loopMessages = [...assembled];
    for (let i = 0; i < 4; i++) {
      const out = await callLLM(loopMessages);
      const toolArgs = tryParseToolCall(out);
      if (!toolArgs) {
        // 最终回答
        return res.json({ success: true, content: out, changedFiles: Array.from(changedFiles) });
      }
      const toolResult = await runTool(toolArgs);
      loopMessages.push({ role: 'assistant', content: out });
      
      // 优化工具结果长度，避免过长导致LLM请求失败
      let toolResultContent = JSON.stringify(toolResult);
      if (toolResultContent.length > 500) {
        // 如果工具结果过长，只保留关键信息
        const summary = {
          ok: toolResult.ok,
          message: toolResult.message || '操作完成'
        };
        if (toolResult.data) {
          if (Array.isArray(toolResult.data)) {
            summary.dataCount = toolResult.data.length;
            summary.dataSample = toolResult.data.slice(0, 2); // 只保留前2个
          } else {
            summary.dataLength = toolResult.data.length;
            summary.dataPreview = toolResult.data.substring(0, 100) + '...';
          }
        }
        toolResultContent = JSON.stringify(summary);
      }
      
      if (DEBUG_LLM) {
        try {
          console.log('[LLM] Tool result length:', toolResultContent.length);
        } catch {}
      }
      
      loopMessages.push({ role: 'assistant', content: `工具执行结果：${toolResultContent}` });
      
      // 根据工具执行结果决定下一步
      if (toolResult?.ok) {
        // 工具执行成功，引导模型生成最终回答
        loopMessages.push({ 
          role: 'system', 
          content: '工具执行成功。你可以继续调用工具或者用 <user> 标记包裹中文回答。' 
        });
      } else {
        // 工具执行失败，引导模型说明原因
        loopMessages.push({ 
          role: 'system', 
          content: '工具执行失败。请尝试重新调用，或用 <user> 标记包裹中文回答。' 
        });
      }
    }

    // 超过循环上限，返回最后结果
    const finalOut = await callLLM(loopMessages);
    return res.json({ success: true, content: finalOut, changedFiles: Array.from(changedFiles) });
  } catch (err) {
    console.error('/api/agent/run error:', err);
    return res.status(500).json({ error: 'Agent run failed' });
  }
});

// 多Agent流式：先执行工具循环，最终回答使用流式输出，同时在末尾附加 changedFiles 事件
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { apiKey, messages = [], selectedFile, editorContent, systemPrompts } = req.body || {};
    if (!apiKey) return res.status(400).json({ error: 'Missing API key' });

    const baseUrl = 'https://api.lkeap.cloud.tencent.com/v1';

    // 确保尽早设置 SSE 头，以便在工具阶段即可推送事件
    let sseHeadersSent = false;
    function ensureSSEHeaders() {
      if (sseHeadersSent) return;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      sseHeadersSent = true;
    }

    const toolSpec = `你可以使用工具 manage_novel_files 来管理 data 目录中的文件和文件夹。调用工具时，使用以下JSON格式：
{
  "tool": "manage_novel_files",
  "args": {
    "action": "create_file|create_dir|list|read|update|rename|delete",
    "path": "相对 data 的路径",
    "content": "可选，文件内容",
    "new_path": "可选，重命名或移动的新路径",
    "recursive": false
  }
}`;

    const contextAddon = [];
    if (selectedFile) contextAddon.push(`当前打开文件: ${selectedFile}`);
    if (typeof editorContent === 'string' && editorContent.length) {
      const maxLen = 8000;
      const content = editorContent.length > maxLen ? editorContent.slice(0, maxLen) + '\n...[截断]' : editorContent;
      contextAddon.push(`编辑器未保存内容:\n${content}`);
    }

    const assembled = [];
    if (Array.isArray(systemPrompts) && systemPrompts.length) {
      for (const sp of systemPrompts) {
        if (typeof sp === 'string' && sp.trim()) assembled.push({ role: 'system', content: sp });
      }
    } else {
      for (const sp of NOVEL_SYSTEM_PROMPTS) {
        assembled.push({ role: 'system', content: sp });
      }
    }
    assembled.push({ role: 'system', content: toolSpec });
    if (contextAddon.length) assembled.push({ role: 'system', content: contextAddon.join('\n') });
    for (const m of messages) {
      const role = m.role || m.Role || 'user';
      const content = m.content ?? m.Content ?? '';
      if (content) assembled.push({ role, content });
    }

    const changedFiles = new Set();
    const modifiedLines = {}; // 存储每个文件的修改行号
    const diffData = {}; // 存储每个文件的修改前后内容

    async function callLLM(chatMessages) {
      // 验证并清理消息格式
      const validMessages = chatMessages.filter(m => 
        m && 
        typeof m === 'object' && 
        m.role && 
        typeof m.role === 'string' && 
        m.content !== undefined && 
        typeof m.content === 'string'
      ).map(m => ({
        role: m.role.trim(),
        content: m.content.trim().substring(0, 8000) // 限制单条消息长度
      }));
      
      if (validMessages.length !== chatMessages.length) {
        console.warn('[LLM] Filtered invalid messages:', chatMessages.length - validMessages.length);
      }
      
      if (DEBUG_LLM) {
        try {
          console.log('[LLM][agent/stream] request', {
            url: `${baseUrl}/chat/completions`,
            model: 'deepseek-v3.1',
            stream: false,
            messagesCount: validMessages.length,
            lastMessage: validMessages[validMessages.length - 1],
            apiKeyLength: apiKey ? apiKey.length : 0,
            totalTokens: validMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)
          });
        } catch {}
      }
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'deepseek-v3.1', stream: false, messages: validMessages }),
      });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        console.error('[LLM] Request failed:', resp.status, errorText);
        throw new Error(`LLM request failed: ${resp.status} ${errorText}`);
      }
      const data = await resp.json();
      if (DEBUG_LLM) {
        try {
          const preview = JSON.stringify(data).slice(0, 1000);
          console.log('[LLM][agent/stream] response ok, preview:', preview);
        } catch {}
      }
      const content = data?.choices?.[0]?.message?.content || '';
      return content;
    }

    function tryParseToolCall(text) {
      // 首先尝试从 <tool> 标记中提取JSON
      const toolMatch = text.match(/<tool>([\s\S]*?)<\/tool>/i);
      if (toolMatch) {
        const jsonStr = toolMatch[1].trim();
        try {
          const obj = JSON.parse(jsonStr);
          if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
        } catch { /* ignore */ }
      }
      
      // 然后尝试从代码块中提取JSON
      const codeMatch = text.match(/```json[\s\S]*?```/i);
      if (codeMatch) {
        const jsonStr = codeMatch[0].replace(/```json|```/gi, '').trim();
        try {
          const obj = JSON.parse(jsonStr);
          if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
        } catch { /* ignore */ }
      }
      
      // 尝试查找文本中的JSON对象（支持嵌套结构）
      const jsonPatterns = [
        // 匹配完整的JSON对象，支持嵌套
        /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*"tool"[^{}]*(?:\{[^{}]*\}[^{}]*)*"manage_novel_files"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/i,
        // 匹配简单的JSON对象
        /\{[^{}]*"tool"[^{}]*"manage_novel_files"[^{}]*\}/i
      ];
      
      for (const pattern of jsonPatterns) {
        const jsonMatch = text.match(pattern);
        if (jsonMatch) {
          try {
            const obj = JSON.parse(jsonMatch[0]);
            if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
          } catch { /* ignore */ }
        }
      }
      
      // 如果没有代码块，检查是否整个文本都是JSON
      const trimmedText = text.trim();
      if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
        try {
          const obj = JSON.parse(trimmedText);
          if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
        } catch { /* ignore */ }
      }
      
      // 尝试提取所有可能的JSON片段
      const jsonFragments = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
      for (const fragment of jsonFragments) {
        try {
          const obj = JSON.parse(fragment);
          if (obj && obj.tool === 'manage_novel_files' && obj.args) return obj.args;
        } catch { /* ignore */ }
      }
      
      return null;
    }

    function extractUserContent(text) {
      // 提取 <user> 标记中的内容
      const userMatch = text.match(/<user>([\s\S]*?)<\/user>/i);
      if (userMatch) {
        return userMatch[1].trim();
      }
      
      // 如果没有 <user> 标记，检查是否包含 <tool> 标记
      // 如果包含 <tool> 标记但没有 <user> 标记，返回空字符串
      if (text.includes('<tool>')) {
        return '';
      }
      
      // 如果既没有 <user> 也没有 <tool> 标记，返回原文本
      return text;
    }

    async function runTool(args) {
      const { action, path: relPath, content, new_path, recursive } = args || {};
      if (!action) return { ok: false, message: 'Missing action' };
      try {
        if (action === 'list') {
          const listPath = resolveDataPath(relPath || '');
          const stat = await fs.stat(listPath).catch(() => null);
          if (!stat) return { ok: false, message: 'Path not found' };
          if (!stat.isDirectory()) return { ok: false, message: 'Path is not a directory' };
          const items = await fs.readdir(listPath, { withFileTypes: true });
          const payload = items.map(d => ({ name: d.name, type: d.isDirectory() ? 'folder' : 'file' }));
          return { ok: true, data: payload };
        }
        if (action === 'read') {
          const filePath = resolveDataPath(relPath);
          const data = await fs.readFile(filePath, 'utf8');
          return { ok: true, data };
        }
        if (action === 'create_dir') {
          const dirPath = resolveDataPath(relPath);
          
          // 检查目录是否已存在
          const stat = await fs.stat(dirPath).catch(() => null);
          if (stat) {
            return { ok: false, message: '目录已存在' };
          }
          
          await fs.mkdir(dirPath, { recursive: true });
          return { ok: true };
        }
        if (action === 'create_file') {
          const filePath = resolveDataPath(relPath);
          
          // 检查文件是否已存在
          const stat = await fs.stat(filePath).catch(() => null);
          if (stat) {
            return { ok: false, message: '文件已存在' };
          }
          
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, content ?? '', 'utf8');
          changedFiles.add(`data/${relPath}`);
          return { ok: true };
        }
        if (action === 'update') {
          const filePath = resolveDataPath(relPath);
          
          // 读取旧文件内容来比较行号
          let oldContent = '';
          try {
            oldContent = await fs.readFile(filePath, 'utf8');
          } catch (e) {
            // 文件不存在，所有行都是新增的
          }
          
          await fs.writeFile(filePath, content ?? '', 'utf8');
          changedFiles.add(`data/${relPath}`);
          
          // 检测修改的行号
          const linesModified = detectModifiedLines(oldContent, content ?? '');
          if (linesModified.length > 0) {
            modifiedLines[`data/${relPath}`] = linesModified;
            // 收集修改前后的内容
            diffData[`data/${relPath}`] = {
              oldContent: oldContent,
              newContent: content ?? ''
            };
          }
          // 返回修改前后的内容用于对比
          return { 
            ok: true, 
            modifiedLines: linesModified,
            oldContent: oldContent,
            newContent: content ?? ''
          };
        }
        if (action === 'rename') {
          const oldPath = resolveDataPath(relPath);
          const newPath = resolveDataPath(new_path);
          await fs.mkdir(path.dirname(newPath), { recursive: true });
          await fs.rename(oldPath, newPath);
          changedFiles.add(`data/${relPath}`);
          changedFiles.add(`data/${new_path}`);
          return { ok: true };
        }
        if (action === 'delete') {
          const targetPath = resolveDataPath(relPath);
          const stat = await fs.stat(targetPath).catch(() => null);
          if (!stat) return { ok: false, message: 'Path not found' };
          if (stat.isDirectory()) {
            if (recursive) await fs.rm(targetPath, { recursive: true, force: true });
            else await fs.rmdir(targetPath);
          } else {
            await fs.unlink(targetPath);
          }
          changedFiles.add(`data/${relPath}`);
          return { ok: true };
        }
        return { ok: false, message: 'Unsupported action' };
      } catch (e) {
        return { ok: false, message: String(e?.message || e) };
      }
    }

    // 工具循环（非流式，用于决策+执行）
    const loopMessages = [...assembled];
    for (let i = 0; i < 6; i++) {
      // 限制消息长度，避免上下文过长
      if (loopMessages.length > 20) {
        // 保留系统消息和最近的对话
        const systemMessages = loopMessages.filter(m => m.role === 'system');
        const recentMessages = loopMessages.slice(-10);
        loopMessages.length = 0;
        loopMessages.push(...systemMessages, ...recentMessages);
      }
      const out = await callLLM(loopMessages);
      const toolArgs = tryParseToolCall(out);
      if (!toolArgs) {
        // 进入流式最终回答
        ensureSSEHeaders();

        if (DEBUG_LLM) {
          try {
            console.log('[LLM][agent/stream] start final streaming');
          } catch {}
        }
        const upstream = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ model: 'deepseek-v3.1', stream: true, messages: loopMessages }),
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => '');
          res.write(`data: ${JSON.stringify({ error: 'Upstream error', detail: text })}\n\n`);
        } else {
        const decoder = new TextDecoder();
        let streamedText = '';
        let userContentBuffer = '';
        let inUserTag = false;
        let inToolTag = false;
        
        for await (const chunk of upstream.body) {
          const part = decoder.decode(chunk);
          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            if (!line) continue;
            if (line.trim() === 'data: [DONE]') continue; // 延后发送 DONE
            
            // 检查是否包含工具调用的JSON内容
            if (line.startsWith('data:')) {
              try {
                const dataStr = line.slice(5).trim();
                const obj = JSON.parse(dataStr);
                const delta = obj?.choices?.[0]?.delta?.content
                  ?? obj?.Choices?.[0]?.Delta?.Content
                  ?? '';
                
                if (delta) {
                  // 检测 <tool> 和 <user> 标记的开始和结束（使用更精确的匹配）
                  // 处理可能被分割的标签
                  let remainingDelta = delta;
                  
                  // 检查是否有标签结束标记
                  if (inToolTag && remainingDelta.includes('</tool>')) {
                    const endIndex = remainingDelta.indexOf('</tool>') + '</tool>'.length;
                    remainingDelta = remainingDelta.slice(endIndex);
                    inToolTag = false;
                  }
                  if (inUserTag && remainingDelta.includes('</user>')) {
                    const endIndex = remainingDelta.indexOf('</user>') + '</user>'.length;
                    // 发送用户内容
                    const userContent = remainingDelta.slice(0, endIndex - '</user>'.length);
                    userContentBuffer += userContent;
                    if (userContentBuffer.trim()) {
                      res.write(`data: ${JSON.stringify({ content: userContentBuffer.trim() })}\n\n`);
                      userContentBuffer = '';
                    }
                    remainingDelta = remainingDelta.slice(endIndex);
                    inUserTag = false;
                  }
                  
                  // 检查是否有标签开始标记
                  if (remainingDelta.includes('<tool>') && !remainingDelta.includes('</tool>')) {
                    inToolTag = true;
                    continue;
                  }
                  if (remainingDelta.includes('</tool>')) {
                    inToolTag = false;
                    continue;
                  }
                  if (remainingDelta.includes('<user>') && !remainingDelta.includes('</user>')) {
                    inUserTag = true;
                    continue;
                  }
                  if (remainingDelta.includes('</user>')) {
                    inUserTag = false;
                    // 发送用户内容
                    if (userContentBuffer.trim()) {
                      res.write(`data: ${JSON.stringify({ content: userContentBuffer.trim() })}\n\n`);
                      userContentBuffer = '';
                    }
                    continue;
                  }
                  
                  // 如果在工具标记内，跳过
                  if (inToolTag) {
                    continue;
                  }
                  
                  // 如果在用户标记内，累积内容
                  if (inUserTag) {
                    userContentBuffer += delta;
                    continue;
                  }
                  
                  // 如果内容包含工具调用标记或系统提示词，跳过这一行
                  if (delta.includes('"tool"') ||
                      delta.includes('"args"') ||
                      delta.includes('"action"') ||
                      delta.includes('"path"') ||
                      delta.includes('"content"') ||
                      delta.includes('"new_path"') ||
                      delta.includes('"recursive"') ||
                      delta.includes('manage_novel_files') ||
                      delta.includes('（系统提示') ||
                      delta.includes('系统显示') ||
                      delta.includes('尊敬的作者') ||
                      delta.includes('责任编辑')) {
                    continue;
                  }
                  
                  streamedText += delta;
                }
              } catch {}
            }
            
            res.write(line + '\n');
          }
        }
          if (DEBUG_LLM) {
            try {
              console.log('[LLM][agent/stream] final streamed preview:', (streamedText || '').slice(0, 1000));
            } catch {}
          }
        }

        // 附带文件变更
        res.write(`data: ${JSON.stringify({ changedFiles: Array.from(changedFiles), modifiedLines, diffData })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      // 推送工具开始事件
      try {
        ensureSSEHeaders();
        res.write(`data: ${JSON.stringify({ toolEvent: { tool: 'manage_novel_files', action: toolArgs.action, path: toolArgs.path || toolArgs.relPath, status: 'start' } })}\n\n`);
      } catch {}

      const toolResult = await runTool(toolArgs);

      // 推送工具完成事件
      try {
        const status = toolResult?.ok ? 'success' : 'error';
        const message = toolResult?.message;
        res.write(`data: ${JSON.stringify({ toolEvent: { tool: 'manage_novel_files', action: toolArgs.action, path: toolArgs.path || toolArgs.relPath, status, message } })}\n\n`);
      } catch {}
      loopMessages.push({ role: 'assistant', content: out });
      
      // 优化工具结果长度，避免过长导致LLM请求失败
      let toolResultContent = JSON.stringify(toolResult);
      if (toolResultContent.length > 500) {
        // 如果工具结果过长，只保留关键信息
        const summary = {
          ok: toolResult.ok,
          message: toolResult.message || '操作完成'
        };
        if (toolResult.data) {
          if (Array.isArray(toolResult.data)) {
            summary.dataCount = toolResult.data.length;
            summary.dataSample = toolResult.data.slice(0, 2); // 只保留前2个
          } else {
            summary.dataLength = toolResult.data.length;
            summary.dataPreview = toolResult.data.substring(0, 100) + '...';
          }
        }
        toolResultContent = JSON.stringify(summary);
      }
      
      if (DEBUG_LLM) {
        try {
          console.log('[LLM] Tool result length:', toolResultContent.length);
        } catch {}
      }
      
      loopMessages.push({ role: 'assistant', content: `工具执行结果：${toolResultContent}` });
      
      // 根据工具执行结果决定下一步
      if (toolResult?.ok) {
        // 工具执行成功，引导模型生成最终回答
        loopMessages.push({ 
          role: 'system', 
          content: '工具执行成功。你可以继续调用工具或者用 <user> 标记包裹简洁的中文回答用户。' 
        });
      } else {
        // 工具执行失败，引导模型说明原因
        loopMessages.push({ 
          role: 'system', 
          content: '工具执行失败。请尝试重新调用，或用 <user> 标记包裹中文回答。' 
        });
      }
    }

    // 超过循环上限，仍然流式最终回答
    ensureSSEHeaders();
    if (DEBUG_LLM) {
      try {
        console.log('[LLM][agent/stream] start final streaming (exceeded loops)');
      } catch {}
    }
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ model: 'deepseek-v3.1', stream: true, messages: loopMessages }),
    });
    if (upstream.ok && upstream.body) {
      const decoder = new TextDecoder();
      let streamedText = '';
      let userContentBuffer = '';
      let inUserTag = false;
      let inToolTag = false;
      
      for await (const chunk of upstream.body) {
        const part = decoder.decode(chunk);
        const lines = part.split(/\r?\n/);
        for (const line of lines) {
          if (!line) continue;
          if (line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data:')) {
            try {
              const dataStr = line.slice(5).trim();
              const obj = JSON.parse(dataStr);
              const delta = obj?.choices?.[0]?.delta?.content
                ?? obj?.Choices?.[0]?.Delta?.Content
                ?? '';
              
              if (delta) {
                // 检测 <tool> 和 <user> 标记的开始和结束（使用更精确的匹配）
                // 处理可能被分割的标签 - 使用累积缓冲区来处理分割的标签
                const combinedDelta = (inToolTag || inUserTag ? '' : '') + delta;
                
                // 检查是否有标签结束标记
                if (inToolTag && combinedDelta.includes('</tool>')) {
                  const endIndex = combinedDelta.indexOf('</tool>') + '</tool>'.length;
                  const remaining = combinedDelta.slice(endIndex);
                  // 处理剩余内容中的开始标记
                  if (remaining.includes('<tool>') && !remaining.includes('</tool>')) {
                    inToolTag = true;
                  } else {
                    inToolTag = false;
                  }
                  continue;
                }
                if (inUserTag && combinedDelta.includes('</user>')) {
                  const endIndex = combinedDelta.indexOf('</user>') + '</user>'.length;
                  // 发送用户内容
                  const userContent = combinedDelta.slice(0, endIndex - '</user>'.length);
                  userContentBuffer += userContent;
                  if (userContentBuffer.trim()) {
                    res.write(`data: ${JSON.stringify({ content: userContentBuffer.trim() })}\n\n`);
                    userContentBuffer = '';
                  }
                  const remaining = combinedDelta.slice(endIndex);
                  // 处理剩余内容中的开始标记
                  if (remaining.includes('<user>') && !remaining.includes('</user>')) {
                    inUserTag = true;
                  } else {
                    inUserTag = false;
                  }
                  continue;
                }
                
                // 智能标签检测：当检测到 < 字符时，检查是否是完整标签
                let processedDelta = combinedDelta;
                
                // 检查是否有潜在的标签开始
                if (processedDelta.includes('<') && !inToolTag && !inUserTag) {
                  const ltIndex = processedDelta.indexOf('<');
                  // 检查是否是完整的标签开始
                  if (ltIndex >= 0 && ltIndex + 5 <= processedDelta.length) {
                    const potentialTag = processedDelta.slice(ltIndex, ltIndex + 5);
                    if (potentialTag === '<tool') {
                      // 等待更多字符来确定是否是完整的 <tool>
                      if (ltIndex + 6 <= processedDelta.length && processedDelta[ltIndex + 5] === '>') {
                        inToolTag = true;
                        processedDelta = processedDelta.slice(ltIndex + 6);
                      }
                      // 否则保持原样，等待后续数据
                    } else if (potentialTag === '<user') {
                      // 等待更多字符来确定是否是完整的 <user>
                      if (ltIndex + 6 <= processedDelta.length && processedDelta[ltIndex + 5] === '>') {
                        inUserTag = true;
                        processedDelta = processedDelta.slice(ltIndex + 6);
                      }
                      // 否则保持原样，等待后续数据
                    }
                  }
                }
                
                // 检查是否有完整的标签开始标记
                if (processedDelta.includes('<tool>') && !processedDelta.includes('</tool>')) {
                  inToolTag = true;
                  continue;
                }
                if (processedDelta.includes('</tool>')) {
                  inToolTag = false;
                  continue;
                }
                if (processedDelta.includes('<user>') && !processedDelta.includes('</user>')) {
                  inUserTag = true;
                  continue;
                }
                if (processedDelta.includes('</user>')) {
                  inUserTag = false;
                  // 发送用户内容
                  if (userContentBuffer.trim()) {
                    res.write(`data: ${JSON.stringify({ content: userContentBuffer.trim() })}\n\n`);
                    userContentBuffer = '';
                  }
                  continue;
                }
                
                // 如果在工具标记内，跳过
                if (inToolTag) {
                  continue;
                }
                
                // 如果在用户标记内，累积内容
                if (inUserTag) {
                  userContentBuffer += delta;
                  continue;
                }
                
                // 如果内容包含工具调用标记或系统提示词，跳过这一行
                if (delta.includes('"tool"') ||
                    delta.includes('"args"') ||
                    delta.includes('"action"') ||
                    delta.includes('"path"') ||
                    delta.includes('"content"') ||
                    delta.includes('"new_path"') ||
                    delta.includes('"recursive"') ||
                    delta.includes('manage_novel_files') ||
                    delta.includes('（系统提示') ||
                    delta.includes('系统显示') ||
                    delta.includes('尊敬的作者') ||
                    delta.includes('责任编辑')) {
                  continue;
                }
                
                streamedText += delta;
              }
            } catch {}
          }
          res.write(line + '\n');
        }
      }
      if (DEBUG_LLM) {
        try {
          console.log('[LLM][agent/stream] final streamed preview (exceeded loops):', (streamedText || '').slice(0, 1000));
        } catch {}
      }
    }
    res.write(`data: ${JSON.stringify({ changedFiles: Array.from(changedFiles), modifiedLines, diffData })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err) {
    try {
      console.error('/api/agent/stream error:', err);
      // 若已开始以 SSE 输出，则通过 SSE 报错并结束
      if (typeof sseHeadersSent !== 'undefined' && sseHeadersSent) {
        try { res.write(`data: ${JSON.stringify({ error: 'Agent stream failed', detail: String(err?.message || err) })}\n\n`); } catch {}
        try { res.write('data: [DONE]\n\n'); } catch {}
        try { return res.end(); } catch {}
      }
      // 尚未发送任何头部，正常返回 500 JSON
      return res.status(500).json({ error: 'Agent stream failed', detail: String(err?.message || err) });
    } catch (e) {
      // 最后兜底：避免再次抛错
      try { return res.end(); } catch {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
