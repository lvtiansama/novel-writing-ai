import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, CheckCircle, XCircle } from 'lucide-react';
import { restoreFile } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface DiffItem {
  lineNumber: number;
  oldContent: string;
  newContent: string;
  type: 'added' | 'modified' | 'deleted';
}

interface DiffReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  filePath?: string;
  oldContent: string;
  newContent: string;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptChanges: (acceptedLines: number[]) => void;
}

export function DiffReviewDialog({
  open,
  onOpenChange,
  fileName,
  filePath,
  oldContent,
  newContent,
  onAcceptAll,
  onRejectAll,
  onAcceptChanges
}: DiffReviewDialogProps) {
  const [acceptedLines, setAcceptedLines] = useState<Set<number>>(new Set());
  const [rejectedLines, setRejectedLines] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // 当对话框打开时重置状态
  React.useEffect(() => {
    if (open) {
      setAcceptedLines(new Set());
      setRejectedLines(new Set());
    }
  }, [open]);

  // 计算差异
  const calculateDiff = (): DiffItem[] => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffItems: DiffItem[] = [];
    
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      
      if (i >= oldLines.length) {
        // 新增的行
        diffItems.push({
          lineNumber: i + 1,
          oldContent: '',
          newContent: newLine,
          type: 'added'
        });
      } else if (i >= newLines.length) {
        // 删除的行
        diffItems.push({
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: '',
          type: 'deleted'
        });
      } else if (oldLine !== newLine) {
        // 修改的行
        diffItems.push({
          lineNumber: i + 1,
          oldContent: oldLine,
          newContent: newLine,
          type: 'modified'
        });
      }
    }
    
    return diffItems;
  };

  const diffItems = calculateDiff();

  const handleAcceptLine = (lineNumber: number) => {
    setAcceptedLines(prev => new Set([...prev, lineNumber]));
    setRejectedLines(prev => {
      const newSet = new Set(prev);
      newSet.delete(lineNumber);
      return newSet;
    });
  };

  const handleRejectLine = (lineNumber: number) => {
    setRejectedLines(prev => new Set([...prev, lineNumber]));
    setAcceptedLines(prev => {
      const newSet = new Set(prev);
      newSet.delete(lineNumber);
      return newSet;
    });
  };

  const handleAcceptAll = () => {
    const allLineNumbers = diffItems.map(item => item.lineNumber);
    setAcceptedLines(new Set(allLineNumbers));
    setRejectedLines(new Set());
    onAcceptAll();
  };

  const handleRejectAll = async () => {
    setRejectedLines(new Set(diffItems.map(item => item.lineNumber)));
    setAcceptedLines(new Set());
    
    // 如果有文件路径，恢复文件内容
    if (filePath) {
      try {
        const success = await restoreFile(filePath, oldContent);
        if (success) {
          toast({
            title: "已拒绝所有修改",
            description: "文件已恢复到修改前的状态",
          });
        } else {
          toast({
            title: "恢复失败",
            description: "无法恢复文件内容，请手动检查",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "恢复失败",
          description: "恢复文件时发生错误",
          variant: "destructive",
        });
      }
    }
    
    onRejectAll();
  };

  const handleApplySelected = async () => {
    // 计算需要应用的修改
    const acceptedItems = diffItems.filter(item => acceptedLines.has(item.lineNumber));
    const rejectedItems = diffItems.filter(item => rejectedLines.has(item.lineNumber));
    
    if (acceptedItems.length === 0 && rejectedItems.length === 0) {
      // 没有选择任何修改，直接关闭
      onOpenChange(false);
      return;
    }
    
    // 如果有拒绝的修改，需要恢复文件
    if (rejectedItems.length > 0 && filePath) {
      try {
        // 构建部分恢复的内容
        const newLines = newContent.split('\n');
        const oldLines = oldContent.split('\n');
        
        // 对于被拒绝的行，使用原始内容
        rejectedItems.forEach(item => {
          const lineIndex = item.lineNumber - 1;
          if (item.type === 'added') {
            // 如果是新增的行被拒绝，删除这行
            if (lineIndex < newLines.length) {
              newLines.splice(lineIndex, 1);
            }
          } else if (item.type === 'deleted') {
            // 如果是删除的行被拒绝，恢复这行
            if (lineIndex < oldLines.length) {
              newLines.splice(lineIndex, 0, oldLines[lineIndex]);
            }
          } else if (item.type === 'modified') {
            // 如果是修改的行被拒绝，恢复原始内容
            if (lineIndex < oldLines.length && lineIndex < newLines.length) {
              newLines[lineIndex] = oldLines[lineIndex];
            }
          }
        });
        
        const success = await restoreFile(filePath, newLines.join('\n'));
        if (!success) {
          toast({
            title: "应用修改失败",
            description: "无法应用选中的修改",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        toast({
          title: "应用修改失败",
          description: "应用修改时发生错误",
          variant: "destructive",
        });
        return;
      }
    }
    
    onAcceptChanges(Array.from(acceptedLines));
    onOpenChange(false);
  };

  const getTypeColor = (type: DiffItem['type']) => {
    switch (type) {
      case 'added': return 'bg-green-900/30 text-green-300 border-green-600';
      case 'modified': return 'bg-yellow-900/30 text-yellow-300 border-yellow-600';
      case 'deleted': return 'bg-red-900/30 text-red-300 border-red-600';
      default: return 'bg-gray-700 text-gray-300 border-gray-500';
    }
  };

  const getTypeIcon = (type: DiffItem['type']) => {
    switch (type) {
      case 'added': return '+';
      case 'modified': return '~';
      case 'deleted': return '-';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>审查AI修改：{fileName}</span>
            <Badge variant="outline" className="text-xs">
              {diffItems.length} 处变更
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 操作按钮 */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAcceptAll}
              className="text-green-600 hover:text-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              全部接受
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRejectAll}
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="w-4 h-4 mr-1" />
              全部拒绝
            </Button>
            <Button
              onClick={handleApplySelected}
              disabled={acceptedLines.size === 0 && rejectedLines.size === 0}
              size="sm"
            >
              应用选中 (接受:{acceptedLines.size} 拒绝:{rejectedLines.size})
            </Button>
          </div>

          {/* 差异对比 */}
          <ScrollArea className="h-96 border border-gray-600 rounded-md bg-gray-800">
            <div className="p-4 space-y-2">
              {diffItems.map((item) => (
                <div
                  key={item.lineNumber}
                  className={`border rounded-lg p-3 ${
                    acceptedLines.has(item.lineNumber)
                      ? 'bg-green-900/20 border-green-600'
                      : rejectedLines.has(item.lineNumber)
                      ? 'bg-red-900/20 border-red-600'
                      : 'bg-gray-800 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getTypeColor(item.type)}`}>
                        {getTypeIcon(item.type)} 第 {item.lineNumber} 行
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {item.type === 'added' && '新增'}
                        {item.type === 'modified' && '修改'}
                        {item.type === 'deleted' && '删除'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAcceptLine(item.lineNumber)}
                        className={`h-6 px-2 ${
                          acceptedLines.has(item.lineNumber)
                            ? 'text-green-400 bg-green-900/30'
                            : 'text-gray-400 hover:text-green-400'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRejectLine(item.lineNumber)}
                        className={`h-6 px-2 ${
                          rejectedLines.has(item.lineNumber)
                            ? 'text-red-400 bg-red-900/30'
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {item.type !== 'added' && (
                      <div className="bg-red-900/20 border border-red-600 rounded p-2">
                        <div className="text-xs text-red-400 mb-1">修改前：</div>
                        <div className="text-sm font-mono text-red-300">
                          {item.oldContent || '(空行)'}
                        </div>
                      </div>
                    )}
                    {item.type !== 'deleted' && (
                      <div className="bg-green-900/20 border border-green-600 rounded p-2">
                        <div className="text-xs text-green-400 mb-1">修改后：</div>
                        <div className="text-sm font-mono text-green-300">
                          {item.newContent || '(空行)'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
