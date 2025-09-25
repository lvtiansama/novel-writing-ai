import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { Save, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { readFile, saveFile } from "@/lib/api";
import { DiffReviewDialog } from "./DiffReviewDialog";

interface TextEditorProps {
  selectedFile: string | null;
  onModifiedChange?: (filePath: string, isModified: boolean) => void;
}

export type TextEditorHandle = {
  save: () => Promise<boolean>;
  getContent: () => string;
  isModified: () => boolean;
  reload: () => Promise<void>;
  highlightLines: (lines: number[]) => void;
  setPendingDiffData: (data: { oldContent: string; newContent: string; fileName: string; filePath?: string } | null) => void;
};

export const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(({ selectedFile, onModifiedChange }, ref) => {
  const [content, setContent] = useState("");
  const [isModified, setIsModified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [highlightedLines, setHighlightedLines] = useState<number[]>([]);
  const [highlightAnimation, setHighlightAnimation] = useState(false);
  const [lastModifiedContent, setLastModifiedContent] = useState<string>("");
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [diffInfo, setDiffInfo] = useState<{
    addedLines: number[];
    modifiedLines: number[];
    deletedLines: number[];
  } | null>(null);
  const [pendingDiffData, setPendingDiffData] = useState<{
    oldContent: string;
    newContent: string;
    fileName: string;
    filePath?: string;
  } | null>(null);
  const [lineNumbers, setLineNumbers] = useState<(number | null)[]>([]);

  // 滚动同步函数
  const syncScroll = (source: HTMLElement, target: HTMLElement) => {
    target.scrollTop = source.scrollTop;
  };

  // 更新行号
  const updateLineNumbers = () => {
    const newLineNumbers = getLineNumbers();
    console.log('Line numbers:', newLineNumbers);
    setLineNumbers(newLineNumbers);
  };

  // 计算文件差异
  const calculateDiff = (oldContent: string, newContent: string) => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const addedLines: number[] = [];
    const modifiedLines: number[] = [];
    const deletedLines: number[] = [];
    
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (i >= oldLines.length) {
        // 新增的行
        addedLines.push(i + 1);
      } else if (i >= newLines.length) {
        // 删除的行
        deletedLines.push(i + 1);
      } else if (oldLine !== newLine) {
        // 修改的行
        modifiedLines.push(i + 1);
      }
    }
    
    return { addedLines, modifiedLines, deletedLines };
  };

  // 处理文本区域滚动
  const handleTextareaScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      syncScroll(textareaRef.current, lineNumbersRef.current);
    }
  };

  // 处理行号区域滚动
  const handleLineNumbersScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      syncScroll(lineNumbersRef.current, textareaRef.current);
    }
  };

  // 加载文件内容
  const loadFileContent = async (filePath: string, isAutoRefresh = false) => {
    if (isAutoRefresh) {
      setIsAutoRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const newContent = await readFile(filePath);
      
      // 如果是自动刷新且内容有变化，保存旧内容用于比较
      if (isAutoRefresh && newContent !== content) {
        setLastModifiedContent(content);
        // 计算差异信息
        const diff = calculateDiff(content, newContent);
        setDiffInfo(diff);
      }
      
      setContent(newContent);
      setIsModified(false);
      setHighlightedLines([]); // 加载新文件时清除高亮
      
      // 如果是自动刷新，显示通知
      if (isAutoRefresh && newContent !== content) {
        const diff = calculateDiff(lastModifiedContent || content, newContent);
        const totalChanges = diff.addedLines.length + diff.modifiedLines.length + diff.deletedLines.length;
        
        toast({
          title: "文件已更新",
          description: `${filePath.split('/').pop()} 已被AI修改并自动刷新 (${totalChanges}处变更)`,
        });
      }
    } catch (error) {
      console.error('Error loading file:', error);
      if (!isAutoRefresh) {
        toast({
          title: "加载失败",
          description: "无法加载文件内容",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsAutoRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile]);

  // 当内容变化时更新行号
  useEffect(() => {
    updateLineNumbers();
  }, [content]);

  // 当组件挂载后更新行号
  useEffect(() => {
    if (textareaRef.current) {
      updateLineNumbers();
    }
  }, []);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      updateLineNumbers();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (highlightAnimation) {
      const timer = setTimeout(() => {
        setHighlightAnimation(false);
        // 清除差异信息
        setTimeout(() => {
          setDiffInfo(null);
        }, 1000);
      }, 2000); // 动画持续时间
      return () => clearTimeout(timer);
    }
  }, [highlightAnimation]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setIsModified(true);
    if (selectedFile && onModifiedChange) {
      onModifiedChange(selectedFile, true);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    if (!selectedFile) return false;
    
    setIsLoading(true);
    try {
      const success = await saveFile(selectedFile, content);
      if (success) {
        toast({
          title: "文件已保存",
          description: `${selectedFile} 保存成功`,
        });
        setIsModified(false);
        if (selectedFile && onModifiedChange) {
          onModifiedChange(selectedFile, false);
        }
        return true;
      } else {
        toast({
          title: "保存失败",
          description: "无法保存文件，请检查网络连接",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error('Error saving file:', error);
      toast({
        title: "保存失败",
        description: "保存过程中发生错误",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    save: handleSave,
    getContent: () => content,
    isModified: () => isModified,
    reload: async () => {
      if (selectedFile) {
        await loadFileContent(selectedFile, true); // 标记为自动刷新
        setHighlightedLines([]); // 重新加载文件时清除高亮
      }
    },
    highlightLines: highlightLines,
    setPendingDiffData: setPendingDiffData,
  }));

  const getLineNumbers = () => {
    if (!textareaRef.current) {
      const lines = content.split('\n');
      return lines.map((_, index) => index + 1);
    }

    const textarea = textareaRef.current;
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;
    
    // 计算textarea内容的总高度
    const scrollHeight = textarea.scrollHeight;
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);
    
    // 计算实际内容高度（减去padding）
    const contentHeight = scrollHeight - paddingTop - paddingBottom;
    
    // 计算总视觉行数（基于实际渲染高度）
    const totalVisualLines = Math.max(1, Math.ceil(contentHeight / lineHeight));
    
    // 获取逻辑行（由换行符分隔）
    const logicalLines = content.split('\n');
    
    // 创建行号数组，只有逻辑行的第一行显示行号
    const lineNumbers = [];
    
    for (let i = 0; i < logicalLines.length; i++) {
      const logicalLine = logicalLines[i];
      
      // 计算这个逻辑行需要多少视觉行
      let visualLinesForThisLogicalLine = 1; // 至少一行
      
      if (logicalLine.length > 0) {
        // 创建一个隐藏的div来测量文本
        const measureDiv = document.createElement('div');
        measureDiv.style.position = 'absolute';
        measureDiv.style.visibility = 'hidden';
        measureDiv.style.whiteSpace = 'pre-wrap';
        measureDiv.style.wordWrap = 'break-word';
        measureDiv.style.fontSize = computedStyle.fontSize;
        measureDiv.style.fontFamily = computedStyle.fontFamily;
        measureDiv.style.fontWeight = computedStyle.fontWeight;
        measureDiv.style.letterSpacing = computedStyle.letterSpacing;
        measureDiv.style.width = `${textarea.clientWidth - parseFloat(computedStyle.paddingLeft) - parseFloat(computedStyle.paddingRight)}px`;
        measureDiv.textContent = logicalLine;
        
        document.body.appendChild(measureDiv);
        const measuredHeight = measureDiv.offsetHeight;
        document.body.removeChild(measureDiv);
        
        visualLinesForThisLogicalLine = Math.max(1, Math.ceil(measuredHeight / lineHeight));
      }
      
      // 为这个逻辑行的每一视觉行添加行号
      for (let j = 0; j < visualLinesForThisLogicalLine; j++) {
        if (j === 0) {
          // 第一行显示行号
          lineNumbers.push(i + 1);
        } else {
          // 后续行不显示行号（用null表示）
          lineNumbers.push(null);
        }
      }
    }
    
    return lineNumbers;
  };

  const highlightLines = (lines: number[]) => {
    setHighlightedLines(lines);
    setHighlightAnimation(true);
    
    // 自动滚动到第一个高亮行
    if (lines.length > 0 && textareaRef.current) {
      const firstLine = Math.min(...lines);
      const lineHeight = 24; // 1.5rem = 24px
      const scrollTop = (firstLine - 1) * lineHeight;
      
      // 平滑滚动到目标位置
      textareaRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  };

  // 获取行号样式类名
  const getLineNumberClassName = (lineNumber: number | null) => {
    let className = 'h-6 px-2 text-right text-sm flex items-center justify-end';
    
    // 如果没有行号（自动换行的后续行），只显示空白
    if (lineNumber === null || lineNumber === 0) {
      return className;
    }
    
    if (diffInfo) {
      if (diffInfo.addedLines.includes(lineNumber)) {
        className += ' bg-green-500/20 border-l-2 border-green-500';
      } else if (diffInfo.modifiedLines.includes(lineNumber)) {
        className += ' bg-yellow-500/20 border-l-2 border-yellow-500';
      } else if (diffInfo.deletedLines.includes(lineNumber)) {
        className += ' bg-red-500/20 border-l-2 border-red-500';
      }
    } else if (highlightedLines.includes(lineNumber)) {
      className += ' bg-highlight-line';
    }
    
    return className;
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
          {isLoading && <span className="text-xs text-muted-foreground">加载中...</span>}
          {isAutoRefreshing && <span className="text-xs text-primary animate-pulse">AI更新中...</span>}
          {diffInfo && (
            <div className="flex items-center space-x-2 text-xs">
              {diffInfo.addedLines.length > 0 && (
                <span className="px-2 py-1 bg-green-500/20 text-green-600 rounded">
                  +{diffInfo.addedLines.length}
                </span>
              )}
              {diffInfo.modifiedLines.length > 0 && (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded">
                  ~{diffInfo.modifiedLines.length}
                </span>
              )}
              {diffInfo.deletedLines.length > 0 && (
                <span className="px-2 py-1 bg-red-500/20 text-red-600 rounded">
                  -{diffInfo.deletedLines.length}
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!isModified || isLoading}
          size="sm"
          className="bg-primary hover:bg-primary/90"
        >
          <Save className="w-4 h-4 mr-2" />
          保存
        </Button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div 
          ref={lineNumbersRef}
          className="w-12 bg-muted/20 border-r border-border text-xs text-editor-line-number select-none font-mono"
          onScroll={handleLineNumbersScroll}
          style={{ 
            overflowY: 'hidden',
            whiteSpace: 'pre',
            lineHeight: '1.5rem',
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
            fontSize: '0.875rem' // 确保字体大小与textarea一致
          }}
        >
          {lineNumbers.map((num, index) => (
            <div key={index} className={getLineNumberClassName(num || 0)}>
              {num || ''}
            </div>
          ))}
        </div>
        
        <div className="flex-1 editor-scroll-container">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onScroll={handleTextareaScroll}
            className="w-full h-full bg-transparent text-foreground resize-none outline-none font-mono text-sm"
            style={{ 
              lineHeight: '1.5rem', 
              minHeight: '100%', 
              height: 'auto', 
              padding: '0.75rem 1rem',
              fontSize: '0.875rem', // 确保字体大小与行号一致
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
            placeholder="开始您的创作..."
            spellCheck={false}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 差异审查对话框 */}
      <DiffReviewDialog
        open={!!pendingDiffData}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDiffData(null);
          }
        }}
        fileName={pendingDiffData?.fileName || ''}
        filePath={pendingDiffData?.filePath}
        oldContent={pendingDiffData?.oldContent || ''}
        newContent={pendingDiffData?.newContent || ''}
        onAcceptAll={async () => {
          setPendingDiffData(null);
          // 接受修改时，重新加载文件以显示修改后的内容
          if (selectedFile) {
            await loadFileContent(selectedFile, true);
          }
          toast({
            title: "已接受所有修改",
            description: "所有AI修改已被接受并应用",
          });
        }}
        onRejectAll={async () => {
          setPendingDiffData(null);
          // 重新加载文件以显示恢复后的内容
          if (selectedFile) {
            await loadFileContent(selectedFile, true);
          }
          toast({
            title: "已拒绝所有修改",
            description: "文件已恢复到修改前的状态",
          });
        }}
        onAcceptChanges={async (acceptedLines) => {
          setPendingDiffData(null);
          // 部分接受时，重新加载文件以显示修改后的内容
          if (selectedFile) {
            await loadFileContent(selectedFile, true);
          }
          toast({
            title: "已应用选中修改",
            description: `已应用选中的修改`,
          });
        }}
      />
    </div>
  );
});

TextEditor.displayName = "TextEditor";