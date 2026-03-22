# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

学习时长追踪器（Learning Tracker），帮助用户追踪长期学习目标的完成进度。部署在 Cloudflare 生态（Pages + Workers + D1）。线上域名：keeprecord.shop（API: api.keeprecord.shop）。

## 常用命令

```bash
# 安装所有依赖（根目录 + backend + frontend）
npm run install:all

# 同时启动前后端开发服务器
npm run dev

# 单独启动
npm run dev:backend    # Wrangler dev server, port 8787
npm run dev:frontend   # Vite dev server, port 5173

# 构建
npm run build

# 数据库
npm run db:create      # 创建 D1 数据库
npm run db:init        # 执行 scripts/init-db.sql 初始化表结构
cd backend && npm run db:seed  # 填充测试数据

# 部署后端到 Cloudflare Workers
npm run deploy
```

## 架构

**Monorepo 结构**，根目录 package.json 用 `concurrently` 协调前后端。

### 后端 (`backend/`)
- **Hono** 框架运行在 Cloudflare Workers
- **D1**（SQLite）数据库，binding 名为 `DB`
- 路由挂载在 `src/index.ts`，按功能拆分到 `src/routes/`：
  - `goals.ts` / `logs.ts` / `stats.ts` — 核心业务
  - `auth.ts` — Google OAuth 认证
  - `users.ts` / `subscription.ts` / `payment.ts` — 用户与 PayPal 支付
- 数据库查询集中在 `src/db/queries.ts` 和 `src/db/user-queries.ts`
- 类型定义在 `src/types.ts`
- 配置在 `wrangler.toml`，secrets 通过 `wrangler secret put` 设置

### 前端 (`frontend/`)
- **React 18 + TypeScript + Vite**
- **TailwindCSS** 样式，**TanStack Query** 数据请求，**Zustand** 状态管理
- 路由：`/`（首页目标列表）、`/goal/:id`（目标详情）、`/auth-callback`（OAuth 回调）、`/profile`
- API 客户端集中在 `src/api/index.ts`，生产环境直连 `api.keeprecord.shop`
- 开发时 Vite proxy 将 `/api` 转发到 localhost:8787
- 认证状态通过 `src/contexts/AuthContext.tsx` 管理，token 存 localStorage
- 部署到 Cloudflare Pages，`functions/api/[[path]].ts` 为 Pages Functions 代理

### 数据库表
- `goals` — 学习目标（name, total_hours）
- `logs` — 打卡记录（goal_id, hours, date, note），有 goal_date 和 date 索引
- 用户相关表见 `scripts/migrate_add_paypal.sql`

## API 响应格式

所有 API 返回统一格式：`{ success: boolean, data?: T, error?: string }`

## 注意事项

- 前后端类型定义在 `backend/src/types.ts` 和 `frontend/src/api/index.ts` 中各维护一份，修改时需同步
- Wrangler secrets（GOOGLE_CLIENT_SECRET, PAYPAL_CLIENT_SECRET 等）不在代码中，通过 `wrangler secret put` 管理
