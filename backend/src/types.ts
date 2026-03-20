// 类型定义

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
  updated_at?: string;
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

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 请求体类型
export interface CreateGoalRequest {
  name: string;
  total_hours: number;
}

export interface UpdateGoalRequest {
  name?: string;
  total_hours?: number;
}

export interface CreateLogRequest {
  goal_id: number;
  hours: number;
  date: string;
  note?: string;
}

export interface UpdateLogRequest {
  hours?: number;
  note?: string;
}
