# 使用ngrok转发项目指南

## 概述
这个项目已经配置好了ngrok支持，可以让其他人通过公网访问你的本地项目。

## 🎯 单域名解决方案（推荐）

如果你只有一个ngrok域名，可以使用代理方式：

### 1. 安装ngrok
- 访问 https://ngrok.com/ 注册账号
- 下载ngrok客户端并安装
- 或者使用包管理器：`npm install -g ngrok`

### 2. 启动项目
```bash
# 在项目根目录运行
start.bat
```
这会启动：
- 后端服务器（端口3001）
- 前端开发服务器（端口8080）

### 3. 只转发前端服务器
```bash
ngrok http 8080
```

### 4. 无需额外配置！
项目已经配置了代理，前端会自动将 `/api/*` 请求转发到本地的后端服务器（端口3001）。

### 5. 分享给其他人
将ngrok提供的前端URL分享给其他人即可。例如：
```
https://abc123.ngrok-free.app
```

## 🔄 双域名方案（备选）

如果你有两个ngrok域名，也可以使用传统方式：

### 转发两个服务
```bash
# 终端1：转发后端
ngrok http 3001

# 终端2：转发前端  
ngrok http 8080
```

### 配置前端连接后端
创建 `.env` 文件：
```
VITE_BACKEND_URL=https://你的后端ngrok地址
```

或使用URL参数：
```
https://你的前端ngrok地址?backend=https://你的后端ngrok地址
```

## 注意事项

1. **免费版限制**：ngrok免费版每次重启会生成新的URL
2. **安全性**：ngrok会暴露你的本地服务，请确保不要在生产环境使用
3. **性能**：通过ngrok访问会比本地访问慢一些
4. **稳定性**：免费版可能有连接限制

## 故障排除

### 如果前端无法连接后端
1. 检查后端ngrok是否正常运行
2. 确认 `.env` 文件中的 `VITE_BACKEND_URL` 设置正确
3. 重启前端开发服务器

### 如果ngrok连接失败
1. 检查网络连接
2. 确认ngrok账号状态
3. 尝试重启ngrok服务

## 示例配置

假设ngrok给你的URL是：
- 后端：`https://abc123.ngrok-free.app`
- 前端：`https://def456.ngrok-free.app`

那么 `.env` 文件应该包含：
```
VITE_BACKEND_URL=https://abc123.ngrok-free.app
```

然后分享 `https://def456.ngrok-free.app` 给其他人即可。
