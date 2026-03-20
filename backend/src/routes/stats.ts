// Stats 路由

import { Hono } from 'hono';
import type { ApiResponse } from '../types';
import * as queries from '../db/queries';

export const statsRouter = new Hono<{ Bindings: { DB: D1Database } }>();

// GET /api/stats/calendar - 获取日历数据
statsRouter.get('/calendar', async (c) => {
  try {
    const goalId = c.req.query('goalId');
    const month = c.req.query('month') || new Date().toISOString().slice(0, 7);
    
    if (!goalId) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '缺少参数：goalId'
      }, 400);
    }
    
    const calendar = await queries.getCalendarData(c.env.DB, parseInt(goalId), month);
    
    return c.json<ApiResponse<typeof calendar>>({
      success: true,
      data: {
        month,
        days: calendar
      }
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '获取日历数据失败'
    }, 500);
  }
});

// GET /api/stats/streak - 获取连胜数据
statsRouter.get('/streak', async (c) => {
  try {
    const goalId = c.req.query('goalId');
    
    if (!goalId) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '缺少参数：goalId'
      }, 400);
    }
    
    const streak = await queries.getStreakData(c.env.DB, parseInt(goalId));
    
    return c.json<ApiResponse<typeof streak>>({
      success: true,
      data: streak
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '获取连胜数据失败'
    }, 500);
  }
});
