// 数据库查询操作

import type { Goal, Log, CalendarDay, StreakData } from '../types';

// Goals - 按用户获取所有目标
export async function getGoalsByUserId(db: D1Database, userId: number): Promise<Goal[]> {
  const result = await db.prepare(`
    SELECT 
      g.id,
      g.name,
      g.total_hours,
      COALESCE(SUM(l.hours), 0) as completed_hours,
      g.created_at
    FROM goals g
    LEFT JOIN logs l ON g.id = l.goal_id
    WHERE g.user_id = ?
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).bind(userId).all();

  return result.results.map(row => ({
    id: row.id,
    name: row.name,
    total_hours: row.total_hours,
    completed_hours: row.completed_hours || 0,
    progress_percent: row.total_hours > 0
      ? Number(((row.completed_hours || 0) / row.total_hours * 100).toFixed(1))
      : 0,
    created_at: row.created_at
  }));
}

// 获取所有目标（保留兼容）
export async function getAllGoals(db: D1Database): Promise<Goal[]> {
  const result = await db.prepare(`
    SELECT 
      g.id,
      g.name,
      g.total_hours,
      COALESCE(SUM(l.hours), 0) as completed_hours,
      g.created_at
    FROM goals g
    LEFT JOIN logs l ON g.id = l.goal_id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all();
  
  return result.results.map(row => ({
    id: row.id,
    name: row.name,
    total_hours: row.total_hours,
    completed_hours: row.completed_hours || 0,
    progress_percent: row.total_hours > 0 
      ? Number(((row.completed_hours || 0) / row.total_hours * 100).toFixed(1)) 
      : 0,
    created_at: row.created_at
  }));
}

export async function getGoalById(db: D1Database, id: number, userId?: number): Promise<Goal | null> {
  let query = `
    SELECT 
      g.id,
      g.name,
      g.total_hours,
      g.user_id,
      COALESCE(SUM(l.hours), 0) as completed_hours,
      g.created_at
    FROM goals g
    LEFT JOIN logs l ON g.id = l.goal_id
    WHERE g.id = ?
  `;

  if (userId !== undefined) {
    query += ' AND g.user_id = ?';
  }
  query += ' GROUP BY g.id';

  const goalResult = userId !== undefined
    ? await db.prepare(query).bind(id, userId).first()
    : await db.prepare(query).bind(id).first();
  
  if (!goalResult) return null;
  
  const completedHours = goalResult.completed_hours || 0;
  const progressPercent = goalResult.total_hours > 0 
    ? Number((completedHours / goalResult.total_hours * 100).toFixed(1)) 
    : 0;
  
  // 计算连胜天数
  const streakData = await getStreakData(db, id);
  
  // 计算下一个里程碑
  const milestones = [10, 50, 100, 200, 500, 1000, 2000];
  const nextMilestone = milestones.find(m => m > completedHours);
  
  // 计算预计完成时间
  const recentLogs = await db.prepare(`
    SELECT hours, date FROM logs 
    WHERE goal_id = ? 
    ORDER BY date DESC 
    LIMIT 30
  `).bind(id).all();
  
  let estimatedCompletion = null;
  if (recentLogs.results.length > 0) {
    const totalRecentHours = recentLogs.results.reduce((sum: any, log: any) => sum + log.hours, 0);
    const avgHoursPerDay = totalRecentHours / recentLogs.results.length;
    if (avgHoursPerDay > 0) {
      const remainingHours = goalResult.total_hours - completedHours;
      const daysNeeded = Math.ceil(remainingHours / avgHoursPerDay);
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);
      estimatedCompletion = estimatedDate.toISOString().split('T')[0];
    }
  }
  
  return {
    id: goalResult.id,
    name: goalResult.name,
    total_hours: goalResult.total_hours,
    completed_hours: completedHours,
    progress_percent: progressPercent,
    streak_days: streakData.current_streak,
    longest_streak: streakData.longest_streak,
    next_milestone: nextMilestone ? {
      hours: nextMilestone,
      remaining: Math.max(0, nextMilestone - completedHours)
    } : undefined,
    estimated_completion: estimatedCompletion || undefined,
    created_at: goalResult.created_at
  };
}

export async function createGoal(db: D1Database, userId: number, name: string, totalHours: number): Promise<Goal> {
  const result = await db.prepare(`
    INSERT INTO goals (user_id, name, total_hours) VALUES (?, ?, ?)
  `).bind(userId, name, totalHours).run();
  
  return {
    id: result.meta.last_row_id,
    name,
    total_hours: totalHours,
    completed_hours: 0,
    progress_percent: 0,
    created_at: new Date().toISOString()
  };
}

export async function updateGoal(db: D1Database, id: number, userId: number, name?: string, totalHours?: number): Promise<Goal | null> {
  const updates: string[] = [];
  const binds: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    binds.push(name);
  }
  if (totalHours !== undefined) {
    updates.push('total_hours = ?');
    binds.push(totalHours);
  }
  
  if (updates.length === 0) return getGoalById(db, id, userId);
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  binds.push(id);
  binds.push(userId);
  
  await db.prepare(`
    UPDATE goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `).bind(...binds).run();
  
  return getGoalById(db, id, userId);
}

export async function deleteGoal(db: D1Database, id: number, userId: number): Promise<boolean> {
  const result = await db.prepare(`
    DELETE FROM goals WHERE id = ? AND user_id = ?
  `).bind(id, userId).run();
  
  return result.success;
}

// Logs
export async function getLogs(db: D1Database, goalId?: number, limit = 30): Promise<Log[]> {
  let query = `
    SELECT id, goal_id, hours, date, note, created_at
    FROM logs
  `;
  
  const binds: any[] = [];
  
  if (goalId) {
    query += ' WHERE goal_id = ?';
    binds.push(goalId);
  }
  
  query += ' ORDER BY date DESC, created_at DESC LIMIT ?';
  binds.push(limit);
  
  const result = await db.prepare(query).bind(...binds).all();
  return result.results;
}

export async function getLogById(db: D1Database, id: number): Promise<Log | null> {
  return await db.prepare(`
    SELECT id, goal_id, hours, date, note, created_at
    FROM logs
    WHERE id = ?
  `).bind(id).first();
}

export async function createLog(db: D1Database, goalId: number, hours: number, date: string, note?: string): Promise<Log> {
  const result = await db.prepare(`
    INSERT INTO logs (goal_id, hours, date, note) VALUES (?, ?, ?, ?)
  `).bind(goalId, hours, date, note || null).run();
  
  return {
    id: result.meta.last_row_id,
    goal_id: goalId,
    hours,
    date,
    note: note || undefined,
    created_at: new Date().toISOString()
  };
}

export async function updateLog(db: D1Database, id: number, hours?: number, note?: string): Promise<Log | null> {
  const updates: string[] = [];
  const binds: any[] = [];
  
  if (hours !== undefined) {
    updates.push('hours = ?');
    binds.push(hours);
  }
  if (note !== undefined) {
    updates.push('note = ?');
    binds.push(note);
  }
  
  if (updates.length === 0) return getLogById(db, id);
  
  binds.push(id);
  
  await db.prepare(`
    UPDATE logs SET ${updates.join(', ')} WHERE id = ?
  `).bind(...binds).run();
  
  return getLogById(db, id);
}

export async function deleteLog(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`
    DELETE FROM logs WHERE id = ?
  `).bind(id).run();
  
  return result.success;
}

// Stats
export async function getCalendarData(db: D1Database, goalId: number, yearMonth: string): Promise<CalendarDay[]> {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const result = await db.prepare(`
    SELECT date, SUM(hours) as hours
    FROM logs
    WHERE goal_id = ?
      AND strftime('%Y-%m', date) = ?
    GROUP BY date
  `).bind(goalId, yearMonth).all();
  
  const logMap = new Map(result.results.map((r: any) => [r.date, r.hours]));
  
  const calendar: CalendarDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendar.push({
      date,
      hours: logMap.get(date) || 0
    });
  }
  
  return calendar;
}

export async function getStreakData(db: D1Database, goalId: number): Promise<StreakData> {
  const result = await db.prepare(`
    SELECT date FROM logs
    WHERE goal_id = ?
    ORDER BY date DESC
  `).bind(goalId).all();
  
  if (result.results.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_log_date: null
    };
  }
  
  const dates = result.results.map((r: any) => r.date).sort((a: string, b: string) => b.localeCompare(a));
  const lastLogDate = dates[0];
  
  // 计算当前连胜
  let currentStreak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(lastLogDate);
  lastDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays > 1) {
    currentStreak = 0;
  } else {
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const dayDiff = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // 计算最长连胜
  let longestStreak = 1;
  let tempStreak = 1;
  
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const dayDiff = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  
  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_log_date: lastLogDate
  };
}
