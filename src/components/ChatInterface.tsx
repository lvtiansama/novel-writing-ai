import { useState } from "react";
import { Send, Sparkles, Bot, User, Lightbulb, PenTool, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "您好！我是您的AI创作助手。我可以帮助您进行文学创作、提供写作建议、优化文本内容等。请问有什么我可以帮助您的吗？",
      role: "assistant",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateAIResponse(content),
        role: "assistant",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000);
  };

  const generateAIResponse = (userInput: string): string => {
    const responses = [
      "这是一个很有趣的想法！让我来帮您分析一下...",
      "根据您的描述，我建议可以从以下几个角度来考虑：",
      "这个创意很棒！我们可以进一步发展这个想法：",
      "让我为您提供一些创作建议：",
      "基于您的内容，我认为可以这样优化："
    ];
    
    const tips = [
      "增加更多感官细节描写，让读者身临其境",
      "考虑添加一些对话来推动情节发展",
      "可以通过环境描写来烘托人物心情",
      "适当使用比喻和象征手法增强表现力",
      "注意情节的张弛有度，保持读者兴趣"
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    const randomTips = tips.slice(0, 2 + Math.floor(Math.random() * 2));
    
    return `${randomResponse}\n\n${randomTips.map((tip, index) => `${index + 1}. ${tip}`).join('\n')}\n\n希望这些建议对您的创作有帮助！`;
  };

  const handleSuggestedPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="w-80 bg-chat-bg border-l border-border flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-medium">AI 创作助手</h3>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex space-x-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-lg text-sm",
                  message.role === "user"
                    ? "bg-chat-message-user text-primary-foreground ml-auto"
                    : "bg-chat-message-assistant text-foreground"
                )}
              >
                {message.content.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
              {message.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex space-x-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-3 h-3 text-primary-foreground" />
              </div>
              <div className="bg-chat-message-assistant p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
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
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入您的问题..."
            className="flex-1 h-9"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
          />
          <Button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            className="px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}