import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const KeySettings = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // 从localStorage加载已保存的 key 
    const savedKey = localStorage.getItem("lkeap_api_key") || localStorage.getItem("DEEPSEEK_API_KEY") || "";
    setApiKey(savedKey);
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setSaveStatus('error');
      return;
    }

    setIsLoading(true);
    setSaveStatus('idle');

    try {
      // 保存到localStorage
      localStorage.setItem("lkeap_api_key", apiKey.trim());
      
      // 简单验证 key 格式（DeepSeek  key 通常以sk-开头）
      if (!apiKey.trim().startsWith('sk-') && !apiKey.trim().startsWith('test')) {
        console.warn(' key 格式可能不正确，但允许保存');
      }
      
      setSaveStatus('success');
      
      // 延迟一下让用户看到成功状态，然后跳转
      setTimeout(() => {
        navigate("/");
      }, 1500);
      
    } catch (error) {
      console.error('保存 key 失败:', error);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            设置 Key
          </h1>
          <p className="text-muted-foreground text-sm">
            配置您的 Key 以开始使用
          </p>
        </div>

        {/* 主要内容 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg"> key  配置</CardTitle>
            <CardDescription>
              请输入您的 Key。此信息仅保存在您的本地浏览器中。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="api-key" className="text-sm font-medium">
                 key 
              </label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入您的  key "
                className="w-full"
                disabled={isLoading}
              />
            </div>

            {/* 状态提示 */}
            {saveStatus === 'success' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                   key  保存成功！正在跳转到聊天界面...
                </AlertDescription>
              </Alert>
            )}

            {saveStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {apiKey.trim() ? '保存失败，请重试' : '请输入有效的  key '}
                </AlertDescription>
              </Alert>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4">
              {/* <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button> */}
              <Button
                onClick={handleSave}
                disabled={!apiKey.trim() || isLoading}
                className="flex-1"
              >
                {isLoading ? '保存中...' : '保存并开始'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 帮助信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            不知道如何获取key？那我也没办法
            {/* <a 
              href="https://cloud.tencent.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline ml-1"
            >
              腾讯云 DeepSeek 官网
            </a> */}
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeySettings;
