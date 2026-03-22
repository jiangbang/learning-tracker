// Goals 路由

import { Hono } from 'hono';
import type { ApiResponse, CreateGoalRequest, UpdateGoalRequest } from '../types';
import * as queries from '../db/queries';
import * as userQueries from '../db/user-queries';
import { authMiddleware } from '../middleware/auth';

export const goalsRouter = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string }; Variables: { currentUser: { id: number; email: string } } }>();

// 所有 goals 路由都需要认证
goalsRouter.use('/*', authMiddleware);

// GET /api/goals - 获取当前用户的所有目标
goalsRouter.get('/', async (c) => {
  const currentUser = c.get('currentUser');

  try {
    const goals = await queries.getGoalsByUserId(c.env.DB, currentUser.id);
    return c.json<ApiResponse<typeof goals>>({ success: true, data: goals });
  } catch (error) {
    return c.json<ApiResponse<never>>({ success: false, error: '获取目标列表失败' }, 500);
  }
});

// POST /api/goals - 创建新目标
goalsRouter.post('/', async (c) => {
  const currentUser = c.get('currentUser');

  try {
    // 检查是否可以创建目标
    const canCreate = await userQueries.canCreateGoal(c.env.DB, currentUser.id);
    if (!canCreate) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '免费用户只能创建1个目标，请升级到 Pro 版本'
      }, 403);
    }

    const body: CreateGoalRequest = await c.req.json();

    if (!body.name || !body.total_hours) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '缺少必要参数：name, total_hours'
      }, 400);
    }

    const goal = await queries.createGoal(c.env.DB, currentUser.id, body.name, body.total_hours);

    return c.json<ApiResponse<typeof goal>>({ success: true, data: goal }, 201);
  } catch (error) {
    return c.json<ApiResponse<never>>({ success: false, error: '创建目标失败' }, 500);
  }
});

// GET /api/goals/:id - 获取目标详情
goalsRouter.get('/:id', async (c) => {
  const currentUser = c.get('currentUser');

  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({ success: false, error: '无效的目标 ID' }, 400);
    }

    const goal = await queries.getGoalById(c.env.DB, id, currentUser.id);

    if (!goal) {
      return c.json<ApiResponse<never>>({ success: false, error: '目标不存在' }, 404);
    }

    return c.json<ApiResponse<typeof goal>>({ success: true, data: goal });
  } catch (error) {
    return c.json<ApiResponse<never>>({ success: false, error: '获取目标详情失败' }, 500);
  }
});

// PUT /api/goals/:id - 更新目标
goalsRouter.put('/:id', async (c) => {
  const currentUser = c.get('currentUser');

  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({ success: false, error: '无效的目标 ID' }, 400);
    }

    const body: UpdateGoalRequest = await c.req.json();
    const goal = await queries.updateGoal(c.env.DB, id, currentUser.id, body.name, body.total_hours);

    if (!goal) {
      return c.json<ApiResponse<never>>({ success: false, error: '目标不存在' }, 404);
    }

    return c.json<ApiResponse<typeof goal>>({ success: true, data: goal });
  } catch (error) {
    return c.json<ApiResponse<never>>({ success: false, error: '更新目标失败' }, 500);
  }
});

// DELETE /api/goals/:id - 删除目标
goalsRouter.delete('/:id', async (c) => {
  const currentUser = c.get('currentUser');

  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({ success: false, error: '无效的目标 ID' }, 400);
    }

    const success = await queries.deleteGoal(c.env.DB, id, currentUser.id);

    if (!success) {
      return c.json<ApiResponse<never>>({ success: false, error: '目标不存在' }, 404);
    }

    return c.json<ApiResponse<never>>({ success: true, message: '目标已删除' });
  } catch (error) {
    return c.json<ApiResponse<never>>({ success: false, error: '删除目标失败' }, 500);
  }
});
