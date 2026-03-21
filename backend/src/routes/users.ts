// 用户路由

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import * as userQueries from '../db/user-queries';

export const usersRouter = new Hono<{ Bindings: { DB: D1Database } }>();

interface AuthPayload {
  email: string;
  sub: string;
}

// 从 token 中间件获取用户（通过 header 或 cookie）
async function getUserFromRequest(c: any): Promise<{ googleId: string; email: string } | null> {
  // 优先从 header 获取
  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    // 从 cookie 获取 id_token
    token = getCookie(c, 'id_token') || '';
  }

  if (!token) return null;

  try {
    // 验证 Google token 并获取用户信息
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

// GET /api/users/me - 获取当前用户信息
usersRouter.get('/me', async (c) => {
  const auth = await getUserFromRequest(c);
  if (!auth) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const user = await userQueries.getUserByGoogleId(c.env.DB, auth.googleId);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const subscription = await userQueries.getUserSubscription(c.env.DB, user.id);

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      subscription: subscription
        ? {
            plan: subscription.plan,
            expires_at: subscription.expires_at,
          }
        : { plan: 'free', expires_at: null },
    },
  });
});

// PUT /api/users/me - 更新用户信息
usersRouter.put('/me', async (c) => {
  const auth = await getUserFromRequest(c);
  if (!auth) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const user = await userQueries.getUserByGoogleId(c.env.DB, auth.googleId);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const body = await c.req.json();
  const { name, picture } = body;

  const updatedUser = await userQueries.updateUser(c.env.DB, user.id, name, picture);

  return c.json({
    success: true,
    data: updatedUser,
  });
});

// GET /api/users/stats - 获取用户统计
usersRouter.get('/stats', async (c) => {
  const auth = await getUserFromRequest(c);
  if (!auth) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const user = await userQueries.getUserByGoogleId(c.env.DB, auth.googleId);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const stats = await userQueries.getUserStats(c.env.DB, user.id);

  return c.json({
    success: true,
    data: stats,
  });
});
