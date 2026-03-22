// 用户路由

import { Hono } from 'hono';
import * as userQueries from '../db/user-queries';
import { authMiddleware } from '../middleware/auth';

export const usersRouter = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string }; Variables: { currentUser: { id: number; email: string } } }>();

// 所有 users 路由都需要认证
usersRouter.use('/*', authMiddleware);

// GET /api/users/me - 获取当前用户信息
usersRouter.get('/me', async (c) => {
  const currentUser = c.get('currentUser');
  const user = await userQueries.getUserById(c.env.DB, currentUser.id);
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
  const currentUser = c.get('currentUser');
  const user = await userQueries.getUserById(c.env.DB, currentUser.id);
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
  const currentUser = c.get('currentUser');
  const user = await userQueries.getUserById(c.env.DB, currentUser.id);
  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const stats = await userQueries.getUserStats(c.env.DB, user.id);

  return c.json({
    success: true,
    data: stats,
  });
});
