# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

学习时长追踪器（Learning Tracker），帮助用户追踪长期学习目标的完成进度。部署在 Cloudflare 生态（Pages + Workers + D1）。

- 前端域名：https://www.keeprecord.shop
- 后端 API：https://api.keeprecord.shop
- 开发环境：前端 localhost:5173，后端 localhost:8787

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
- 入口 `src/index.ts`，配置 CORS 中间件，挂载 7 个路由模块
- 路由按功能拆分到 `src/routes/`：
  - `goals.ts` / `logs.ts` / `stats.ts` — 核心业务（均需认证）
  - `auth.ts` — Google OAuth 2.0 + JWT 签发
  - `users.ts` — 用户信息与统计
  - `subscription.ts` — 订阅状态与配额检查
  - `payment.ts` — PayPal 沙盒支付
- 认证中间件在 `src/middleware/auth.ts`（JWT HS256，7 天有效期）
- 数据库查询集中在 `src/db/queries.ts`（goals/logs/stats）和 `src/db/user-queries.ts`（users/subscriptions）
- 类型定义在 `src/types.ts`
- 配置在 `wrangler.toml`，secrets 通过 `wrangler secret put` 设置

### 前端 (`frontend/`)
- **React 18 + TypeScript + Vite**
- **TailwindCSS** 样式，**TanStack Query v5** 数据请求（staleTime 5min，retry 1）
- 认证状态通过 **React Context**（`src/contexts/AuthContext.tsx`）管理，token 存 localStorage（key: `learning_tracker_auth`）
- 注意：Zustand 已安装但未使用，实际状态管理为 Context + TanStack Query + useState
- 路由（React Router v6）：
  - `/` — Home（目标列表）
  - `/goal/:id` — GoalDetail（目标详情、日历、打卡）
  - `/auth-callback` — AuthCallback（OAuth 回调处理）
  - `/profile` — Profile（个人中心、订阅管理、PayPal 支付）
- API 客户端集中在 `src/api/index.ts`，生产环境直连 `api.keeprecord.shop`
- 开发时 Vite proxy 将 `/api` 转发到 localhost:8787
- 部署到 Cloudflare Pages，`functions/api/[[path]].ts` 为 Pages Functions API 代理

### 数据库表

| 表 | 用途 | 关键字段 |
|---|---|---|
| `users` | 用户信息 | google_id (UNIQUE), email, name, picture |
| `goals` | 学习目标 | user_id (FK→users), name, total_hours |
| `logs` | 打卡记录 | goal_id (FK→goals), hours, date, note |
| `subscriptions` | 订阅信息 | user_id (FK→users, UNIQUE), plan ('free'/'pro'), paypal_order_id, paypal_capture_id, expires_at |

- `logs` 有两个索引：`idx_logs_goal_date(goal_id, date)` 和 `idx_logs_date(date)`
- `subscriptions` 表保留了未使用的 stripe_customer_id/stripe_subscription_id 字段（历史遗留）
- 初始化脚本：`scripts/init-db.sql`（goals/logs 表），PayPal 迁移：`scripts/migrate_add_paypal.sql`
- users/subscriptions 表通过 `user-queries.ts` 中的 `findOrCreateUser` 自动创建

### 认证流程

1. 前端调用 `login()` → 跳转 `/api/auth/google`
2. 后端生成 state 参数，重定向到 Google OAuth
3. Google 回调 `/api/auth/callback`，后端换取 token，获取用户信息
4. 调用 `findOrCreateUser` 创建/更新用户，自动创建 free 订阅
5. 签发 JWT（HS256，7天），重定向到前端 `/auth-callback?token=...&email=...&name=...&picture=...`
6. 前端 AuthCallback 页面保存到 localStorage，跳转首页

### 支付流程（PayPal 沙盒）

1. 前端调用 `POST /api/payment/paypal/create` → 获取 approval_url
2. 跳转到 PayPal 支付页面
3. 支付成功后 PayPal 重定向到 `/profile?paypal=success&token=<orderId>`
4. 前端调用 `POST /api/payment/paypal/capture` 完成支付
5. 后端更新 subscription 为 pro（有效期 1 个月）

### 订阅模型

- **Free**：最多 1 个目标
- **Pro**：无限目标，$0.01/月（沙盒测试价格）

## API 响应格式

所有 API 返回统一格式：`{ success: boolean, data?: T, error?: string }`

HTTP 状态码：200/201 成功，400 验证失败，401 未认证，403 权限不足（如 Free 用户超配额），404 不存在，500 服务器错误

## 核心业务逻辑

- **里程碑**：固定节点 10, 50, 100, 200, 500, 1000, 2000 小时（`queries.ts` 中定义）
- **完成预测**：基于最近 30 天平均打卡速度推算
- **连胜计算**：按日期倒序遍历打卡记录，检查日期连续性

## 注意事项

- 前后端类型定义在 `backend/src/types.ts` 和 `frontend/src/api/index.ts` 中各维护一份，修改时需同步
- Profile 页部分 API 调用直接使用 fetch 而非 `api/index.ts` 的封装函数，风格不一致
- Wrangler secrets（GOOGLE_CLIENT_SECRET, PAYPAL_CLIENT_SECRET, JWT_SECRET）不在代码中，通过 `wrangler secret put` 管理
- CORS 当前配置为 `Access-Control-Allow-Origin: *`，生产环境应收紧
- JWT 无刷新机制，过期后需重新 Google 登录
