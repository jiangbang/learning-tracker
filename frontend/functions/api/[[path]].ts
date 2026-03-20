// API 代理函数 - 将所有 /api/* 请求转发到 Workers
export async function onRequest(context: EventContext) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 构建目标 API URL
  const apiUrl = `https://api.keeprecord.shop${url.pathname}${url.search}`;
  
  // 转发请求
  const response = await fetch(apiUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  
  // 添加 CORS 头
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
