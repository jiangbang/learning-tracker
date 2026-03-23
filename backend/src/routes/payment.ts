// PayPal 支付路由（沙盒环境）

import { Hono } from 'hono';
import type { ApiResponse } from '../types';
import * as userQueries from '../db/user-queries';
import { authMiddleware } from '../middleware/auth';

export const paymentRouter = new Hono<{
  Bindings: {
    DB: D1Database;
    PAYPAL_CLIENT_ID: string;
    PAYPAL_CLIENT_SECRET: string;
    JWT_SECRET: string;
  };
  Variables: { currentUser: { id: number; email: string } };
}>();

// PayPal 沙盒环境
const PAYPAL_API = 'https://api-m.sandbox.paypal.com';
const PLAN_PRICE = '0.01'; // Pro 月费（测试价格）

// 获取 PayPal Access Token
async function getPayPalAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

// POST /api/payment/paypal/create - 创建 PayPal 订单并直接重定向
paymentRouter.post('/paypal/create', authMiddleware, async (c) => {
  const currentUser = c.get('currentUser');

  const subscription = await userQueries.getUserSubscription(c.env.DB, currentUser.id);
  if (subscription?.plan === 'pro') {
    return c.json<ApiResponse<never>>({ success: false, error: '已经是 Pro 用户' }, 400);
  }

  try {
    const accessToken = await getPayPalAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_CLIENT_SECRET
    );

    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: `user_${currentUser.id}`,
            description: 'Learning Tracker Pro 月费订阅',
            amount: {
              currency_code: 'USD',
              value: PLAN_PRICE,
            },
          },
        ],
        application_context: {
          return_url: `https://www.keeprecord.shop/profile?paypal=success`,
          cancel_url: 'https://www.keeprecord.shop/profile?paypal=cancelled',
          brand_name: 'Learning Tracker',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!orderResponse.ok) {
      const err = await orderResponse.text();
      console.error('PayPal order creation error:', err);
      throw new Error('Failed to create PayPal order');
    }

    const order = await orderResponse.json();

    // 保存 PayPal order ID 到 subscription 表
    if (subscription) {
      await c.env.DB
        .prepare('UPDATE subscriptions SET paypal_order_id = ? WHERE user_id = ?')
        .bind(order.id, currentUser.id)
        .run();
    } else {
      await c.env.DB
        .prepare('INSERT INTO subscriptions (user_id, plan, paypal_order_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind(currentUser.id, 'free', order.id)
        .run();
    }

    // 返回 PayPal 批准链接（前端用 window.location.href 跳转）
    const approvalUrl = (order as any).links?.find((link: any) => link.rel === 'approve')?.href;
    if (approvalUrl) {
      return c.json<ApiResponse<{ approval_url: string; order_id: string }>>({
        success: true,
        data: { approval_url: approvalUrl, order_id: (order as any).id },
      });
    }

    return c.json<ApiResponse<never>>({ success: false, error: '未找到 PayPal 批准链接' }, 500);
  } catch (err) {
    console.error('PayPal create order error:', err);
    return c.json<ApiResponse<never>>({ success: false, error: '创建订单失败' }, 500);
  }
});

// POST /api/payment/paypal/capture - 捕获 PayPal 订单（用户支付后回调）
paymentRouter.post('/paypal/capture', async (c) => {
  const { orderId } = await c.req.json();

  if (!orderId) {
    return c.json<ApiResponse<never>>({ success: false, error: '缺少 orderId' }, 400);
  }

  // 通过 PayPal order ID 查找对应的用户
  const userResult = await c.env.DB
    .prepare('SELECT user_id FROM subscriptions WHERE paypal_order_id = ?')
    .bind(orderId)
    .first<{ user_id: number }>();

  if (!userResult) {
    return c.json<ApiResponse<never>>({ success: false, error: '订单未找到' }, 404);
  }

  try {
    const accessToken = await getPayPalAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_CLIENT_SECRET
    );

    const captureResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!captureResponse.ok) {
      const err = await captureResponse.text();
      console.error('PayPal capture error:', err);
      throw new Error('Failed to capture PayPal order');
    }

    const captureData = await captureResponse.json();

    if (captureData.status !== 'COMPLETED') {
      return c.json<ApiResponse<never>>({
        success: false,
        error: `支付未完成，当前状态: ${captureData.status}`,
      }, 400);
    }

    // 更新订阅为 Pro
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

    await c.env.DB
      .prepare(
        `UPDATE subscriptions
         SET plan = 'pro',
             paypal_order_id = ?,
             paypal_capture_id = ?,
             expires_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`
      )
      .bind(orderId, captureId, expiresAt.toISOString(), userResult.user_id)
      .run();

    return c.json<ApiResponse<{ plan: string; expires_at: string }>>({
      success: true,
      data: {
        plan: 'pro',
        expires_at: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('PayPal capture error:', err);
    return c.json<ApiResponse<never>>({ success: false, error: '捕获订单失败' }, 500);
  }
});

// POST /api/payment/paypal/get-order - 获取 PayPal 订单状态（用于支付后查询）
paymentRouter.post('/paypal/get-order', async (c) => {
  const { orderId } = await c.req.json();

  if (!orderId) {
    return c.json<ApiResponse<never>>({ success: false, error: '缺少 orderId' }, 400);
  }

  try {
    const accessToken = await getPayPalAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_CLIENT_SECRET
    );

    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!orderResponse.ok) {
      throw new Error('Failed to get order');
    }

    const order = await orderResponse.json();
    return c.json<ApiResponse<any>>({ success: true, data: order });
  } catch (err) {
    console.error('PayPal get-order error:', err);
    return c.json<ApiResponse<never>>({ success: false, error: '查询订单失败' }, 500);
  }
});
