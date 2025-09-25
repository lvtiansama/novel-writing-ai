import { useRef, useState, useEffect } from "react";
import { TitleBar, type EditorTab } from "@/components/TitleBar";
import { FileExplorer } from "@/components/FileExplorer";
import { TextEditor, type TextEditorHandle } from "@/components/TextEditor";
import { ChatInterface, ChatInterfaceHandle } from "@/components/ChatInterface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const editorRef = useRef<TextEditorHandle>(null);
  const [explorerReloadKey, setExplorerReloadKey] = useState(0);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const chatInterfaceRef = useRef<ChatInterfaceHandle>(null); // 用于引用ChatInterface组件
  const [pendingExit, setPendingExit] = useState(false); // 退出状态
  const [saveDialogOpen, setSaveDialogOpen] = useState(false); // 保存确认弹窗状态
  const [currentUnsavedTab, setCurrentUnsavedTab] = useState<EditorTab | null>(null); // 当前询问保存的文件
  const [unsavedTabsQueue, setUnsavedTabsQueue] = useState<EditorTab[]>([]); // 未保存文件队列

  // 设置页面标题和渐入动画，并检查是否有待发送的用户消息
  useEffect(() => {
    document.title = "小白 创作助手";
    // 启动渐入动画
    const timer = setTimeout(() => setIsVisible(true), 50);
    
    // 检查localStorage中是否有待发送的用户消息
    const pendingMessage = localStorage.getItem('pendingUserMessage');
    if (pendingMessage) {
      console.log('[Index] 检测到待发送的用户消息:', pendingMessage);
      // 清除localStorage中的消息
      localStorage.removeItem('pendingUserMessage');
      
      // 延迟发送消息，确保页面完全加载
      setTimeout(() => {
        if (chatInterfaceRef.current && chatInterfaceRef.current.sendMessage) {
          console.log('[Index] 自动发送用户消息到写作模式');
          chatInterfaceRef.current.sendMessage(pendingMessage);
        }
      }, 1000); // 延迟1秒确保ChatInterface组件完全初始化
    }
    
    return () => clearTimeout(timer);
  }, []);

  // 处理退出逻辑
  const handleExit = async (): Promise<boolean> => {
    console.log('[Index] ===== handleExit函数被调用 =====');
    console.log('[Index] 开始处理退出逻辑');
    console.log('[Index] 当前所有tabs:', tabs.map(t => ({ title: t.title, path: t.path, isModified: t.isModified })));
    console.log('[Index] 当前选中文件:', selectedFile);
    console.log('[Index] 编辑器是否修改:', editorRef.current?.isModified());
    
    // 构建未保存文件列表
    const unsavedTabs: EditorTab[] = [];
    
    // 检查当前文件是否已修改
    if (selectedFile && editorRef.current?.isModified()) {
      const currentTab = tabs.find(tab => tab.path === selectedFile);
      if (currentTab) {
        unsavedTabs.push({ ...currentTab, isModified: true });
        console.log('[Index] 当前文件已修改:', currentTab.title);
      }
    }
    
    // 检查其他tabs中标记为已修改的文件
    const otherUnsavedTabs = tabs.filter(tab => tab.isModified && tab.path !== selectedFile);
    unsavedTabs.push(...otherUnsavedTabs);
    
    console.log('[Index] 发现的未保存文件:', unsavedTabs.map(t => t.title));
    
    if (unsavedTabs.length === 0) {
      console.log('[Index] 没有未保存的文件，直接退出');
      return true; // 没有未保存的文件，允许退出
    }
    
    console.log(`[Index] 发现 ${unsavedTabs.length} 个未保存的文件:`, unsavedTabs.map(t => t.title));
    
    // 设置未保存文件队列并开始处理
    setUnsavedTabsQueue(unsavedTabs);
    setCurrentUnsavedTab(unsavedTabs[0]);
    setSaveDialogOpen(true);
    
    // 返回false，表示需要等待用户处理保存确认
    console.log('[Index] 返回false，等待用户处理保存确认');
    return false;
  };

  // 处理保存确认
  const handleSaveConfirm = async (shouldSave: boolean) => {
    if (!currentUnsavedTab) return;
    
    if (shouldSave) {
      // 切换到该文件并保存
      setSelectedFile(currentUnsavedTab.path);
      await new Promise(resolve => setTimeout(resolve, 100)); // 等待文件切换
      const saved = await editorRef.current?.save();
      console.log(`[Index] 文件保存结果: ${saved ? '成功' : '失败'}`);
    }
    
    // 处理下一个文件
    const remainingTabs = unsavedTabsQueue.slice(1);
    setUnsavedTabsQueue(remainingTabs);
    
    if (remainingTabs.length > 0) {
      // 还有未保存的文件，继续询问
      setCurrentUnsavedTab(remainingTabs[0]);
    } else {
      // 所有文件处理完毕，关闭弹窗并退出
      setSaveDialogOpen(false);
      setCurrentUnsavedTab(null);
      console.log('[Index] 所有文件处理完毕，准备退出');
      
      // 延迟一下让状态更新完成，然后触发退出
      setTimeout(() => {
        console.log('[Index] 触发退出到对话界面');
        window.location.href = '/';
      }, 100);
    }
  };

  return (
    <div className={`h-screen bg-background flex flex-col transition-opacity duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      <TitleBar
        tabs={tabs}
        activePath={selectedFile}
        onSelectTab={(path) => setSelectedFile(path)}
        onCloseTab={(path) => {
          // 如果关闭的是当前活动标签，且有未保存修改，弹出确认
          if (selectedFile === path && editorRef.current?.isModified()) {
            setPendingClosePath(path);
          } else {
            setTabs(prev => prev.filter(t => t.path !== path));
            if (selectedFile === path) {
              // 切换到最后一个标签
              const remain = tabs.filter(t => t.path !== path);
              setSelectedFile(remain.length ? remain[remain.length - 1].path : null);
            }
          }
        }}
        onExit={handleExit}
      />
      <div className="flex-1 flex overflow-hidden">
        <FileExplorer 
          onFileSelect={(path) => {
            if (!path) return;
            setTabs(prev => {
              const exists = prev.find(t => t.path === path);
              if (exists) return prev;
              const title = path.split('/').pop() || path;
              return [...prev, { path, title }];
            });
            setSelectedFile(path);
          }} 
          selectedFile={selectedFile}
          reloadKey={explorerReloadKey}
        />
        <TextEditor
          ref={editorRef}
          selectedFile={selectedFile}
          onModifiedChange={(path, modified) => {
            setTabs(prev => prev.map(t => t.path === path ? { ...t, isModified: modified } : t));
          }}
        />
        <ChatInterface
          ref={chatInterfaceRef}
          selectedFile={selectedFile}
          getEditorContent={() => editorRef.current?.getContent()}
          onChangedFiles={(files, modifiedLines, diffData) => {
            // 刷新文件树
            setExplorerReloadKey(v => v + 1);
            
            // 如果当前文件被修改，触发重载并高亮显示修改的行
            if (selectedFile && files?.some(f => f === selectedFile)) {
              // 如果有diffData，显示审查对话框（不立即重载）
              if (diffData && diffData[selectedFile]) {
                setTimeout(() => {
                  const fileName = selectedFile.split('/').pop() || selectedFile;
                  editorRef.current?.setPendingDiffData({
                    oldContent: diffData[selectedFile].oldContent,
                    newContent: diffData[selectedFile].newContent,
                    fileName: fileName,
                    filePath: selectedFile.replace('data/', '') // 移除data/前缀
                  });
                }, 50);
              } else {
                // 没有diffData时，正常重载并高亮
                setTimeout(async () => {
                  await editorRef.current?.reload();
                  
                  // 如果有修改的行号信息，高亮显示这些行
                  if (modifiedLines && modifiedLines[selectedFile]) {
                    // 减少高亮延迟，确保内容已加载
                    setTimeout(() => {
                      editorRef.current?.highlightLines(modifiedLines[selectedFile]);
                    }, 50);
                  } else {
                    editorRef.current?.highlightLines([]);
                  }
                }, 100);
              }
            }
          }}
        />
      </div>

      {/* 关闭确认对话框 */}
      <AlertDialog open={!!pendingClosePath} onOpenChange={(open) => { if (!open) setPendingClosePath(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>是否保存对“{pendingClosePath?.split('/').pop()}”的更改？</AlertDialogTitle>
            <AlertDialogDescription>
              选择“保存”将写入磁盘。“不保存”将丢弃更改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingClosePath(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // 不保存
                const closePath = pendingClosePath;
                setPendingClosePath(null);
                if (!closePath) return;
                setTabs(prev => prev.filter(t => t.path !== closePath));
                if (selectedFile === closePath) {
                  const remain = tabs.filter(t => t.path !== closePath);
                  setSelectedFile(remain.length ? remain[remain.length - 1].path : null);
                }
              }}
              className="bg-muted text-foreground hover:bg-muted/80"
            >不保存</AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                // 保存并关闭
                const closePath = pendingClosePath;
                const ok = await editorRef.current?.save();
                if (ok && closePath) {
                  setTabs(prev => prev.filter(t => t.path !== closePath));
                  if (selectedFile === closePath) {
                    setSelectedFile(prev => {
                      const remain = tabs.filter(t => t.path !== closePath);
                      return remain.length ? remain[remain.length - 1].path : null;
                    });
                  }
                  setPendingClosePath(null);
                }
              }}
            >保存</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 退出时保存确认弹窗 */}
      <AlertDialog open={saveDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // 用户取消保存，清空队列
          setUnsavedTabsQueue([]);
          setCurrentUnsavedTab(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存文件</AlertDialogTitle>
            <AlertDialogDescription>
              文件 "{currentUnsavedTab?.title}" 有未保存的更改，是否要保存？
              {unsavedTabsQueue.length > 1 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  还有 {unsavedTabsQueue.length - 1} 个文件需要处理
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleSaveConfirm(false)}>
              不保存
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSaveConfirm(true)}>
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;

