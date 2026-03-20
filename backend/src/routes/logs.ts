// Logs 路由

import { Hono } from 'hono';
import type { ApiResponse, CreateLogRequest, UpdateLogRequest } from '../types';
import * as queries from '../db/queries';

export const logsRouter = new Hono<{ Bindings: { DB: D1Database } }>();

// GET /api/logs - 获取打卡记录
logsRouter.get('/', async (c) => {
  try {
    const goalId = c.req.query('goalId');
    const limit = parseInt(c.req.query('limit') || '30');
    
    const logs = await queries.getLogs(
      c.env.DB,
      goalId ? parseInt(goalId) : undefined,
      limit
    );
    
    return c.json<ApiResponse<typeof logs>>({
      success: true,
      data: logs
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '获取打卡记录失败'
    }, 500);
  }
});

// POST /api/logs - 创建打卡记录
logsRouter.post('/', async (c) => {
  try {
    const body: CreateLogRequest = await c.req.json();
    
    if (!body.goal_id || !body.hours || !body.date) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '缺少必要参数：goal_id, hours, date'
      }, 400);
    }
    
    const log = await queries.createLog(
      c.env.DB,
      body.goal_id,
      body.hours,
      body.date,
      body.note
    );
    
    return c.json<ApiResponse<typeof log>>({
      success: true,
      data: log
    }, 201);
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '创建打卡记录失败'
    }, 500);
  }
});

// GET /api/logs/:id - 获取单条记录
logsRouter.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '无效的记录 ID'
      }, 400);
    }
    
    const log = await queries.getLogById(c.env.DB, id);
    
    if (!log) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '记录不存在'
      }, 404);
    }
    
    return c.json<ApiResponse<typeof log>>({
      success: true,
      data: log
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '获取记录失败'
    }, 500);
  }
});

// PUT /api/logs/:id - 更新打卡记录
logsRouter.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '无效的记录 ID'
      }, 400);
    }
    
    const body: UpdateLogRequest = await c.req.json();
    const log = await queries.updateLog(c.env.DB, id, body.hours, body.note);
    
    if (!log) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '记录不存在'
      }, 404);
    }
    
    return c.json<ApiResponse<typeof log>>({
      success: true,
      data: log
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '更新记录失败'
    }, 500);
  }
});

// DELETE /api/logs/:id - 删除打卡记录
logsRouter.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '无效的记录 ID'
      }, 400);
    }
    
    const success = await queries.deleteLog(c.env.DB, id);
    
    if (!success) {
      return c.json<ApiResponse<never>>({
        success: false,
        error: '记录不存在'
      }, 404);
    }
    
    return c.json<ApiResponse<never>>({
      success: true,
      message: '记录已删除'
    });
  } catch (error) {
    return c.json<ApiResponse<never>>({
      success: false,
      error: '删除记录失败'
    }, 500);
  }
});
