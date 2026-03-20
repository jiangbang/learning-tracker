# Learning Tracker - 快速开始指南

## 前置要求

- Node.js 18+
- npm 或 pnpm
- Cloudflare 账号

## 安装步骤

### 1. 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 2. 配置 Cloudflare

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
cd backend
npx wrangler d1 create learning-tracker-db

# 复制输出的 database_id 到 backend/wrangler.toml
```

编辑 `backend/wrangler.toml`，将 `database_id` 替换为实际值：

```toml
[[d1_databases]]
binding = "DB"
database_name = "learning-tracker-db"
database_id = "你的 database_id"  # 替换这里
```

### 3. 初始化数据库

```bash
cd backend
npx wrangler d1 execute learning-tracker-db --file ../scripts/init-db.sql
```

### 4. 启动开发环境

```bash
# 方式一：同时启动前后端（推荐）
cd /root/.openclaw/workspace/projects/learning-tracker
npm run dev

# 方式二：分别启动
# 终端 1 - 后端
cd backend && npm run dev

# 终端 2 - 前端
cd frontend && npm run dev
```

访问 http://localhost:5173 查看应用

## 部署

### 部署后端

```bash
cd backend
npm run deploy
```

### 部署前端

```bash
cd frontend
npm run build
# 将 dist 目录部署到 Cloudflare Pages
```

## 项目结构

```
learning-tracker/
├── backend/           # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts   # 入口文件
│   │   ├── routes/    # API 路由
│   │   ├── db/        # 数据库操作
│   │   └── types.ts   # 类型定义
│   ├── wrangler.toml  # Workers 配置
│   └── package.json
│
├── frontend/          # React 前端
│   ├── src/
│   │   ├── pages/     # 页面组件
│   │   ├── components/# 可复用组件
│   │   ├── api/       # API 调用
│   │   └── App.tsx
│   └── package.json
│
├── scripts/           # 工具脚本
│   └── init-db.sql    # 数据库初始化
│
└── README.md
```

## API 端点

- `GET /api/goals` - 获取所有目标
- `POST /api/goals` - 创建目标
- `GET /api/goals/:id` - 获取目标详情
- `PUT /api/goals/:id` - 更新目标
- `DELETE /api/goals/:id` - 删除目标
- `GET /api/logs` - 获取打卡记录
- `POST /api/logs` - 创建打卡记录
- `GET /api/stats/calendar` - 获取日历数据
- `GET /api/stats/streak` - 获取连胜数据

## 常见问题

### Q: 如何重置数据库？
```bash
npx wrangler d1 execute learning-tracker-db --file ../scripts/init-db.sql
```

### Q: 本地开发时 API 请求失败？
确保后端服务在 http://localhost:8787 运行，前端已配置代理。

### Q: 如何查看数据库内容？
```bash
npx wrangler d1 execute learning-tracker-db --command "SELECT * FROM goals"
```
