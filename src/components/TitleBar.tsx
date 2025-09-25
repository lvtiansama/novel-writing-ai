import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { X, Settings, HelpCircle, Sparkles, LogOut } from "lucide-react";

export interface EditorTab {
  path: string;
  title: string;
  isModified?: boolean;
}

interface TitleBarProps {
  tabs: EditorTab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onExit?: () => Promise<boolean>;
}

export function TitleBar({ tabs, activePath, onSelectTab, onCloseTab, onExit }: TitleBarProps) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      const saved = localStorage.getItem("lkeap_api_key") || localStorage.getItem("DEEPSEEK_API_KEY") || "";
      setApiKey(saved);
    }
  }, [settingsOpen]);

  const handleExit = async () => {
    console.log('[TitleBar] handleExit被调用');
    console.log('[TitleBar] onExit回调是否存在:', !!onExit);
    
    if (onExit) {
      try {
        console.log('[TitleBar] 调用onExit回调');
        const shouldExit = await onExit();
        console.log('[TitleBar] onExit回调执行完成，返回值:', shouldExit);
        
        // 只有当onExit返回true或undefined时才导航
        if (shouldExit !== false) {
          console.log('[TitleBar] 准备导航到对话界面');
          navigate("/");
        } else {
          console.log('[TitleBar] onExit返回false，取消退出');
        }
      } catch (error) {
        console.error('[TitleBar] 退出过程中发生错误:', error);
        // 即使有错误，也允许退出
        navigate("/");
      }
    } else {
      console.log('[TitleBar] 没有onExit回调，直接导航');
      navigate("/");
    }
  };

  return (
    <div className="h-12 bg-background border-b border-border px-2 flex items-center">
      <div className="flex items-center space-x-2 pr-2">
        <div className="w-6 h-6 bg-gradient-primary rounded flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-sm font-semibold text-foreground">小白创作助手</h1>
        <div className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v1.0.0</div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center h-8 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <div
              key={tab.path}
              className={cn(
                "group flex items-center h-7 rounded-md border mr-1 px-2 cursor-pointer select-none",
                tab.path === activePath
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
              )}
              onClick={() => onSelectTab(tab.path)}
              title={tab.path}
            >
              <span className="text-xs max-w-[160px] truncate">
                {tab.title}
              </span>
              {tab.isModified && <span className="ml-1 text-[8px] text-accent">●</span>}
              <button
                className="ml-2 p-0.5 rounded hover:bg-foreground/10 opacity-70 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.path); }}
                aria-label="关闭标签"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-1 pl-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setExitConfirmOpen(true)}
          title="退出到AI对话界面"
        >
          <LogOut className="w-4 h-4 mr-1" />
          退出
        </Button>
        <Button variant="ghost" size="sm">
          <HelpCircle className="w-4 h-4 mr-1" />
          帮助
        </Button>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              设置
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API 设置</DialogTitle>
              <DialogDescription>
                填写并保存腾讯云 DeepSeek API Key。保存在本地浏览器，仅用于本机调用。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm">API Key</label>
              <Input
                id="api-key-input"
                name="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="粘贴你的 API Key"
              />
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setSettingsOpen(false)}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  localStorage.setItem("lkeap_api_key", apiKey.trim());
                  setSettingsOpen(false);
                }}
                disabled={!apiKey.trim()}
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 退出确认弹窗 */}
      <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要退出写作模式吗？如果有未保存的文件，系统会提示您保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleExit}>
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}