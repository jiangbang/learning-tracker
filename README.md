# Learning Tracker - MVP 需求文档

> 一个基于 Cloudflare 的学习时长追踪器，帮助用户坚持完成长期学习目标

**版本：** v1.0 (MVP)  
**创建日期：** 2026-03-15  
**部署平台：** Cloudflare Pages + Workers + D1

---

## 📋 产品定位

帮助用户追踪长期学习目标的完成进度，通过可视化的进度反馈和游戏化元素，激励用户持续坚持。

**核心场景：** 用户设定「学习英语 2000 小时」的目标，每天学习后打卡记录时长，系统自动计算进度并展示激励信息。

---

## 🎯 MVP 核心功能

### 1. 目标管理

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 创建目标 | 输入目标名称 + 总时长（小时） | P0 |
| 查看目标列表 | 展示所有目标及进度概览 | P0 |
| 查看目标详情 | 展示单个目标的完整进度信息 | P0 |
| 编辑目标 | 修改目标名称或总时长 | P1 |
| 删除目标 | 删除目标及关联记录 | P1 |

### 2. 打卡记录

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 快速打卡 | 输入今日学习时长，一键提交 | P0 |
| 查看记录列表 | 按时间倒序展示所有打卡记录 | P0 |
| 编辑记录 | 修改已提交的打卡记录 | P1 |
| 删除记录 | 删除某条打卡记录 | P1 |

### 3. 进度可视化

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 进度条 | 显示已完成/总时长，百分比 | P0 |
| 数字统计 | 显示具体小时数 | P0 |
| 日历视图 | 展示最近 30 天的打卡情况 | P0 |
| 连胜天数 | 显示当前连续打卡天数 | P0 |
| 预计完成时间 | 根据平均速度预测完成日期 | P1 |

### 4. 里程碑系统

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 里程碑列表 | 展示预设的里程碑节点 | P0 |
| 完成状态 | 已完成的里程碑显示为解锁状态 | P0 |
| 下一个里程碑 | 突出显示距离下一个里程碑的差距 | P0 |

---

## 🗄️ 数据结构

### Goals 表（目标）

```sql
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- 目标名称，如"英语学习"
  total_hours INTEGER NOT NULL, -- 总时长（小时），如 2000
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Logs 表（打卡记录）

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,     -- 关联目标 ID
  hours REAL NOT NULL,          -- 学习时长（小时），支持小数如 1.5
  date DATE NOT NULL,           -- 打卡日期
  note TEXT,                    -- 备注（可选）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX idx_logs_goal_date ON logs(goal_id, date);
CREATE INDEX idx_logs_date ON logs(date);
```

---

## 🌐 API 设计

### 基础信息

- **Base URL:** `https://learning-tracker.<your-subdomain>.workers.dev`
- **Content-Type:** `application/json`
- **认证:** MVP 阶段暂不实现（本地存储 user_id 或简单 API Key）

---

### 目标相关 API

#### `GET /api/goals` - 获取所有目标

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "英语学习",
      "total_hours": 2000,
      "completed_hours": 156,
      "progress_percent": 7.8,
      "created_at": "2026-03-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/goals` - 创建新目标

**请求：**
```json
{
  "name": "英语学习",
  "total_hours": 2000
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "英语学习",
    "total_hours": 2000,
    "created_at": "2026-03-15T10:00:00Z"
  }
}
```

#### `GET /api/goals/:id` - 获取目标详情

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "英语学习",
    "total_hours": 2000,
    "completed_hours": 156,
    "progress_percent": 7.8,
    "streak_days": 5,
    "longest_streak": 12,
    "next_milestone": {
      "hours": 200,
      "remaining": 44
    },
    "estimated_completion": "2027-08-15",
    "created_at": "2026-03-01T00:00:00Z"
  }
}
```

#### `DELETE /api/goals/:id` - 删除目标

**响应：**
```json
{
  "success": true,
  "message": "目标已删除"
}
```

---

### 打卡记录相关 API

#### `GET /api/logs?goalId=1&limit=30` - 获取打卡记录

**参数：**
- `goalId` (可选): 筛选特定目标
- `limit` (可选): 返回数量，默认 30

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "goal_id": 1,
      "hours": 1.5,
      "date": "2026-03-15",
      "note": "背了 50 个单词，听了 1 小时播客",
      "created_at": "2026-03-15T22:00:00Z"
    }
  ]
}
```

#### `POST /api/logs` - 创建打卡记录

**请求：**
```json
{
  "goal_id": 1,
  "hours": 1.5,
  "date": "2026-03-15",
  "note": "背了 50 个单词"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "goal_id": 1,
    "hours": 1.5,
    "date": "2026-03-15",
    "note": "背了 50 个单词",
    "created_at": "2026-03-15T22:00:00Z"
  }
}
```

#### `PUT /api/logs/:id` - 更新打卡记录

**请求：**
```json
{
  "hours": 2.0,
  "note": "更新了备注"
}
```

#### `DELETE /api/logs/:id` - 删除打卡记录

---

### 统计相关 API

#### `GET /api/stats/calendar?goalId=1&month=2026-03` - 获取日历数据

**响应：**
```json
{
  "success": true,
  "data": {
    "month": "2026-03",
    "days": [
      { "date": "2026-03-01", "hours": 1.0 },
      { "date": "2026-03-02", "hours": 1.5 },
      { "date": "2026-03-03", "hours": 0 },
      ...
    ]
  }
}
```

#### `GET /api/stats/streak?goalId=1` - 获取连胜数据

**响应：**
```json
{
  "success": true,
  "data": {
    "current_streak": 5,
    "longest_streak": 12,
    "last_log_date": "2026-03-15"
  }
}
```

---

## 🎨 页面设计

### 1. 首页（目标列表）

```
┌────────────────────────────────────────┐
│  Learning Tracker               [+新增] │
├────────────────────────────────────────┤
│                                        │
│  📚 英语学习                           │
│  ████████░░░░░░░░░░░░░░  156/2000 7.8% │
│  🔥 连胜 5 天                          │
│  ─────────────────────────────────     │
│                                        │
│  🎯 跑步训练                           │
│  ████░░░░░░░░░░░░░░░░░░  50/500 10%   │
│  🔥 连胜 2 天                          │
│  ─────────────────────────────────     │
│                                        │
└────────────────────────────────────────┘
```

### 2. 目标详情页

```
┌────────────────────────────────────────┐
│  ← 英语学习                            │
├────────────────────────────────────────┤
│                                        │
│  总进度                                │
│  ████████░░░░░░░░░░░░░░  156/2000 7.8% │
│  预计完成：2027-08-15                  │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  🔥 当前连胜：5 天    最长：12 天      │
│                                        │
│  🏆 下一个里程碑：200 小时 (还差 44h)  │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  📅 3 月打卡记录                       │
│  一  二  三  四  五  六  日            │
│     1  2  3  4  5  6                   │
│  7  8  9  10 11 12 13                  │
│     █  █     █  █  █                   │
│    1h 1.5h   2h 1h 1h                  │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│  [➕ 今天学了多久？]    [📝 查看记录]  │
│                                        │
└────────────────────────────────────────┘
```

### 3. 打卡弹窗

```
┌────────────────────────────────────────┐
│  今天学了多久？                   [×]  │
├────────────────────────────────────────┤
│                                        │
│  学习时长 *                            │
│  [ 1.0 ] 小时                          │
│                                        │
│  日期                                  │
│  [ 2026-03-15 ]                        │
│                                        │
│  备注（可选）                          │
│  [ 背了 50 个单词，听了播客...      ]  │
│                                        │
│  ─────────────────────────────────     │
│                                        │
│         [取消]    [确认打卡]           │
│                                        │
└────────────────────────────────────────┘
```

---

## 🏗️ 技术架构

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.x | UI 框架 |
| Vite | 5.x | 构建工具 |
| TypeScript | 5.x | 类型系统 |
| TailwindCSS | 3.x | 样式框架 |
| Shadcn/ui | latest | 组件库 |
| Recharts | 2.x | 图表库 |
| Zustand | 4.x | 状态管理 |
| TanStack Query | 5.x | 数据请求 |

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Cloudflare Workers | latest | 边缘函数运行时 |
| Hono | 4.x | Web 框架 |
| Cloudflare D1 | latest | SQLite 数据库 |
| TypeScript | 5.x | 类型系统 |

### 部署

| 服务 | 说明 |
|------|------|
| Cloudflare Pages | 前端托管 + 自动 CI/CD |
| Cloudflare Workers | 后端 API |
| Cloudflare D1 | 数据库 |

---

## 📁 项目结构

```
learning-tracker/
├── frontend/                 # 前端项目
│   ├── src/
│   │   ├── components/       # 可复用组件
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   ├── MilestoneList.tsx
│   │   │   └── LogModal.tsx
│   │   ├── pages/            # 页面组件
│   │   │   ├── Home.tsx
│   │   │   └── GoalDetail.tsx
│   │   ├── hooks/            # 自定义 Hooks
│   │   ├── api/              # API 调用
│   │   ├── store/            # Zustand 状态
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                  # 后端项目
│   ├── src/
│   │   ├── index.ts          # 入口文件
│   │   ├── routes/           # 路由定义
│   │   │   ├── goals.ts
│   │   │   ├── logs.ts
│   │   │   └── stats.ts
│   │   ├── db/               # 数据库操作
│   │   │   ├── schema.ts
│   │   │   └── queries.ts
│   │   └── types.ts          # 类型定义
│   ├── wrangler.toml         # Workers 配置
│   └── package.json
│
├── scripts/                  # 工具脚本
│   └── init-db.sql           # 数据库初始化脚本
│
└── README.md
```

---

## 🚀 开发计划

### Phase 1: 基础框架（1-2 天）

- [ ] 初始化 Cloudflare 项目
- [ ] 配置 D1 数据库
- [ ] 搭建前后端基础结构
- [ ] 配置 CI/CD 自动部署

### Phase 2: 后端 API（2-3 天）

- [ ] 实现 Goals CRUD API
- [ ] 实现 Logs CRUD API
- [ ] 实现 Stats 统计 API
- [ ] 编写 API 测试

### Phase 3: 前端页面（3-4 天）

- [ ] 实现首页（目标列表）
- [ ] 实现目标详情页
- [ ] 实现打卡弹窗
- [ ] 实现日历视图组件
- [ ] 实现进度条组件

### Phase 4: 联调优化（2-3 天）

- [ ] 前后端联调
- [ ] 优化 UI/UX
- [ ] 添加加载状态和错误处理
- [ ] 移动端适配

### Phase 5: 测试发布（1-2 天）

- [ ] 功能测试
- [ ] 性能优化
- [ ] 部署上线
- [ ] 编写使用文档

**预计总工期：** 9-14 天

---

## ⚠️ MVP 范围限制

### 不包含的功能（后续版本）

- [ ] 用户认证系统（MVP 用简单 API Key 或本地存储）
- [ ] 多设备同步
- [ ] 数据导出/导入
- [ ] 分享功能
- [ ] 提醒通知
- [ ] 社交功能（排行榜、好友）
- [ ] 自定义里程碑
- [ ] 主题切换

---

## 📊 成功指标

- 用户可以成功创建目标
- 用户可以成功打卡记录
- 进度显示准确
- 页面加载时间 < 2 秒
- 移动端可用

---

## 🔧 快速开始命令

```bash
# 1. 创建 Cloudflare 项目
npm create cloudflare@latest learning-tracker

# 2. 初始化 D1 数据库
npx wrangler d1 create learning-tracker-db

# 3. 复制 database_id 到 wrangler.toml

# 4. 执行数据库初始化
npx wrangler d1 execute learning-tracker-db --file scripts/init-db.sql

# 5. 开发模式
cd frontend && npm run dev
cd backend && npm run dev

# 6. 部署
npm run deploy
```

---

## 📝 备注

- MVP 阶段优先保证核心功能可用
- UI 可以简单，但交互要流畅
- 数据准确性是第一位的
- 移动端适配必须做（很多人用手机打卡）

---

**文档状态：** ✅ 完成  
**下一步：** 开始 Phase 1 开发
