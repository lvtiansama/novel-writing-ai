import { useNavigate } from "react-router-dom";
import { Bot, MessageCircle, PenTool, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Welcome = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <MessageCircle className="w-8 h-8 text-primary" />,
      title: "AI 对话助手",
      description: "智能对话，解答疑问，陪伴聊天",
      action: () => navigate("/chat")
    },
    {
      icon: <PenTool className="w-8 h-8 text-primary" />,
      title: "专业创作工具",
      description: "小说创作、剧本编写、文案优化",
      action: () => navigate("/workspace")
    },
    {
      icon: <FileText className="w-8 h-8 text-primary" />,
      title: "文档处理",
      description: "文本编辑、格式转换、内容分析",
      action: () => navigate("/workspace")
    },
    {
      icon: <Sparkles className="w-8 h-8 text-primary" />,
      title: "创意生成",
      description: "灵感启发、创意拓展、思维导图",
      action: () => navigate("/chat")
    }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 顶部标题区域 */}
      <div className="flex-shrink-0 text-center pt-16 pb-8">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Novel Writing AI
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          您的智能创作伙伴，融合AI对话与专业写作工具
        </p>
      </div>

      {/* 功能卡片区域 */}
      <div className="flex-1 px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 border-border bg-card"
                onClick={feature.action}
              >
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-3">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center pt-0">
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 快速开始按钮 */}
          <div className="flex justify-center space-x-4 mt-12">
            <Button 
              size="lg" 
              className="h-12 px-8 text-base"
              onClick={() => navigate("/chat")}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              开始对话
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="h-12 px-8 text-base"
              onClick={() => navigate("/workspace")}
            >
              <PenTool className="w-5 h-5 mr-2" />
              专业创作
            </Button>
          </div>

          {/* 底部描述 */}
          <div className="text-center mt-16">
            <p className="text-sm text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Novel Writing AI 是一个集成了AI对话和专业创作工具的智能平台。
              无论是日常对话聊天，还是专业的小说创作、剧本编写，我们都能为您提供最好的支持。
              当系统检测到您有专业写作需求时，会自动为您切换到专业创作模式。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;