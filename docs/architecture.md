# Novel Writing AI 架构文档

## 系统架构概览

### 整体架构图

```mermaid
graph TB
    subgraph "用户层 User Layer"
        U1[Web浏览器]
        U2[移动端浏览器]
        U3[桌面应用]
    end
    
    subgraph "前端层 Frontend Layer"
        F1[React 18 + TypeScript]
        F2[Vite 构建工具]
        F3[shadcn-ui 组件库]
        F4[Tailwind CSS]
        F5[React Router]
        F6[React Query]
    end
    
    subgraph "API网关层 API Gateway"
        G1[Nginx 反向代理]
        G2[负载均衡]
        G3[SSL终止]
    end
    
    subgraph "后端服务层 Backend Services"
        B1[Express.js API服务器]
        B2[文件管理服务]
        B3[用户认证服务]
        B4[WebSocket服务]
    end
    
    subgraph "AI代理层 AI Agent Layer"
        A1[主Agent - 创作协调]
        A2[角色Agent - 角色管理]
        A3[情节Agent - 情节设计]
        A4[世界观Agent - 设定管理]
        A5[Agno框架]
        A6[FastAPI服务]
    end
    
    subgraph "数据层 Data Layer"
        D1[本地文件系统]
        D2[Markdown文件]
        D3[JSON配置文件]
        D4[用户数据]
    end
    
    subgraph "外部服务 External Services"
        E1[OpenAI API]
        E2[DeepSeek API]
        E3[其他AI服务]
    end
    
    U1 --> F1
    U2 --> F1
    U3 --> F1
    
    F1 --> G1
    G1 --> B1
    
    B1 --> A1
    A1 --> A2
    A1 --> A3
    A1 --> A4
    
    A1 --> E1
    A1 --> E2
    A1 --> E3
    
    B1 --> D1
    D1 --> D2
    D1 --> D3
    D1 --> D4
```

## 详细架构说明

### 1. 前端架构

#### 技术栈
- **React 18**: 现代化的前端框架，支持并发特性
- **TypeScript**: 提供类型安全和更好的开发体验
- **Vite**: 快速的构建工具和开发服务器
- **shadcn-ui**: 高质量的UI组件库
- **Tailwind CSS**: 实用优先的CSS框架
- **React Router**: 客户端路由管理
- **React Query**: 服务端状态管理和缓存

#### 组件架构

```mermaid
graph TD
    subgraph "页面组件 Pages"
        P1[Index - 主页]
        P2[ChatHome - 聊天主页]
        P3[KeySettings - 密钥设置]
        P4[Welcome - 欢迎页]
        P5[NotFound - 404页面]
    end
    
    subgraph "业务组件 Components"
        C1[ChatInterface - 聊天界面]
        C2[FileExplorer - 文件浏览器]
        C3[TextEditor - 文本编辑器]
        C4[TitleBar - 标题栏]
        C5[DiffReviewDialog - 差异审查对话框]
    end
    
    subgraph "UI组件库 UI Components"
        U1[Button - 按钮]
        U2[Input - 输入框]
        U3[Dialog - 对话框]
        U4[Card - 卡片]
        U5[Toast - 提示]
    end
    
    subgraph "工具库 Utils"
        T1[API客户端]
        T2[工具函数]
        T3[类型定义]
    end
    
    P1 --> C1
    P1 --> C2
    P1 --> C3
    
    C1 --> U1
    C1 --> U2
    C1 --> U3
    
    C1 --> T1
    C2 --> T1
    C3 --> T1
```

### 2. 后端架构

#### 服务架构

```mermaid
graph LR
    subgraph "Express.js 服务器"
        S1[中间件层]
        S2[路由层]
        S3[控制器层]
        S4[服务层]
        S5[数据访问层]
    end
    
    subgraph "API端点"
        A1[文件管理API]
        A2[聊天API]
        A3[角色管理API]
        A4[用户认证API]
        A5[WebSocket API]
    end
    
    subgraph "中间件"
        M1[CORS中间件]
        M2[认证中间件]
        M3[日志中间件]
        M4[错误处理中间件]
    end
    
    S1 --> M1
    S1 --> M2
    S1 --> M3
    S1 --> M4
    
    S2 --> A1
    S2 --> A2
    S2 --> A3
    S2 --> A4
    S2 --> A5
```

#### 文件管理服务

```mermaid
graph TD
    subgraph "文件管理服务"
        F1[文件读取]
        F2[文件写入]
        F3[文件创建]
        F4[文件删除]
        F5[文件重命名]
        F6[目录管理]
    end
    
    subgraph "安全层"
        S1[路径验证]
        S2[权限检查]
        S3[文件类型检查]
        S4[大小限制]
    end
    
    subgraph "存储层"
        ST1[本地文件系统]
        ST2[Markdown文件]
        ST3[JSON配置文件]
        ST4[用户数据]
    end
    
    F1 --> S1
    F2 --> S1
    F3 --> S1
    F4 --> S1
    F5 --> S1
    F6 --> S1
    
    S1 --> ST1
    ST1 --> ST2
    ST1 --> ST3
    ST1 --> ST4
```

### 3. AI代理架构

#### 多Agent协作架构

```mermaid
graph TB
    subgraph "主Agent - 创作协调"
        M1[任务分解]
        M2[Agent调度]
        M3[结果整合]
        M4[质量控制]
    end
    
    subgraph "角色Agent - 角色管理"
        C1[角色创建]
        C2[角色分析]
        C3[角色关系]
        C4[角色发展]
    end
    
    subgraph "情节Agent - 情节设计"
        P1[情节规划]
        P2[冲突设计]
        P3[节奏控制]
        P4[伏笔管理]
    end
    
    subgraph "世界观Agent - 设定管理"
        W1[世界构建]
        W2[规则设定]
        W3[历史背景]
        W4[文化体系]
    end
    
    subgraph "Agno框架"
        A1[Agent注册]
        A2[消息传递]
        A3[状态管理]
        A4[生命周期管理]
    end
    
    M1 --> C1
    M1 --> P1
    M1 --> W1
    
    M2 --> C2
    M2 --> P2
    M2 --> W2
    
    M3 --> C3
    M3 --> P3
    M3 --> W3
    
    M4 --> C4
    M4 --> P4
    M4 --> W4
    
    A1 --> M1
    A2 --> M2
    A3 --> M3
    A4 --> M4
```

#### AI服务集成

```mermaid
graph LR
    subgraph "AI代理服务"
        AI1[Agno框架]
        AI2[FastAPI服务]
        AI3[WebSocket连接]
    end
    
    subgraph "外部AI服务"
        E1[OpenAI GPT]
        E2[DeepSeek]
        E3[Anthropic Claude]
        E4[Google Gemini]
    end
    
    subgraph "提示词管理"
        P1[角色提示词]
        P2[情节提示词]
        P3[世界观提示词]
        P4[对话提示词]
    end
    
    AI1 --> E1
    AI1 --> E2
    AI1 --> E3
    AI1 --> E4
    
    AI2 --> P1
    AI2 --> P2
    AI2 --> P3
    AI2 --> P4
```

### 4. 数据流架构

#### 用户交互流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端API
    participant A as AI Agent
    participant FS as 文件系统
    
    U->>F: 创建角色请求
    F->>B: POST /api/characters
    B->>A: 调用角色Agent
    A->>A: 生成角色信息
    A->>B: 返回角色数据
    B->>FS: 保存角色文件
    FS->>B: 确认保存
    B->>F: 返回成功响应
    F->>U: 显示创建结果
    
    U->>F: 编辑章节内容
    F->>B: PUT /api/files/chapter1.md
    B->>FS: 更新文件内容
    FS->>B: 确认更新
    B->>F: 返回更新结果
    F->>U: 显示保存状态
```

#### AI协作流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant M as 主Agent
    participant C as 角色Agent
    participant P as 情节Agent
    participant W as 世界观Agent
    
    U->>M: 创作请求
    M->>M: 分析任务需求
    M->>C: 获取角色信息
    C->>M: 返回角色数据
    M->>W: 获取世界观设定
    W->>M: 返回世界设定
    M->>P: 生成情节建议
    P->>M: 返回情节方案
    M->>M: 整合所有信息
    M->>U: 返回创作建议
```

### 5. 部署架构

#### 容器化部署

```mermaid
graph TB
    subgraph "Docker容器"
        D1[前端容器]
        D2[后端容器]
        D3[AI代理容器]
        D4[Nginx容器]
    end
    
    subgraph "Docker Compose"
        DC1[服务编排]
        DC2[网络配置]
        DC3[卷挂载]
        DC4[环境变量]
    end
    
    subgraph "外部服务"
        E1[OpenAI API]
        E2[DeepSeek API]
        E3[文件存储]
    end
    
    DC1 --> D1
    DC1 --> D2
    DC1 --> D3
    DC1 --> D4
    
    D1 --> E3
    D2 --> E3
    D3 --> E1
    D3 --> E2
```

#### 云部署架构

```mermaid
graph TB
    subgraph "负载均衡器"
        LB[Nginx/ALB]
    end
    
    subgraph "应用服务器"
        AS1[前端服务器1]
        AS2[前端服务器2]
        BS1[后端服务器1]
        BS2[后端服务器2]
    end
    
    subgraph "AI服务集群"
        AI1[AI代理1]
        AI2[AI代理2]
        AI3[AI代理3]
    end
    
    subgraph "数据存储"
        FS[文件存储]
        DB[数据库]
        CACHE[缓存]
    end
    
    LB --> AS1
    LB --> AS2
    LB --> BS1
    LB --> BS2
    
    BS1 --> AI1
    BS2 --> AI2
    BS1 --> AI3
    
    BS1 --> FS
    BS2 --> FS
    BS1 --> DB
    BS2 --> DB
    BS1 --> CACHE
    BS2 --> CACHE
```

## 技术选型说明

### 前端技术选型

1. **React 18**: 选择React是因为其生态丰富、社区活跃，18版本提供了并发特性，提升用户体验
2. **TypeScript**: 提供类型安全，减少运行时错误，提升开发效率
3. **Vite**: 相比Webpack更快的构建速度，更好的开发体验
4. **shadcn-ui**: 高质量的组件库，可定制性强
5. **Tailwind CSS**: 实用优先的CSS框架，开发效率高

### 后端技术选型

1. **Node.js + Express**: JavaScript全栈开发，前后端技术栈统一
2. **文件系统存储**: 简单直接，适合个人项目，易于备份和迁移
3. **CORS支持**: 支持跨域请求，便于前后端分离部署

### AI代理技术选型

1. **Agno框架**: 专门为多Agent协作设计的框架
2. **FastAPI**: 高性能的Python Web框架，适合AI服务
3. **多Agent架构**: 职责分离，提高系统的可维护性和扩展性

### 部署技术选型

1. **Docker**: 容器化部署，环境一致性
2. **Docker Compose**: 服务编排，简化部署流程
3. **Nginx**: 反向代理，负载均衡，SSL终止

## 性能优化策略

### 前端优化

1. **代码分割**: 使用React.lazy()进行路由级别的代码分割
2. **缓存策略**: 使用React Query进行数据缓存
3. **图片优化**: 使用WebP格式，懒加载
4. **Bundle优化**: 使用Vite的代码分割和Tree Shaking

### 后端优化

1. **文件缓存**: 实现文件内容缓存，减少磁盘IO
2. **API缓存**: 使用Redis缓存频繁访问的数据
3. **压缩**: 启用Gzip压缩，减少传输数据量
4. **连接池**: 使用连接池管理数据库连接

### AI服务优化

1. **请求批处理**: 批量处理AI请求，提高效率
2. **结果缓存**: 缓存AI生成的结果，避免重复计算
3. **异步处理**: 使用异步处理长时间运行的AI任务
4. **负载均衡**: 多个AI代理实例，提高并发处理能力

## 安全考虑

### 数据安全

1. **文件路径验证**: 防止目录遍历攻击
2. **文件类型检查**: 限制可上传的文件类型
3. **大小限制**: 限制文件大小，防止资源耗尽
4. **权限控制**: 实现用户权限管理

### API安全

1. **CORS配置**: 正确配置跨域资源共享
2. **请求验证**: 验证所有输入数据
3. **错误处理**: 不暴露敏感信息
4. **日志记录**: 记录安全相关事件

### AI服务安全

1. **API密钥管理**: 安全存储和使用API密钥
2. **输入过滤**: 过滤恶意输入，防止提示词注入
3. **输出验证**: 验证AI输出内容的安全性
4. **访问控制**: 限制AI服务的访问权限
