// 订阅路由

import { Hono } from 'hono';
import * as userQueries from '../db/user-queries';
import { authMiddleware } from '../middleware/auth';

export const subscriptionRouter = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string }; Variables: { currentUser: { id: number; email: string } } }>();

// 所有 subscription 路由都需要认证
subscriptionRouter.use('/*', authMiddleware);

// GET /api/subscription - 获取当前订阅状态
subscriptionRouter.get('/', async (c) => {
  const currentUser = c.get('currentUser');
  const user = await userQueries.getUserById(c.env.DB, currentUser.id);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const subscription = await userQueries.getUserSubscription(c.env.DB, user.id);

  // 获取目标数量
  const goalsCount = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM goals WHERE user_id = ?')
    .bind(user.id)
    .first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      plan: subscription?.plan ?? 'free',
      stripe_customer_id: subscription?.stripe_customer_id ?? null,
      stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
      expires_at: subscription?.expires_at ?? null,
      goals_count: goalsCount?.count ?? 0,
      goals_limit: subscription?.plan === 'pro' ? -1 : 1,
    },
  });
});

// GET /api/subscription/limits - 检查是否可以创建目标
subscriptionRouter.get('/limits', async (c) => {
  const currentUser = c.get('currentUser');
  const user = await userQueries.getUserById(c.env.DB, currentUser.id);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const subscription = await userQueries.getUserSubscription(c.env.DB, user.id);
  const canCreate = await userQueries.canCreateGoal(c.env.DB, user.id);

  const goalsCount = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM goals WHERE user_id = ?')
    .bind(user.id)
    .first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      can_create: canCreate,
      current_goals: goalsCount?.count ?? 0,
      limit: subscription?.plan === 'pro' ? -1 : 1,
      plan: subscription?.plan ?? 'free',
    },
  });
});
