// 用户数据库操作

import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  last_login_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// 获取或创建用户（Google OAuth 登录时调用）
export async function findOrCreateUser(
  db: D1Database,
  googleId: string,
  email: string,
  name: string | null,
  picture: string | null
): Promise<User> {
  // 先查找用户
  const existing = await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<User>();

  if (existing) {
    // 更新最后登录时间
    await db
      .prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(existing.id)
      .run();
    return existing;
  }

  // 创建新用户
  const result = await db
    .prepare(
      'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)'
    )
    .bind(googleId, email, name ?? null, picture ?? null)
    .run();

  const newUser = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first<User>();

  // 同时创建免费订阅
  if (newUser) {
    await db
      .prepare('INSERT INTO subscriptions (user_id, plan, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind(newUser.id, 'free')
      .run();
  }

  return newUser!;
}

// 通过 Google ID 获取用户
export async function getUserByGoogleId(
  db: D1Database,
  googleId: string
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleId)
    .first<User>();
}

// 通过 ID 获取用户
export async function getUserById(
  db: D1Database,
  userId: number
): Promise<User | null> {
  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();
}

// 获取用户订阅信息
export async function getUserSubscription(
  db: D1Database,
  userId: number
): Promise<Subscription | null> {
  return await db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .bind(userId)
    .first<Subscription>();
}

// 更新用户信息
export async function updateUser(
  db: D1Database,
  userId: number,
  name: string | null,
  picture: string | null
): Promise<User | null> {
  await db
    .prepare('UPDATE users SET name = ?, picture = ? WHERE id = ?')
    .bind(name ?? null, picture ?? null, userId)
    .run();

  return await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<User>();
}

// 获取用户统计
export async function getUserStats(
  db: D1Database,
  userId: number
): Promise<{
  total_goals: number;
  total_hours: number;
  current_streak: number;
  longest_streak: number;
  subscription_plan: string;
}> {
  // 获取目标数量
  const goalsResult = await db
    .prepare('SELECT COUNT(*) as count FROM goals WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  // 获取总学习时长
  const hoursResult = await db
    .prepare(
      `SELECT COALESCE(SUM(l.hours), 0) as total 
       FROM logs l 
       JOIN goals g ON l.goal_id = g.id 
       WHERE g.user_id = ?`
    )
    .bind(userId)
    .first<{ total: number }>();

  // 获取当前连续打卡天数（基于 logs 表实时计算）
  // 查询该用户所有目标下的打卡日期（去重），按日期倒序
  const streakDays = await db
    .prepare(
      `SELECT DISTINCT l.date
       FROM logs l
       JOIN goals g ON l.goal_id = g.id
       WHERE g.user_id = ?
       ORDER BY l.date DESC`
    )
    .bind(userId)
    .all<{ date: string }>();

  let currentStreak = 0;
  let longestStreak = 0;

  if (streakDays.results && streakDays.results.length > 0) {
    const dates = streakDays.results.map((r) => r.date);
    const today = new Date().toISOString().split('T')[0];

    // 计算当前连胜：从今天或昨天开始往回数连续天数
    let streak = 0;
    const startDate = new Date(dates[0]);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      // 最近一次打卡是今天或昨天，开始计算连胜
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
    currentStreak = streak;

    // 计算最长连胜
    let tempStreak = 1;
    longestStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
  }

  // 获取订阅计划
  const subResult = await db
    .prepare('SELECT plan FROM subscriptions WHERE user_id = ?')
    .bind(userId)
    .first<{ plan: string }>();

  return {
    total_goals: goalsResult?.count ?? 0,
    total_hours: hoursResult?.total ?? 0,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    subscription_plan: subResult?.plan ?? 'free',
  };
}

// 检查用户是否可以创建更多目标
export async function canCreateGoal(db: D1Database, userId: number): Promise<boolean> {
  const sub = await getUserSubscription(db, userId);
  if (!sub) return false; // 没有订阅，不允许

  if (sub.plan === 'pro') return true; // Pro 用户无限

  // 免费用户只能有 1 个目标
  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM goals WHERE user_id = ?')
    .bind(userId)
    .first<{ count: number }>();

  return (countResult?.count ?? 0) < 1;
}
