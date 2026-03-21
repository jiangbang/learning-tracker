// 订阅路由

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import * as userQueries from '../db/user-queries';

export const subscriptionRouter = new Hono<{ Bindings: { DB: D1Database } }>();

async function getUserFromRequest(c: any): Promise<{ googleId: string; email: string } | null> {
  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = getCookie(c, 'id_token') || '';
  }

  if (!token) return null;

  try {
    const verifyResponse = await fetch('https://oauth2.googleapis.com/tokeninfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token }),
    });

    if (!verifyResponse.ok) return null;

    const tokenInfo = await verifyResponse.json();
    return {
      googleId: tokenInfo.sub,
      email: tokenInfo.email,
    };
  } catch {
    return null;
  }
}

// GET /api/subscription - 获取当前订阅状态
subscriptionRouter.get('/', async (c) => {
  const auth = await getUserFromRequest(c);
  if (!auth) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const user = await userQueries.getUserByGoogleId(c.env.DB, auth.googleId);
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
      goals_limit: subscription?.plan === 'pro' ? -1 : 1, // -1 表示无限
    },
  });
});

// GET /api/subscription/limits - 检查是否可以创建目标
subscriptionRouter.get('/limits', async (c) => {
  const auth = await getUserFromRequest(c);
  if (!auth) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const user = await userQueries.getUserByGoogleId(c.env.DB, auth.googleId);
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
