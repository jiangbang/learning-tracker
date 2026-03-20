// Learning Tracker API - 入口文件

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { goalsRouter } from './routes/goals';
import { logsRouter } from './routes/logs';
import { statsRouter } from './routes/stats';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

// CORS 中间件
app.use('/*', cors());

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.route('/api/goals', goalsRouter);
app.route('/api/logs', logsRouter);
app.route('/api/stats', statsRouter);

// 404 处理
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found'
  }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    error: 'Internal Server Error'
  }, 500);
});

export default app;
