import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Square, PlusCircle, MessageCircle, Lightbulb, PenTool, BookOpen, FileText, Mic, ArrowUp, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { streamChat } from "@/lib/api";
import { CHAT_SYSTEM_PROMPT, CHAT_WELCOME_MESSAGE, QUICK_PROMPTS } from "../../prompts/chat_prompts";

// 工具调用接口
interface ToolCall {
  name: string;
  parameters: {
    user_message: string;
    reason: string;
  };
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
}

const ChatHome = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false); // 新增状态标识
  const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null); // 待处理的工具调用
  const [isTransitioning, setIsTransitioning] = useState(false); // 页面过渡状态
  const [countdown, setCountdown] = useState<number | null>(null); // 倒计时状态
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null); // 倒计时定时器引用
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // 设置页面标题和检查API key
  useEffect(() => {
    document.title = "小白 你的智能agent助手";
    
    // 检查API key是否存在
    const apiKey = localStorage.getItem("lkeap_api_key") || localStorage.getItem("DEEPSEEK_API_KEY") || "";
    if (!apiKey.trim()) {
      console.log('[ChatHome] 未检测到API key，跳转到设置页面');
      navigate("/key");
      return;
    }
    
    // 调试模式：暴露工具调用处理器到全局
    if (typeof window !== 'undefined') {
      (window as any).debugToolCallHandler = handleToolCall;
      console.log('[DEBUG] 工具调用处理器已暴露到 window.debugToolCallHandler');
    }
    
    // 清理函数：组件卸载时清理倒计时定时器
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [navigate]);

  // 快捷操作按钮（从提示词文件导入）
  const quickActions = QUICK_PROMPTS;

  // 处理工具调用
  const handleToolCall = (toolCall: ToolCall) => {
    console.log('[TOOL CALL HANDLER] 收到工具调用:', toolCall);
    console.log('[TOOL CALL HANDLER] 参数详情:', JSON.stringify(toolCall.parameters, null, 2));
    
    if (toolCall.name === 'switch_to_writing_workspace') {
      console.log('[TOOL CALL HANDLER] 处理switch_to_writing_workspace工具调用');
      
      // 添加系统提示消息
      const systemMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `✨ 检测到小说创作需求，正在为您切换到专业创作工作区... 🚀`,
        role: "system",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, systemMessage]);
      
      console.log('[TOOL CALL HANDLER] 添加了系统提示消息');
      
      // 先延迟一点让用户看到提示消息，然后开始倒计时
      setTimeout(() => {
        console.log('[TOOL CALL HANDLER] 开始3秒倒计时');
        
        // 添加倒计时提示消息
        const countdownMessageId = (Date.now() + 2).toString();
        const countdownMessage: Message = {
          id: countdownMessageId,
          content: `🕒 3秒后将跳转到创作工作区... 3`,
          role: "system",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, countdownMessage]);
        
        // 开始倒计时
        setCountdown(3);
        
        countdownIntervalRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              
              // 倒计时结束，开始过渡动画
              console.log('[TOOL CALL HANDLER] 倒计时结束，开始页面过渡');
              
              // 更新最后一次倒计时消息
              setMessages(prevMsgs => prevMsgs.map(msg => 
                msg.id === countdownMessageId 
                  ? { ...msg, content: `🚀 正在跳转到创作工作区...` }
                  : msg
              ));
              
              setIsTransitioning(true);
              
              // 保存用户消息到localStorage
              localStorage.setItem('pendingUserMessage', toolCall.parameters.user_message);
              console.log('[TOOL CALL HANDLER] 保存用户消息到localStorage:', toolCall.parameters.user_message);
              
              // 执行页面跳转（在动画过渡中）
              setTimeout(() => {
                navigate("/workspace");
              }, 300); // 等待渐隐动画完成
              
              return null;
            }
            
            // 更新倒计时消息
            const newCount = prev - 1;
            setMessages(prevMsgs => prevMsgs.map(msg => 
              msg.id === countdownMessageId 
                ? { ...msg, content: `🕒 ${newCount}秒后将跳转到创作工作区... ${newCount}` }
                : msg
            ));
            
            return newCount;
          });
        }, 1000); // 每秒1更新
      }, 1000);
    } else {
      console.log('[TOOL CALL HANDLER] 未知的工具名称:', toolCall.name);
    }
  };

  // 处理消息发送（接入真实API）
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // 如果是第一次发送消息，切换到对话模式
    if (!hasStartedChat) {
      setHasStartedChat(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    
    // 重置工具调用相关状态
    setPendingToolCall(null);

    // 获取API Key
    const apiKey =
      localStorage.getItem("lkeap_api_key") ||
      localStorage.getItem("DEEPSEEK_API_KEY") ||
      "";

    if (!apiKey) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "未检测到 API Key，请点击顶部'设置'填写并保存后再试。",
        role: "assistant",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      return;
    }

    const assistantId = (Date.now() + 2).toString();
    
    // 不立即创建空的助手消息，而是在收到第一个token时创建
    let assistantMessageCreated = false;

    try {
      // 创建 AbortController 用于中断请求
      abortControllerRef.current = new AbortController();

      // 使用流式聊天API，带有工具调用支持
      const chatMessages = [...messages.filter(m => m.role !== 'system'), userMessage].map(m => ({ role: m.role, content: m.content }));
      
      await streamChat({
        apiKey,
        messages: chatMessages as any,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        signal: abortControllerRef.current?.signal, // 传递中断信号
        onToken: (delta: string) => {
          // 在收到第一个token时立即停止加载状态
          if (isLoading) {
            setIsLoading(false);
          }
          
          console.log('[TOOL DETECTION] 收到delta:', JSON.stringify(delta));
          
          // 现在后端已经过滤了工具调用JSON，前端直接显示内容即可
          // 如果还没有创建助手消息，现在创建
          if (!assistantMessageCreated) {
            assistantMessageCreated = true;
            setMessages(prev => [
              ...prev,
              {
                id: assistantId,
                content: delta,
                role: "assistant",
                timestamp: new Date()
              }
            ]);
          } else {
            // 更新现有消息
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg
            ));
          }
        },
        onToolCall: (toolCall) => {
          console.log('[TOOL DETECTION] 收到后端工具调用事件:', toolCall);
          if (toolCall.name === 'switch_to_writing_workspace') {
            const formattedToolCall: ToolCall = {
              name: 'switch_to_writing_workspace',
              parameters: {
                user_message: toolCall.parameters.user_message || content,
                reason: toolCall.parameters.reason || '检测到专业创作需求'
              }
            };
            // 工具调用已处理
            handleToolCall(formattedToolCall);
          }
        }
      });
    } catch (e: any) {
      // 检查是否被用户中断
      if (e.name === 'AbortError') {
        console.log('[ChatHome] 捕获到AbortError，中断处理已在handleStopGeneration中完成');
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
      
      // 其他错误
      if (assistantMessageCreated) {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: msg.content + `\n${errorMessage}` } : msg
        ));
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: assistantId,
            content: errorMessage,
            role: "assistant",
            timestamp: new Date()
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 处理停止生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log('[ChatHome] 用户点击停止生成');
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

  // 处理快捷操作
  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

  // 参考豆包的简洁设计，避免重叠问题
  return (
    <div className={`h-screen bg-background flex flex-col relative transition-opacity duration-300 ${
      isTransitioning ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 初始状态：完全居中显示，参考豆包布局 */}
        {!hasStartedChat ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* AI 头像 */}
            <div className="w-20 h-20 mb-8 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
              <Bot className="w-10 h-10 text-primary-foreground" />
            </div>
            
            <h1 className="text-3xl font-medium text-foreground mb-12">
              有什么我能帮你的吗？
            </h1>
            
            {/* 功能快捷方式 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg">
              <button 
                className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]"
                onClick={() => handleQuickAction("帮我写一篇文章")}
              >
                <PenTool className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">智能写作</span>
              </button>
              <button className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]">
                <FileText className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">图像生成</span>
              </button>
              <button className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]">
                <BookOpen className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">编程助手</span>
              </button>
              <button className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]">
                <MessageCircle className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">翻译</span>
              </button>
              <button className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]">
                <Lightbulb className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">创意灵感</span>
              </button>
              <button className="flex flex-col items-center p-4 rounded-xl border border-border hover:bg-muted transition-colors min-h-[80px]">
                <FileText className="w-6 h-6 text-muted-foreground mb-2" />
                <span className="text-sm text-foreground">AI PPT</span>
              </button>
            </div>
          </div>
        ) : (
          /* 对话状态：消息列表 */
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="space-y-6">
                  {messages.map((message) => {
                    if (message.role === 'system') {
                      // 判断是否是倒计时消息
                      const isCountdownMessage = message.content.includes('秒后将跳转') || message.content.includes('正在跳转');
                      
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className={`px-3 py-1 rounded-full text-xs ${
                            isCountdownMessage 
                              ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 border border-blue-500/30 font-medium animate-pulse' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {message.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {/* 助手头像 */}
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                        
                        {/* 消息内容 */}
                        <div className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-3",
                          message.role === "user" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted text-foreground"
                        )}>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content.split('\n').map((line, index) => {
                              // 检查是否包含链接模式（域名/key）
                              const linkMatch = line.match(/^(.*：)(.+?\/key)(.*)$/);
                              if (linkMatch) {
                                const [, prefix, link, suffix] = linkMatch;
                                return (
                                  <div key={index}>
                                    {prefix}
                                    <a 
                                      href={link} 
                                      className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
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
                        </div>
                      </div>
                    );
                  })}

                  {/* 加载指示器 - 只在正在加载且没有开始接收内容时显示 */}
                  {isLoading && (
                    <div className="flex justify-start gap-3">
                      <div className="bg-muted rounded-2xl px-4 py-3 ml-11">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 快捷提示按钮 */}
                  {messages.length <= 1 && (
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          onClick={() => handleQuickAction(action.prompt)}
                          disabled={isLoading}
                        >
                          {action.text}
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  {/* 底部间距 */}
                  <div className="h-4" />
                  <div ref={bottomRef} />
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* 固定底部输入区域 */}
      <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto p-4">
          <div className="relative">
            <Input
              id="chat-home-input"
              name="chatMessage"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="有什么我可以帮你的"
              className="w-full h-12 pl-4 pr-20 rounded-xl border-border bg-background text-sm resize-none"
              disabled={isLoading}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
            />
            
            {/* 右侧按钮组 */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
                title="语音输入"
              >
                <Mic className="w-4 h-4" />
              </Button>
              
              {/* 发送/停止按钮 */}
              {isLoading ? (
                <Button
                  onClick={handleStopGeneration}
                  size="sm"
                  variant="destructive"
                  className="h-8 w-8 p-0 rounded-lg"
                  title="停止生成"
                >
                  <Square className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim()}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  title="发送"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHome;