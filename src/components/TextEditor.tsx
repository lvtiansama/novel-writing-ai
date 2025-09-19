import { useState, useEffect } from "react";
import { Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TextEditorProps {
  selectedFile: string | null;
}

export function TextEditor({ selectedFile }: TextEditorProps) {
  const [content, setContent] = useState("");
  const [isModified, setIsModified] = useState(false);
  const { toast } = useToast();

  // Mock file content - in a real app, this would fetch from the server
  const getFileContent = (filePath: string): string => {
    const mockContent: Record<string, string> = {
      "data/novels/西游记.md": `# 西游记

## 第一回 灵根孕育源流出 心性修持大道生

话说这美猴王，自从得了姓名，怡然踊跃，对菩提祖师朝上礼拜了四拜，口中念念有词地说：

"师父！弟子承蒙师父厚恩，蒙赐姓名，感恩不尽！乞师父传我些小法儿，早日成仙，也好报师父恩德！"

祖师道："你既然诚心求道，我就传你些道法。"

## 第二回 悟彻菩提真妙理 断魂摄魄归正道

美猴王学得了长生之道，躍身一跳，使个筋斗云，一去就有十万八千里路。

他这一筋斗云的本事，正是七十二变之外的又一项神通，叫做筋斗云。`,

      "data/characters/孙悟空.md": `# 孙悟空人物档案

## 基本信息
- **姓名**: 孙悟空
- **别称**: 美猴王、齐天大圣、斗战胜佛
- **出生地**: 花果山水帘洞
- **师父**: 菩提祖师、唐僧

## 主要技能
- **七十二变**: 可变化成各种形态
- **筋斗云**: 一跳十万八千里
- **火眼金睛**: 能识别真假善恶
- **金箍棒**: 如意神兵，重一万三千五百斤

## 性格特点
机智勇敢，嫉恶如仇，但有时急躁鲁莽。对师父忠诚，对妖怪无情。

## 经历概述
从石猴成长为美猴王，后拜师学艺，大闹天宫被压五行山下，最终保护唐僧西天取经，修成正果。`,

      "data/settings/config.json": `{
  "appName": "AI创作助手",
  "version": "1.0.0",
  "theme": "purple",
  "language": "zh-CN",
  "aiModel": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "editor": {
    "fontSize": 14,
    "lineNumbers": true,
    "wordWrap": true,
    "theme": "dark"
  }
}`,

      "data/readme.md": `# AI创作助手

这是一个基于AI的创作助手工具，帮助您更好地进行文学创作和内容管理。

## 功能特性

- 📁 文件管理：支持多级目录结构
- ✏️ 文本编辑：内置文本编辑器，支持Markdown
- 🤖 AI对话：集成LLM模型，提供创作建议
- 💾 自动保存：实时保存您的创作内容

## 使用说明

1. 在左侧文件浏览器中选择或创建文件
2. 在中间编辑器中编辑内容
3. 使用右侧AI助手获取创作建议
4. 点击保存按钮保存您的工作

开始您的创作之旅吧！`
    };

    return mockContent[filePath] || `# ${filePath.split('/').pop()}

这是一个新文件，开始您的创作吧！`;
  };

  useEffect(() => {
    if (selectedFile) {
      const fileContent = getFileContent(selectedFile);
      setContent(fileContent);
      setIsModified(false);
    }
  }, [selectedFile]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsModified(true);
  };

  const handleSave = () => {
    // In a real app, this would save to the server
    console.log(`Saving file: ${selectedFile}`, content);
    toast({
      title: "文件已保存",
      description: `${selectedFile} 保存成功`,
    });
    setIsModified(false);
  };

  const getLineNumbers = () => {
    const lines = content.split('\n');
    return lines.map((_, index) => index + 1);
  };

  if (!selectedFile) {
    return (
      <div className="flex-1 bg-editor-bg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">选择一个文件开始编辑</p>
          <p className="text-sm">在左侧文件浏览器中点击文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-editor-bg flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">{selectedFile.split('/').pop()}</span>
          {isModified && <span className="text-xs text-accent">●</span>}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isModified}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
      </div>
      
      <div className="flex-1 flex">
        <div className="w-12 bg-muted/20 border-r border-border flex flex-col text-center text-xs text-editor-line-number select-none">
          {getLineNumbers().map(num => (
            <div key={num} className="h-6 leading-6 px-2">
              {num}
            </div>
          ))}
        </div>
        
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full h-full p-4 bg-transparent text-foreground resize-none outline-none font-mono text-sm leading-6"
            placeholder="开始您的创作..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}