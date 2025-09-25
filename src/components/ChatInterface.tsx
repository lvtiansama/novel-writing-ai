import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Send, Sparkles, Bot, User, Lightbulb, PenTool, BookOpen, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/api";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
}

interface ChatInterfaceProps {
  selectedFile: string | null;
  getEditorContent?: () => string | undefined;
  onChangedFiles?: (files: string[], modifiedLines?: Record<string, number[]>, diffData?: Record<string, { oldContent: string; newContent: string }>) => void;
}

export interface ChatInterfaceHandle {
  sendMessage: (message: string) => void;
}

export const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(({ selectedFile, getEditorContent, onChangedFiles }, ref) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "您好！我是您的AI创作助手。我可以帮助您进行文学创作、提供写作建议、优化文本内容等。请问有什么我可以帮助您的吗？",
      role: "assistant",
      timestamp: new Date()
    }
  ]);

  // 处理消息内容，隐藏各种标识
  const processMessageContent = (content: string) => {
    // 检查是否包含 [TO_USER] 标识（新格式）
    if (content.includes('[TO_USER]')) {
      return content.replace(/\[TO_USER\]/g, '').trim();
    }
    
    // 兼容旧格式：检查是否包含 <user> 标签
    const userMatch = content.match(/<user>([\s\S]*?)<\/user>/i);
    if (userMatch) {
      // 如果包含 <user> 标签，只返回标签内的内容
      return userMatch[1];
    }
    
    // 如果不包含标签，返回原内容
    return content;
  };
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toolMessageRef = useRef<string | null>(null); // 跟踪当前工具消息ID
  const agentMessageRef = useRef<string | null>(null); // 跟踪当前Agent消息ID
  const [finalResponseId, setFinalResponseId] = useState<string | null>(null); // 跟踪最终响应消息
  const aiMessageCreatedRef = useRef<boolean>(false); // 跟踪AI消息是否已创建

  // 暴露sendMessage方法给父组件
  useImperativeHandle(ref, () => ({
    sendMessage: (message: string) => {
      console.log('[ChatInterface] 通过ref调用sendMessage:', message);
      handleSendMessage(message);
    }
  }));

  // 自动滚动到底部（新消息或流式追加时）
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const suggestedPrompts = [
    {
      icon: <PenTool className="w-4 h-4" />,
      text: "帮我优化这段文字",
      prompt: "请帮我优化当前编辑器中的文字，让它更生动有趣。"
    },
    {
      icon: <BookOpen className="w-4 h-4" />,
      text: "续写故事情节",
      prompt: "根据现有内容，帮我续写下一段故事情节。"
    },
    {
      icon: <Lightbulb className="w-4 h-4" />,
      text: "创作灵感建议",
      prompt: "请给我一些创作灵感和想法，让故事更有趣。"
    },
    {
      icon: <Sparkles className="w-4 h-4" />,
      text: "人物性格分析",
      prompt: "帮我分析一下这个人物的性格特点和发展方向。"
    }
  ];

  // 默认即多Agent：先尝试 agentRun，失败则回退到流式

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    const apiKey =
      localStorage.getItem("lkeap_api_key") ||
      localStorage.getItem("DEEPSEEK_API_KEY") ||
      "";

    if (!apiKey) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "未检测到 API Key，请点击顶部‘设置’填写并保存后再试。",
        role: "assistant",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      return;
    }

    const assistantId = (Date.now() + 2).toString();
    // 不立即创建AI消息气泡，而是在真正开始输出内容时创建
    setStreamingId(assistantId);
    aiMessageCreatedRef.current = false; // 重置AI消息创建状态

    try {
      const editorContent = getEditorContent ? (getEditorContent() || "") : "";
      // 过滤掉 system（工具提示）消息，避免污染模型上下文
      const simpleMessages = [...messages.filter(m => m.role !== 'system'), userMessage].map(m => ({ role: m.role, content: m.content }));

      // 创建 AbortController 用于中断请求
      abortControllerRef.current = new AbortController();

      try {
        // 多Agent流式
        const { streamAgent } = await import("@/lib/api");
        await streamAgent({
          apiKey,
          messages: simpleMessages as any,
          selectedFile,
          editorContent,
          signal: abortControllerRef.current?.signal,
          onToken: (delta: string) => {
            // 当收到第一个token时，停止加载状态
            if (isLoading) {
              setIsLoading(false);
            }
            
            // 检查是否包含 [TO_USER] 标识
            if (delta.includes('[TO_USER]')) {
              // 创建新的最终响应消息，确保时间戳比工具消息更晚
              const finalId = `final-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const cleanDelta = delta.replace('[TO_USER]', '');
              
              const finalMsg: Message = {
                id: finalId,
                content: cleanDelta,
                role: 'assistant',
                timestamp: new Date(Date.now() + 1000) // 确保时间戳比工具消息晚
              };
              
              setFinalResponseId(finalId);
              setMessages(prev => [...prev, finalMsg]);
            } else if (finalResponseId) {
              // 如果已经有最终响应消息，在其上追加内容
              setMessages(prev => prev.map(msg =>
                msg.id === finalResponseId ? { ...msg, content: msg.content + delta } : msg
              ));
            } else {
              // 使用ref来跟踪AI消息是否已创建
              if (aiMessageCreatedRef.current) {
                // 如果已创建，更新内容
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg
                ));
              } else {
                // 如果未创建，创建新消息并标记为已创建
                const initialMsg: Message = {
                  id: assistantId,
                  content: delta,
                  role: 'assistant',
                  timestamp: new Date(Date.now() + 1000) // 确保时间戳比工具消息晚
                };
                aiMessageCreatedRef.current = true;
                setMessages(prev => [...prev, initialMsg]);
              }
            }
          },
          onChangedFiles: (files: string[], modifiedLines?: Record<string, number[]>, diffData?: Record<string, { oldContent: string; newContent: string }>) => {
            try { console.debug('[Agent] changedFiles', files, modifiedLines); } catch {}
            // 在聊天中插入系统提示，确保时间戳比AI文本消息早
            if (files && files.length) {
              const fileNames = files.map(f => f.split('/').pop()).join(', ');
              const sysMsg: Message = {
                id: `files-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                content: `✨ AI已修改文件：${fileNames}`,
                role: 'system',
                timestamp: new Date(Date.now() - 2000) // 确保比AI文本消息早
              };
              setMessages(prev => [...prev, sysMsg]);
            }
            onChangedFiles?.(files, modifiedLines, diffData);
          },
          onToolEvent: (evt) => {
            try { console.debug('[Agent] toolEvent', evt); } catch {}
            
            // 工具调用完成后立即刷新文件和目录
            if (evt.status === 'success' && (evt.action === 'create_file' || evt.action === 'update' || evt.action === 'delete' || evt.action === 'create_dir')) {
              // 立即触发文件系统刷新
              setTimeout(() => {
                if (selectedFile && evt.path) {
                  const currentFileName = selectedFile.split('/').pop();
                  const modifiedFileName = evt.path.split('/').pop();
                  if (currentFileName === modifiedFileName) {
                    onChangedFiles?.([selectedFile], {});
                  }
                }
                // 触发目录刷新（通过传递空数组来强制刷新）
                onChangedFiles?.([], {});
              }, 100); // 短暂延时确保操作完成
            }
            
            const actionMap: Record<string, string> = {
              list: "列出",
              read: "读取",
              create_file: "创建文件",
              create_dir: "创建文件夹",
              update: "修改",
              rename: "重命名",
              delete: "删除",
            };
            
            const actionLabel = actionMap[evt.action || ""] || (evt.action || "操作");
            const shortPath = evt.path || "(未指定路径)";
            const statusMap: Record<string, string> = {
              start: "调用中",
              success: "成功",
              error: "失败"
            };
            const statusLabel = statusMap[evt.status] || evt.status;
            
            let text = `调用${evt.tool}-${actionLabel}:"${shortPath}" ${statusLabel}`;
            
            // 如果是错误状态，添加错误信息
            if (evt.status === 'error' && evt.message) {
              text += ` - ${evt.message}`;
            }
            
            if (evt.status === 'start') {
              // 开始调用时创建新消息，确保时间戳比AI文本消息早
              const sysMsg: Message = {
                id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                content: text,
                role: 'system',
                timestamp: new Date(Date.now() - 2000) // 确保比AI文本消息早
              };
              toolMessageRef.current = sysMsg.id;
              setMessages(prev => [...prev, sysMsg]);
            } else {
              // 完成或失败时更新现有消息，保持原有时间戳
              if (toolMessageRef.current) {
                setMessages(prev => prev.map(msg =>
                  msg.id === toolMessageRef.current 
                    ? { ...msg, content: text }
                    : msg
                ));
                // 如果是完成状态，清除引用
                if (evt.status === 'success' || evt.status === 'error') {
                  toolMessageRef.current = null;
                }
              }
            }
          },
          onAgentEvent: (evt) => {
            try { console.debug('[Agent] agentEvent', evt); } catch {}
            
            const statusMap: Record<string, string> = {
              start: "调用中",
              success: "成功",
              error: "失败"
            };
            const statusLabel = statusMap[evt.status] || evt.status;
            
            // 简化显示，只显示 Agent 名称和状态
            let text = `调用${evt.agentName} ${statusLabel}`;
            
            if (evt.status === 'start') {
              // 开始调用时创建新消息，确保时间戳比AI文本消息早
              const sysMsg: Message = {
                id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                content: text,
                role: 'system',
                timestamp: new Date(Date.now() - 2000) // 确保比AI文本消息早
              };
              agentMessageRef.current = sysMsg.id;
              setMessages(prev => [...prev, sysMsg]);
            } else {
              // 完成或失败时更新现有消息，保持原有时间戳
              if (agentMessageRef.current) {
                setMessages(prev => prev.map(msg =>
                  msg.id === agentMessageRef.current 
                    ? { ...msg, content: text }
                    : msg
                ));
                // 如果是完成状态，清除引用
                if (evt.status === 'success' || evt.status === 'error') {
                  agentMessageRef.current = null;
                }
              }
            }
          }
        });
      } catch (e: any) {
        // 检查是否被用户中断
        if (e.name === 'AbortError') {
          if (finalResponseId) {
            setMessages(prev => prev.map(msg =>
              msg.id === finalResponseId ? { ...msg, content: msg.content + "\n\n[用户中断]" } : msg
            ));
          } else {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + "\n\n[用户中断]" } : msg
            ));
          }
          return;
        }
        
        // 检查是否是API key相关错误
        // 检查是否是API key相关错误
        if (e.message && (
          e.message.includes('401') || 
          e.message.includes('not authorized') || 
          e.message.includes('LLM request failed: 401') ||
          e.message.includes('not_authorized_error') ||
          e.message.includes('API Key 无效或已过期')
        )) {
          // 如果错误消息已经是友好格式（包含✨），直接使用
          const errorMessage = e.message.includes('❌') ? e.message : `❌ API Key 无效或已过期，请检查 API 设置：${window.location.origin}/key`;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId ? { ...msg, content: msg.content + `\n${errorMessage}` } : msg
          ));
          return;
        }
        
        // 回退到单路流式
        await streamChat({
          apiKey,
          messages: simpleMessages as any,
          selectedFile,
          editorContent,
          signal: abortControllerRef.current?.signal, // 传递中断信号
          onToken: (delta: string) => {
            // 当收到第一个token时，停止加载状态
            if (isLoading) {
              setIsLoading(false);
            }
            
            // 使用ref来跟踪AI消息是否已创建
            if (aiMessageCreatedRef.current) {
              // 如果已创建，更新内容
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg
              ));
            } else {
              // 如果未创建，创建新消息并标记为已创建
              const initialMsg: Message = {
                id: assistantId,
                content: delta,
                role: 'assistant',
                timestamp: new Date(Date.now() + 1000) // 确保时间戳比工具消息晚
              };
              aiMessageCreatedRef.current = true;
              setMessages(prev => [...prev, initialMsg]);
            }
          }
        });
      }
    } catch (e: any) {
      // 检查是否被用户中断
      if (e.name === 'AbortError') {
        console.log('[ChatInterface] 捕获到AbortError，中断处理已在handleStopGeneration中完成');
        return; // 中断处理已在handleStopGeneration中完成，这里不需要额外处理
      }
      
      // 检查是否是API key相关错误
      let errorMessage = "[错误] 聊天请求失败";
      
      if (e.message && (
        e.message.includes('401') || 
        e.message.includes('not authorized') || 
        e.message.includes('LLM request failed: 401') ||
        e.message.includes('not_authorized_error') ||
        e.message.includes('API Key 无效或已过期')
      )) {
        // 如果错误消息已经是友好格式（包含✨），直接使用
        errorMessage = e.message.includes('❌') ? e.message : `❌ API Key 无效或已过期，请检查 API 设置：${window.location.origin}/key`;
      } else if (e.message && e.message.includes('API Key')) {
        // 如果错误消息已经包含API Key相关信息，直接使用
        errorMessage = `❌ ${e.message}`;
      }
      
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId ? { ...msg, content: msg.content + `\n${errorMessage}` } : msg
      ));
    } finally {
      setIsLoading(false);
      setStreamingId(null);
      setFinalResponseId(null); // 清理最终响应ID
      aiMessageCreatedRef.current = false; // 重置AI消息创建状态
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log('[ChatInterface] 用户点击停止生成');
      abortControllerRef.current.abort();
      
      // 立即停止加载状态
      setIsLoading(false);
      
      // 添加系统提示消息
      const interruptMsg: Message = {
        id: `interrupt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content: "⚠️ 用户中断了生成过程",
        role: 'system',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, interruptMsg]);
    }
  };

  // 保留建议按钮逻辑

  const handleSuggestedPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="w-96 bg-chat-bg border-l border-border flex flex-col h-full relative">
      <div className="p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium">小白创作助手</h3>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .map((message, idx) => {
            const isAssistant = message.role === "assistant";
            // 修改逻辑：只有在没有最终响应且内容为空时才显示三个点
            const isStreamingEmpty = isAssistant && streamingId === message.id && isLoading && (!message.content || message.content.length === 0);
            if (message.role === 'system') {
              const isFileChange = message.content.includes('AI已修改文件');
              const isAgentCall = message.content.includes('调用') && (message.content.includes('网文标题生成专家') || message.content.includes('项目立项专家') || message.content.includes('世界观构建专家'));
              const isToolCall = message.content.includes('调用manage_novel_files');
              
              return (
                <div key={message.id} className="w-full flex justify-center">
                  <div className={`px-3 py-2 rounded-lg text-xs border ${
                    isFileChange 
                      ? 'bg-primary/10 text-primary border-primary/20' 
                      : isAgentCall
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : isToolCall
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {processMessageContent(message.content)}
                  </div>
                </div>
              );
            }
            return (
            <div
              key={message.id}
              className={cn(
                "flex space-x-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {isAssistant && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[90%] p-3 rounded-lg text-sm",
                  message.role === "user"
                    ? "bg-chat-message-user text-primary-foreground ml-auto"
                    : "bg-chat-message-assistant text-foreground"
                )}
              >
                {isStreamingEmpty ? (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                                ) : (
                  <div>
                    {processMessageContent(message.content).split('\n').map((line, index) => {
                      // 检查是否包含链接模式（域名/key）
                      const linkMatch = line.match(/^(.*：)(.+?\/key)(.*)$/);
                      if (linkMatch) {
                        const [, prefix, link, suffix] = linkMatch;
                        return (
                          <div key={index}>
                            {prefix}
                            <a 
                              href={link} 
                              className="text-blue-500 hover:text-blue-700 underline cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                window.location.href = link;
                              }}
                            >
                              {link}
                            </a>
                            {suffix}
                          </div>
                        );
                      }
                      return <div key={index}>{line}</div>;
                    })}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-secondary-foreground" />
                </div>
              )}
            </div>
            );
          })}
          
          {/* 在最下面显示加载状态，确保始终在底部显示直到AI开始输出内容 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <div className="ml-2 max-w-[90%] p-3 rounded-lg text-sm bg-chat-message-assistant text-foreground">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
          {/* 移除打字中指示，避免与流式消息重复显示 */}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-2">建议操作：</p>
          <div className="grid grid-cols-2 gap-2">
            {suggestedPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="h-auto p-2 text-xs text-left justify-start"
                onClick={() => handleSuggestedPrompt(prompt.prompt)}
                disabled={isLoading}
              >
                <div className="flex items-start space-x-1">
                  {prompt.icon}
                  <span className="flex-1 leading-tight">{prompt.text}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Input
            id="chat-input"
            name="chatMessage"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入您的问题..."
            className="flex-1 h-9"
            disabled={isLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
          />
          {isLoading ? (
            <Button
              onClick={handleStopGeneration}
              size="sm"
              variant="destructive"
              className="px-3"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => handleSendMessage(inputValue)}
              disabled={!inputValue.trim()}
              size="sm"
              className="px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});