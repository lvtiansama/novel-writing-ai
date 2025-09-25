import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { MAIN_AGENT_PROMPT, SUB_AGENTS } from './prompts/novel_prompts.js';

// 检测文件修改的行号
function detectModifiedLines(oldContent, newContent) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const modifiedLines = [];
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    
    if (oldLine !== newLine) {
      modifiedLines.push(i + 1);
    }
  }
  
  return modifiedLines;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DEBUG_LLM = process.env.DEBUG_LLM === '0' ? false : true;

// 测试API Key映射字典
const TEST_API_KEY_MAP = {
  'test': 'sk-CSu4gDI9BCPoNoR8oJRntILRt0FZVWaAIwybFoVMNvoWNOMh'
};

// API Key解析函数
function resolveApiKey(inputKey) {
  if (!inputKey) return null;
  
  // 检查是否为测试key
  if (TEST_API_KEY_MAP[inputKey]) {
    console.log(`[API KEY] 使用测试key映射: ${inputKey} -> ${TEST_API_KEY_MAP[inputKey].substring(0, 20)}...`);
    return TEST_API_KEY_MAP[inputKey];
  }
  
  return inputKey;
}

app.use(cors());
app.use(express.json());

// 安全检查函数
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

// 工具执行函数
async function runTool(args, changedFiles, modifiedLines, diffData) {
  const { action, path: relPath, content, new_path, recursive, line_number, line_content } = args || {};
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
    
    if (action === 'read_line') {
      const filePath = resolveDataPath(relPath);
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.split('\n');
      const lineNum = parseInt(line_number);
      
      if (isNaN(lineNum) || lineNum < 1 || lineNum > lines.length) {
        return { ok: false, message: `Invalid line number. File has ${lines.length} lines.` };
      }
      
      const lineContent = lines[lineNum - 1];
      return { 
        ok: true, 
        data: lineContent,
        line_number: lineNum,
        total_lines: lines.length
      };
    }
    
    if (action === 'edit_line') {
      const filePath = resolveDataPath(relPath);
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.split('\n');
      const lineNum = parseInt(line_number);
      
      if (isNaN(lineNum) || lineNum < 1 || lineNum > lines.length) {
        return { ok: false, message: `Invalid line number. File has ${lines.length} lines.` };
      }
      
      // 保存旧内容用于差异检测
      const oldContent = data;
      
      // 修改指定行
      lines[lineNum - 1] = line_content || '';
      const newContent = lines.join('\n');
      
      await fs.writeFile(filePath, newContent, 'utf8');
      changedFiles.add(`data/${relPath}`);
      
      // 检测修改的行号
      const linesModified = detectModifiedLines(oldContent, newContent);
      if (linesModified.length > 0) {
        modifiedLines[`data/${relPath}`] = linesModified;
        diffData[`data/${relPath}`] = {
          oldContent: oldContent,
          newContent: newContent
        };
      }
      
      return { 
        ok: true, 
        modifiedLines: linesModified,
        oldContent: oldContent,
        newContent: newContent,
        line_number: lineNum,
        old_line_content: oldContent.split('\n')[lineNum - 1],
        new_line_content: line_content || ''
      };
    }
    
    if (action === 'create_dir') {
      const dirPath = resolveDataPath(relPath);
      const stat = await fs.stat(dirPath).catch(() => null);
      if (stat) {
        return { ok: false, message: '目录已存在' };
      }
      await fs.mkdir(dirPath, { recursive: true });
      return { ok: true };
    }
    
    if (action === 'create_file') {
      const filePath = resolveDataPath(relPath);
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
      let oldContent = '';
      try {
        oldContent = await fs.readFile(filePath, 'utf8');
      } catch (e) {
        // 文件不存在
      }
      
      await fs.writeFile(filePath, content ?? '', 'utf8');
      changedFiles.add(`data/${relPath}`);
      
      const linesModified = detectModifiedLines(oldContent, content ?? '');
      if (linesModified.length > 0) {
        modifiedLines[`data/${relPath}`] = linesModified;
        diffData[`data/${relPath}`] = {
          oldContent: oldContent,
          newContent: content ?? ''
        };
      }
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

// LLM调用函数
async function callLLM(apiKey, messages, baseUrl = 'https://api.lkeap.cloud.tencent.com/v1') {
  const validMessages = messages.filter(m => 
    m && 
    typeof m === 'object' && 
    m.role && 
    typeof m.role === 'string' && 
    m.content !== undefined && 
    typeof m.content === 'string'
  ).map(m => ({
    role: m.role.trim(),
    content: m.content.trim().substring(0, 8000)
  }));
  
  if (DEBUG_LLM) {
    console.log('[LLM] 请求信息:', {
      messagesCount: validMessages.length,
      lastMessagePreview: validMessages[validMessages.length - 1]?.content?.substring(0, 100) + '...'
    });
  }
  
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ 
      model: 'deepseek-v3.1', 
      stream: false, 
      messages: validMessages 
    }),
  });
  
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => '');
    console.error('[LLM] 请求失败:', resp.status, errorText);
    throw new Error(`LLM request failed: ${resp.status} ${errorText}`);
  }
  
  const data = await resp.json();
  if (DEBUG_LLM) {
    console.log('[LLM] 响应成功，内容长度:', data?.choices?.[0]?.message?.content?.length || 0);
  }
  
  return data?.choices?.[0]?.message?.content || '';
}

// 解析多种操作指令（改进版）
function parseCommands(text) {
  const commands = {
    agentCalls: [],
    toolCalls: [],
    userContent: null
  };
  
  // 使用更精确的正则匹配，避免JSON内容干扰
  
  // 匹配 [CALL_AGENT]JSON 格式 - 使用更精确的匹配
  const agentMatches = text.matchAll(/\[CALL_AGENT\]\s*({[\s\S]*?})(?=\s*(?:\[|$))/gi);
  for (const match of agentMatches) {
    try {
      const agentData = JSON.parse(match[1]);
      if (agentData.agent && SUB_AGENTS[agentData.agent]) {
        commands.agentCalls.push(agentData);
      }
    } catch (e) {
      console.error('[AGENT CALL] 解析失败:', e.message, '内容:', match[1]);
    }
  }
  
  // 匹配 [CALL_TOOL]JSON 格式 - 使用更精确的匹配
  const toolMatches = text.matchAll(/\[CALL_TOOL\]\s*({[\s\S]*?})(?=\s*(?:\[|$))/gi);
  for (const match of toolMatches) {
    try {
      const toolData = JSON.parse(match[1]);
      if (toolData.tool === 'manage_novel_files' && toolData.args) {
        commands.toolCalls.push(toolData.args);
      }
    } catch (e) {
      console.error('[TOOL CALL] 解析失败:', e.message, '内容:', match[1]);
    }
  }
  
  // 匹配 [TO_USER] 格式 - 提取到字符串末尾或下一个标识
  const userMatch = text.match(/\[TO_USER\]([\s\S]*?)(?=\[CALL_|$)/i);
  if (userMatch) {
    commands.userContent = userMatch[1].trim();
  }
  
  // 兼容旧格式
  if (commands.agentCalls.length === 0) {
    const oldAgentMatch = text.match(/<agent_call>([\s\S]*?)<\/agent_call>/i);
    if (oldAgentMatch) {
      try {
        const agentData = JSON.parse(oldAgentMatch[1].trim());
        if (agentData.agent && SUB_AGENTS[agentData.agent]) {
          commands.agentCalls.push(agentData);
        }
      } catch (e) {
        console.error('[AGENT CALL] 旧格式解析失败:', e.message);
      }
    }
  }
  
  if (commands.toolCalls.length === 0) {
    const oldToolMatch = text.match(/<tool>([\s\S]*?)<\/tool>/i);
    if (oldToolMatch) {
      try {
        const toolData = JSON.parse(oldToolMatch[1].trim());
        if (toolData.tool === 'manage_novel_files' && toolData.args) {
          commands.toolCalls.push(toolData.args);
        }
      } catch (e) {
        console.error('[TOOL CALL] 旧格式解析失败:', e.message);
      }
    }
  }
  
  if (!commands.userContent) {
    const oldUserMatch = text.match(/<user>([\s\S]*?)<\/user>/i);
    if (oldUserMatch) {
      commands.userContent = oldUserMatch[1].trim();
    }
  }
  
  return commands;
}

// 为了保持向后兼容，保留原函数但使用新的解析逻辑
function parseAgentCall(text) {
  const commands = parseCommands(text);
  return commands.agentCalls.length > 0 ? commands.agentCalls[0] : null;
}

function parseToolCall(text) {
  const commands = parseCommands(text);
  return commands.toolCalls.length > 0 ? commands.toolCalls[0] : null;
}

function extractUserContent(text) {
  const commands = parseCommands(text);
  if (commands.userContent) {
    return commands.userContent;
  }
  
  // 如果没有特殊标记，检查是否包含调用标记
  if (text.includes('[CALL_AGENT]') || text.includes('[CALL_TOOL]') || 
      text.includes('<agent_call>') || text.includes('<tool>')) {
    return '';
  }
  
  return text;
}

// 多Agent流式API
app.post('/api/agent/stream', async (req, res) => {
  try {
    const { apiKey: inputApiKey, messages = [], selectedFile, editorContent } = req.body || {};
    if (!inputApiKey) return res.status(400).json({ error: 'Missing API key' });
    
    const apiKey = resolveApiKey(inputApiKey);

    const baseUrl = 'https://api.lkeap.cloud.tencent.com/v1';

    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const contextAddon = [];
    if (selectedFile) contextAddon.push(`当前打开文件: ${selectedFile}`);
    if (typeof editorContent === 'string' && editorContent.length) {
      const maxLen = 8000;
      const content = editorContent.length > maxLen ? editorContent.slice(0, maxLen) + '\n...[截断]' : editorContent;
      contextAddon.push(`编辑器未保存内容:\n${content}`);
    }

    const changedFiles = new Set();
    const modifiedLines = {};
    const diffData = {};

    // 创建主agent的上下文
    const mainAgentMessages = [];
    mainAgentMessages.push({ role: 'system', content: MAIN_AGENT_PROMPT });
    if (contextAddon.length) mainAgentMessages.push({ role: 'system', content: contextAddon.join('\n') });
    
    // 添加对话历史
    for (const m of messages) {
      const role = m.role || m.Role || 'user';
      const content = m.content ?? m.Content ?? '';
      if (content) mainAgentMessages.push({ role, content });
    }

    console.log(`[主AGENT] 开始处理用户请求: ${messages[messages.length - 1]?.content || ''}`);

    // 主Agent和子Agent交互循环
    for (let i = 0; i < 8; i++) {
      console.log(`[主AGENT] 第${i + 1}轮处理`);
      
      // 调用主Agent
      const mainAgentResponse = await callLLM(apiKey, mainAgentMessages, baseUrl);
      console.log(`[主AGENT] 响应: ${mainAgentResponse.substring(0, 200)}...`);
      
      // 检查是否调用子Agent
      const agentCall = parseAgentCall(mainAgentResponse);
      if (agentCall) {
        console.log(`[主AGENT] 调用子Agent: ${agentCall.agent}`);
        
        // 推送子Agent开始事件
        res.write(`data: ${JSON.stringify({ 
          agentEvent: { 
            agent: agentCall.agent,
            agentName: SUB_AGENTS[agentCall.agent].name,
            task: agentCall.task,
            status: 'start'
          } 
        })}\n\n`);
        
        // 准备子Agent的上下文
        const subAgentMessages = [];
        subAgentMessages.push({ role: 'system', content: SUB_AGENTS[agentCall.agent].prompt });
        subAgentMessages.push({ role: 'system', content: `任务: ${agentCall.task}` });
        if (agentCall.context) {
          subAgentMessages.push({ role: 'system', content: `上下文: ${agentCall.context}` });
        }
        
        // 对于bename_agent，不需要工具，直接生成结果
        if (agentCall.agent === 'bename_agent') {
          console.log(`[子AGENT-${agentCall.agent}] 直接执行标题生成任务`);
          const subAgentResponse = await callLLM(apiKey, subAgentMessages, baseUrl);
          console.log(`[子AGENT-${agentCall.agent}] 响应: ${subAgentResponse.substring(0, 200)}...`);
          
          // 推送子Agent完成事件
          res.write(`data: ${JSON.stringify({ 
            agentEvent: { 
              agent: agentCall.agent,
              agentName: SUB_AGENTS[agentCall.agent].name,
              task: agentCall.task,
              status: 'success'
            } 
          })}\n\n`);
          
          // 将子Agent调用和结果添加到主Agent的对话历史
          mainAgentMessages.push({ role: 'assistant', content: mainAgentResponse });
          mainAgentMessages.push({ 
            role: 'system', 
            content: `子Agent ${SUB_AGENTS[agentCall.agent].name} 执行完成。
执行结果：${subAgentResponse}

请根据子Agent的执行结果，决定下一步行动：
1. 如果结果满意，使用 <user> 格式向用户输出
2. 如果需要调用其他Agent获取更多信息，使用 <agent_call> 格式
3. 如果需要调用工具，使用 <tool> 格式` 
          });
          
          console.log(`[主AGENT] 子Agent ${agentCall.agent} 执行完成，继续处理...`);
          continue;
        }
        
        // 其他Agent需要工具能力
        const toolSpec = `你可以使用工具 manage_novel_files 来管理 data 目录中的文件和文件夹。调用工具时，使用以下格式：
<tool>
{
  "tool": "manage_novel_files",
  "args": {
    "action": "create_file|create_dir|list|read|update|rename|delete|read_line|edit_line",
    "path": "相对 data 的路径",
    "content": "可选，文件内容",
    "new_path": "可选，重命名或移动的新路径",
    "recursive": false,
    "line_number": "可选，指定行号（用于read_line和edit_line）",
    "line_content": "可选，新行内容（用于edit_line）"
  }
}
</tool>

分行操作说明：
- read_line: 读取指定文件的指定行
  - 需要参数: path, line_number
  - 返回: 该行的内容和行号信息
- edit_line: 编辑指定文件的指定行
  - 需要参数: path, line_number, line_content
  - 返回: 修改前后的行内容和文件变更信息`;
        subAgentMessages.push({ role: 'system', content: toolSpec });
        
        // 子Agent处理循环
        let subAgentResult = '';
        for (let j = 0; j < 5; j++) {
          console.log(`[子AGENT-${agentCall.agent}] 第${j + 1}轮处理`);
          
          const subAgentResponse = await callLLM(apiKey, subAgentMessages, baseUrl);
          console.log(`[子AGENT-${agentCall.agent}] 响应: ${subAgentResponse.substring(0, 200)}...`);
          
          // 检查是否调用工具
          const toolCall = parseToolCall(subAgentResponse);
          if (toolCall) {
            console.log(`[子AGENT-${agentCall.agent}] 调用工具: ${toolCall.action} - ${toolCall.path}`);
            
            // 推送工具开始事件
            res.write(`data: ${JSON.stringify({ 
              toolEvent: { 
                tool: 'manage_novel_files', 
                action: toolCall.action, 
                path: toolCall.path, 
                status: 'start',
                agent: agentCall.agent
              } 
            })}\n\n`);
            
            const toolResult = await runTool(toolCall, changedFiles, modifiedLines, diffData);
            
            // 推送工具完成事件
            const status = toolResult?.ok ? 'success' : 'error';
            res.write(`data: ${JSON.stringify({ 
              toolEvent: { 
                tool: 'manage_novel_files', 
                action: toolCall.action, 
                path: toolCall.path, 
                status, 
                message: toolResult?.message,
                agent: agentCall.agent
              } 
            })}\n\n`);
            
            subAgentMessages.push({ role: 'assistant', content: subAgentResponse });
            
            // 优化工具结果长度
            let toolResultContent = JSON.stringify(toolResult);
            if (toolResultContent.length > 500) {
              const summary = {
                ok: toolResult.ok,
                message: toolResult.message || '操作完成'
              };
              if (toolResult.data) {
                if (Array.isArray(toolResult.data)) {
                  summary.dataCount = toolResult.data.length;
                  summary.dataSample = toolResult.data.slice(0, 2);
                } else {
                  summary.dataLength = toolResult.data.length;
                  summary.dataPreview = toolResult.data.substring(0, 100) + '...';
                }
              }
              toolResultContent = JSON.stringify(summary);
            }
            
            subAgentMessages.push({ role: 'user', content: `工具执行结果：${toolResultContent}` });
            
            if (toolResult?.ok) {
              subAgentMessages.push({ 
                role: 'system', 
                content: '工具执行成功。你可以继续调用工具或者完成任务并回复结果。' 
              });
            } else {
              subAgentMessages.push({ 
                role: 'system', 
                content: '工具执行失败。请尝试重新调用工具或者说明问题。' 
              });
            }
          } else {
            // 子Agent完成任务
            subAgentResult = subAgentResponse;
            console.log(`[子AGENT-${agentCall.agent}] 任务完成`);
            
            // 立即推送子Agent完成事件
            res.write(`data: ${JSON.stringify({ 
              agentEvent: { 
                agent: agentCall.agent,
                agentName: SUB_AGENTS[agentCall.agent].name,
                task: agentCall.task,
                status: 'success'
              } 
            })}\n\n`);
            
            break;
          }
        }
        
        // 将子Agent调用和结果添加到主Agent的对话历史
        mainAgentMessages.push({ role: 'assistant', content: mainAgentResponse });
        
        // 移除重复的Agent完成事件推送（已在上面推送过）
        
        mainAgentMessages.push({ 
          role: 'system', 
          content: `子Agent ${SUB_AGENTS[agentCall.agent].name} 执行完成。
执行结果：${subAgentResult}

请根据子Agent的执行结果，决定下一步行动：
1. 如果需要调用其他Agent，使用 <agent_call> 格式
2. 如果需要调用工具，使用 <tool> 格式
3. 如果可以回复用户，使用 <user> 格式包裹回复内容
4. 如果需要更多信息，可以继续分析或提问` 
        });
        
        console.log(`[主AGENT] 子Agent ${agentCall.agent} 执行完成，继续处理...`);
        
      } else {
        // 检查是否直接调用工具
        const toolCall = parseToolCall(mainAgentResponse);
        if (toolCall) {
          console.log(`[主AGENT] 直接调用工具: ${toolCall.action} - ${toolCall.path}`);
          
          // 推送工具开始事件
          res.write(`data: ${JSON.stringify({ 
            toolEvent: { 
              tool: 'manage_novel_files', 
              action: toolCall.action, 
              path: toolCall.path, 
              status: 'start',
              agent: 'main_agent'
            } 
          })}\n\n`);
          
          const toolResult = await runTool(toolCall, changedFiles, modifiedLines, diffData);
          
          // 推送工具完成事件
          const status = toolResult?.ok ? 'success' : 'error';
          res.write(`data: ${JSON.stringify({ 
            toolEvent: { 
              tool: 'manage_novel_files', 
              action: toolCall.action, 
              path: toolCall.path, 
              status, 
              message: toolResult?.message,
              agent: 'main_agent'
            } 
          })}\n\n`);
          
          mainAgentMessages.push({ role: 'assistant', content: mainAgentResponse });
          
          // 优化工具结果长度
          let toolResultContent = JSON.stringify(toolResult);
          if (toolResultContent.length > 500) {
            const summary = {
              ok: toolResult.ok,
              message: toolResult.message || '操作完成'
            };
            if (toolResult.data) {
              if (Array.isArray(toolResult.data)) {
                summary.dataCount = toolResult.data.length;
                summary.dataSample = toolResult.data.slice(0, 2);
              } else {
                summary.dataLength = toolResult.data.length;
                summary.dataPreview = toolResult.data.substring(0, 100) + '...';
              }
            }
            toolResultContent = JSON.stringify(summary);
          }
          
          mainAgentMessages.push({ role: 'user', content: `工具执行结果：${toolResultContent}` });
          
          if (toolResult?.ok) {
            mainAgentMessages.push({ 
              role: 'system', 
              content: '工具执行成功。你可以继续调用工具或者回复用户。' 
            });
          } else {
            mainAgentMessages.push({ 
              role: 'system', 
              content: '工具执行失败。请尝试重新调用工具或者说明问题。' 
            });
          }
        } else {
          // 检查是否有用户回复
          const userContent = extractUserContent(mainAgentResponse);
          if (userContent) {
            console.log(`[主AGENT] 向用户回复: ${userContent.substring(0, 100)}...`);
            
            // 流式输出用户内容
            const words = userContent.split('');
            for (const word of words) {
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
              await new Promise(resolve => setTimeout(resolve, 20)); // 模拟打字效果
            }
            break;
          } else {
            // 主Agent继续思考（但不输出到用户）
            console.log(`[主AGENT] 没有识别到特殊指令，继续思考...`);
            mainAgentMessages.push({ role: 'assistant', content: mainAgentResponse });
            mainAgentMessages.push({ 
              role: 'system', 
              content: '请继续处理用户需求。如果需要调用子Agent，请使用 <agent_call> 格式。如果准备回复用户，请使用 <user> 格式。' 
            });
          }
        }
      }
    }

    // 发送文件变更信息
    if (changedFiles.size > 0) {
      res.write(`data: ${JSON.stringify({ changedFiles: Array.from(changedFiles), modifiedLines, diffData })}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[API] /api/agent/stream 错误:', err);
    try {
      // 检查是否是API key相关错误
      let errorMessage = 'Agent stream failed';
      let errorDetail = String(err?.message || err);
      
      // 检查错误消息中是否包含401或未授权信息
      if (err?.message && (
        err.message.includes('401') || 
        err.message.includes('not authorized') || 
        err.message.includes('LLM request failed: 401') ||
        err.message.includes('not_authorized_error')
      )) {
        errorMessage = 'API Key 无效或已过期';
        errorDetail = '请检查设置中的API Key是否正确，或点击顶部"设置"重新配置';
      }
      
      res.write(`data: ${JSON.stringify({ error: errorMessage, detail: errorDetail })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) {
      console.error('[API] /api/agent/stream 错误响应发送失败:', e);
    }
  }
});

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
    
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
    
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exists = await fs.stat(fullPath).then(() => true).catch(() => false);
    if (exists) {
      return res.status(409).json({ error: 'File or folder already exists' });
    }

    if (type === 'folder') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
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
    
    if (!oldFullPath.startsWith(path.join(__dirname, 'data')) || 
        !newFullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

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

// 读取指定行
app.get('/api/files/*/line/:lineNumber', async (req, res) => {
  try {
    const filePath = req.params[0];
    const lineNumber = parseInt(req.params.lineNumber);
    
    if (isNaN(lineNumber) || lineNumber < 1) {
      return res.status(400).json({ error: 'Invalid line number' });
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    const lines = content.split('\n');
    
    if (lineNumber > lines.length) {
      return res.status(400).json({ 
        error: `Line number ${lineNumber} exceeds file length (${lines.length} lines)` 
      });
    }
    
    const lineContent = lines[lineNumber - 1];
    res.json({ 
      content: lineContent,
      lineNumber: lineNumber,
      totalLines: lines.length
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      console.error('Error reading line:', error);
      res.status(500).json({ error: 'Failed to read line' });
    }
  }
});

// 编辑指定行
app.put('/api/files/*/line/:lineNumber', async (req, res) => {
  try {
    const filePath = req.params[0];
    const lineNumber = parseInt(req.params.lineNumber);
    const { content: newLineContent } = req.body;
    
    if (isNaN(lineNumber) || lineNumber < 1) {
      return res.status(400).json({ error: 'Invalid line number' });
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    if (!fullPath.startsWith(path.join(__dirname, 'data'))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const oldContent = await fs.readFile(fullPath, 'utf8');
    const lines = oldContent.split('\n');
    
    if (lineNumber > lines.length) {
      return res.status(400).json({ 
        error: `Line number ${lineNumber} exceeds file length (${lines.length} lines)` 
      });
    }
    
    const oldLineContent = lines[lineNumber - 1];
    lines[lineNumber - 1] = newLineContent || '';
    const newContent = lines.join('\n');
    
    await fs.writeFile(fullPath, newContent, 'utf8');
    
    res.json({ 
      success: true,
      lineNumber: lineNumber,
      oldContent: oldLineContent,
      newContent: newLineContent || '',
      totalLines: lines.length
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      console.error('Error editing line:', error);
      res.status(500).json({ error: 'Failed to edit line' });
    }
  }
});

// 代理 DeepSeek 流式输出（传统聊天模式）- 增加工具调用检测
// 聊天API - 完全参考写作模式实现
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { apiKey: inputApiKey, messages = [], systemPrompt } = req.body || {};
    if (!inputApiKey) return res.status(400).json({ error: 'Missing API key' });
    
    const apiKey = resolveApiKey(inputApiKey);

    const baseUrl = 'https://api.lkeap.cloud.tencent.com/v1';

    // 设置SSE头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // 创建聊天Agent的上下文（完全参考写作模式）
    const chatAgentMessages = [];
    
    // 添加系统提示词
    if (systemPrompt) {
      chatAgentMessages.push({ role: 'system', content: systemPrompt });
    }
    
    // 添加对话历史
    for (const m of messages) {
      const role = m.role || 'user';
      const content = m.content || '';
      if (content) chatAgentMessages.push({ role, content });
    }

    console.log(`[聊天AGENT] 开始处理用户请求: ${messages[messages.length - 1]?.content || ''}`);

    // 聊天Agent处理循环（参考写作模式的主循环）
    for (let i = 0; i < 3; i++) {
      console.log(`[聊天AGENT] 第${i + 1}轮处理`);
      
      // 调用聊天Agent（使用写作模式的callLLM函数）
      const chatAgentResponse = await callLLM(apiKey, chatAgentMessages, baseUrl);
      console.log(`[聊天AGENT] 响应: ${chatAgentResponse.substring(0, 200)}...`);
      
      // 检查是否有工具调用（类似写作模式的parseToolCall）
      const hasToolCall = chatAgentResponse.includes('<tool_call>') && chatAgentResponse.includes('</tool_call>');
      
      if (hasToolCall) {
        console.log('[聊天AGENT] 检测到工具调用');
        
        // 解析工具调用
        const toolCallMatch = chatAgentResponse.match(/<tool_call>([\s\S]*?)<\/tool_call>/i);
        if (toolCallMatch) {
          try {
            const toolData = JSON.parse(toolCallMatch[1].trim());
            console.log('[聊天AGENT] 解析到工具调用:', toolData);
            
            if (toolData.name === 'switch_to_writing_workspace') {
              console.log('[聊天AGENT] 确认为switch_to_writing_workspace工具调用');
              
              // 提取工具调用前后的文本（完全参考写作模式的处理方式）
              const beforeText = chatAgentResponse.substring(0, chatAgentResponse.indexOf('<tool_call>')).trim();
              const afterText = chatAgentResponse.substring(chatAgentResponse.indexOf('</tool_call>') + 11).trim();
              
              // 调试：输出afterText的详细信息
              console.log('[聊天AGENT] beforeText:', JSON.stringify(beforeText));
              console.log('[聊天AGENT] afterText:', JSON.stringify(afterText));
              console.log('[聊天AGENT] afterText字节:', Array.from(Buffer.from(afterText, 'utf8')));
              console.log('[聊天AGENT] afterText长度:', afterText.length);
              
              // 发送前文（按写作模式的方式逐字发送）
              if (beforeText) {
                const words = beforeText.split('');
                for (const word of words) {
                  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
              }
              
              // 发送工具调用事件（类似写作模式的agentEvent）
              res.write(`data: ${JSON.stringify({ 
                toolCallEvent: {
                  name: toolData.name,
                  parameters: toolData.parameters
                }
              })}\n\n`);
              
              // 发送后文（暂时禁用调试）
              if (afterText && afterText.length > 0) {
                console.log('[聊天AGENT] 暂时跳过afterText输出，内容:', JSON.stringify(afterText));
                // 暂时不发送，等确认问题来源
                /*
                const words = afterText.split('');
                for (const word of words) {
                  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
                */
              }
              
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }
          } catch (e) {
            console.error('[聊天AGENT] 工具调用JSON解析失败:', e.message);
          }
        }
        
        // 如果工具调用处理失败，继续正常流程
        chatAgentMessages.push({ role: 'assistant', content: chatAgentResponse });
        chatAgentMessages.push({ 
          role: 'system', 
          content: '工具调用处理失败，请重新回复用户。' 
        });
        continue;
      }
      
      // 没有工具调用，直接流式输出响应（完全参考写作模式的最终输出）
      console.log(`[聊天AGENT] 向用户回复: ${chatAgentResponse.substring(0, 100)}...`);
      
      const words = chatAgentResponse.split('');
      for (const word of words) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      break;
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[聊天API] 处理错误:', err);
    try {
      // 检查是否是API key相关错误
      let errorMessage = 'Chat stream failed';
      let errorDetail = String(err?.message || err);
      
      // 检查错误消息中是否包含401或未授权信息
      if (err?.message && (
        err.message.includes('401') || 
        err.message.includes('not authorized') || 
        err.message.includes('LLM request failed: 401') ||
        err.message.includes('not_authorized_error')
      )) {
        errorMessage = 'API Key 无效或已过期';
        errorDetail = '请检查设置中的API Key是否正确，或点击顶部"设置"重新配置';
      }
      
      res.write(`data: ${JSON.stringify({ error: errorMessage, detail: errorDetail })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (e) {
      console.error('[聊天API] 错误响应发送失败:', e);
    }
  }
});


app.listen(PORT, () => {
  console.log(`多Agent服务器运行在 http://localhost:${PORT}`);
  console.log('已启用多Agent架构，支持主Agent与子Agent协作');
});