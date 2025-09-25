# Novel Writing AI Dockerfile
# 多阶段构建，优化镜像大小

# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 阶段2: 构建最终镜像
FROM node:18-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache \
    git

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 从构建阶段复制前端构建文件
COPY --from=frontend-builder /app/dist ./dist

# 复制后端代码
COPY server.js ./
COPY prompts/ ./prompts/

# 创建数据目录
RUN mkdir -p data

# 复制启动脚本
COPY start.sh ./
RUN chmod +x start.sh


# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S novelai -u 1001

# 设置目录权限
RUN chown -R novelai:nodejs /app
USER novelai

# 暴露端口
EXPOSE 3001 5173

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]
