// Google OAuth 认证路由

import { Hono } from 'hono';
import { findOrCreateUser } from '../db/user-queries';
import { signJwt, verifyJwt } from '../middleware/auth';

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  AUTH_CALLBACK_URL: string;
  JWT_SECRET: string;
}

interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export const authRouter = new Hono<{ Bindings: Env }>();

const FRONTEND_URL = 'https://www.keeprecord.shop';

// Google OAuth 配置
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// GET /api/auth/google - 发起 Google 登录
authRouter.get('/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${c.env.AUTH_CALLBACK_URL}/api/auth/callback`;

  if (!clientId) {
    return c.json({ success: false, error: 'Google OAuth 未配置' }, 500);
  }

  // 生成随机 state 防止 CSRF
  const state = crypto.randomUUID();

  // 构建授权 URL
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return c.redirect(authUrl.toString());
});

// GET /api/auth/callback - Google 回调处理
authRouter.get('/callback', async (c) => {
  const { code, error } = c.req.query();

  // 如果用户拒绝授权
  if (error) {
    return c.redirect(`${FRONTEND_URL}?auth_error=${error}`);
  }

  // 验证 code
  if (!code) {
    return c.redirect(`${FRONTEND_URL}?auth_error=no_code`);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${c.env.AUTH_CALLBACK_URL}/api/auth/callback`;

  try {
    // 1. 用 authorization code 换 access_token 和 id_token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // 2. 用 access_token 获取用户信息
    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo: UserInfo = await userResponse.json();
    const { email, name, picture } = userInfo;

    // 3. 查询或创建用户（你的 D1 数据库）
    if (!userInfo.id) {
      throw new Error('Google user ID not found');
    }
    const user = await findOrCreateUser(c.env.DB, userInfo.id, email, name || null, picture || null);

    // 4. 生成自有 JWT（有效期 7 天）
    const sessionToken = await signJwt(
      { sub: user.id, email },
      c.env.JWT_SECRET
    );

    // 5. 返回给前端
    return c.redirect(
      `${FRONTEND_URL}/auth-callback?token=${sessionToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name || '')}&picture=${encodeURIComponent(picture || '')}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.redirect(`${FRONTEND_URL}?auth_error=callback_failed`);
  }
});

// POST /api/auth/verify - 验证 token（前端调用）
authRouter.post('/verify', async (c) => {
  const { id_token } = await c.req.json();

  if (!id_token) {
    return c.json({ success: false, error: '缺少 token' }, 400);
  }

  try {
    const payload = await verifyJwt(id_token, c.env.JWT_SECRET);

    if (!payload) {
      throw new Error('Invalid token');
    }

    return c.json({
      success: true,
      data: {
        email: payload.email,
        exp: payload.exp,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Token 验证失败' }, 401);
  }
});

// GET /api/auth/me - 获取当前用户信息（需要验证 token）
authRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);

    if (!payload) {
      throw new Error('Invalid token');
    }

    return c.json({
      success: true,
      data: {
        email: payload.email,
        user_id: payload.sub,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Token 验证失败' }, 401);
  }
});
