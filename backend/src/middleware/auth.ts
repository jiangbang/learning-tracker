// JWT 认证中间件 - 使用 Web Crypto API（Cloudflare Workers 原生支持）

import { Context, Next } from 'hono';

interface JwtPayload {
  sub: number;       // user_id
  email: string;
  iat: number;
  exp: number;
}

// Base64url 编码/解码
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// 获取 HMAC 签名密钥
async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// 签发 JWT（有效期 7 天）
export async function signJwt(
  payload: { sub: number; email: string },
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 天
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

// 验证 JWT，返回 payload 或 null
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signatureB64),
      encoder.encode(signingInput)
    );

    if (!valid) return null;

    const payload: JwtPayload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64))
    );

    // 检查过期
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// Hono 中间件 - 解析 JWT 并设置 currentUser
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const token = authHeader.slice(7);
  const jwtSecret = (c.env as any).JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    return c.json({ success: false, error: '服务器配置错误' }, 500);
  }

  const payload = await verifyJwt(token, jwtSecret);

  if (!payload) {
    return c.json({ success: false, error: '登录已过期，请重新登录' }, 401);
  }

  c.set('currentUser', { id: payload.sub, email: payload.email });
  await next();
}
