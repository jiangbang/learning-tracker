// API 基础地址 - 生产环境使用自定义域名
const API_BASE = 'https://api.keeprecord.shop/api';

export function getStoredAuth() {
  const saved = localStorage.getItem('learning_tracker_auth');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

function authHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (auth?.token) {
    return { Authorization: `Bearer ${auth.token}` };
  }
  return {};
}

export interface Goal {
  id: number;
  name: string;
  total_hours: number;
  completed_hours?: number;
  progress_percent?: number;
  streak_days?: number;
  longest_streak?: number;
  next_milestone?: {
    hours: number;
    remaining: number;
  };
  estimated_completion?: string;
  created_at: string;
}

export interface Log {
  id: number;
  goal_id: number;
  hours: number;
  date: string;
  note?: string;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  hours: number;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data: ApiResponse<T> = await response.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

// Goals API
export async function getGoals(): Promise<Goal[]> {
  const response = await fetch(`${API_BASE}/goals`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<Goal[]>(response);
}

export async function getGoal(id: number): Promise<Goal> {
  const response = await fetch(`${API_BASE}/goals/${id}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<Goal>(response);
}

export async function createGoal(name: string, totalHours: number): Promise<Goal> {
  const response = await fetch(`${API_BASE}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, total_hours: totalHours }),
  });
  return handleResponse<Goal>(response);
}

export async function updateGoal(id: number, name?: string, totalHours?: number): Promise<Goal> {
  const response = await fetch(`${API_BASE}/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, total_hours: totalHours }),
  });
  return handleResponse<Goal>(response);
}

export async function deleteGoal(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/goals/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleResponse(response);
}

// Logs API
export async function getLogs(goalId?: number, limit = 30): Promise<Log[]> {
  const params = new URLSearchParams();
  if (goalId) params.set('goalId', String(goalId));
  params.set('limit', String(limit));
  
  const response = await fetch(`${API_BASE}/logs?${params}`, {
    headers: authHeaders(),
  });
  return handleResponse<Log[]>(response);
}

export async function createLog(goalId: number, hours: number, date: string, note?: string): Promise<Log> {
  const response = await fetch(`${API_BASE}/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ goal_id: goalId, hours, date, note }),
  });
  return handleResponse<Log>(response);
}

export async function updateLog(id: number, hours?: number, note?: string): Promise<Log> {
  const response = await fetch(`${API_BASE}/logs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ hours, note }),
  });
  return handleResponse<Log>(response);
}

export async function deleteLog(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/logs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleResponse(response);
}

// Stats API
export async function getCalendarData(goalId: number, month: string): Promise<{ month: string; days: CalendarDay[] }> {
  const params = new URLSearchParams({ goalId: String(goalId), month });
  const response = await fetch(`${API_BASE}/stats/calendar?${params}`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
}

export async function getStreakData(goalId: number): Promise<StreakData> {
  const response = await fetch(`${API_BASE}/stats/streak?goalId=${goalId}`, {
    headers: authHeaders(),
  });
  return handleResponse<StreakData>(response);
}

// Auth API
export async function verifyToken(token: string): Promise<{ email: string; exp: number }> {
  const response = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: token }),
  });
  return handleResponse(response);
}

export async function getCurrentUser(token: string): Promise<{ email: string; user_id: number }> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}
