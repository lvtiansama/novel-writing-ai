#!/bin/bash

# Novel Writing AI 启动脚本
# 用于Linux和Mac系统

echo "🚀 启动 Novel Writing AI 系统..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js"
    echo "   访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到npm，请先安装npm"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖包..."
    npm install
fi

# 创建data目录（如果不存在）
if [ ! -d "data" ]; then
    echo "📁 创建数据目录..."
    mkdir -p data
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚙️  创建环境配置文件..."
    cat > .env << EOF
# 服务器配置
PORT=3001
DEBUG_LLM=1

# AI服务配置（请替换为您的实际API密钥）
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 前端配置
VITE_API_BASE_URL=http://localhost:3001
EOF
    echo "📝 请编辑 .env 文件，添加您的API密钥"
fi

echo "🔧 启动后端服务器..."
# 启动后端服务器
node server.js &
SERVER_PID=$!

# 等待后端服务器启动
sleep 3

echo "🎨 启动前端开发服务器..."
# 启动前端开发服务器
npm run dev &
FRONTEND_PID=$!

echo "✅ 系统启动完成！"
echo "📱 前端地址: http://localhost:5173"
echo "🔌 后端API: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap 'echo "🛑 正在停止服务..."; kill $SERVER_PID $FRONTEND_PID; exit 0' INT

# 保持脚本运行
wait
