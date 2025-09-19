import { Sparkles, Settings, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TitleBar() {
  return (
    <div className="h-12 bg-background border-b border-border px-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-primary rounded flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI 创作助手</h1>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          v1.0.0
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm">
          <HelpCircle className="w-4 h-4 mr-2" />
          帮助
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          设置
        </Button>
      </div>
    </div>
  );
}