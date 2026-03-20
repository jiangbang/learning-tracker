import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGoal, getLogs, deleteGoal } from '../api';
import ProgressBar from '../components/ProgressBar';
import CalendarView from '../components/CalendarView';
import LogModal from '../components/LogModal';

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLogModal, setShowLogModal] = useState(false);

  const goalId = id ? parseInt(id) : 0;

  const { data: goal, isLoading: goalLoading } = useQuery({
    queryKey: ['goal', goalId],
    queryFn: () => getGoal(goalId),
    enabled: !!id,
  });

  const { data: logs } = useQuery({
    queryKey: ['logs', goalId],
    queryFn: () => getLogs(goalId, 10),
    enabled: !!id,
  });

  const handleLogCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['goal', goalId] });
    queryClient.invalidateQueries({ queryKey: ['logs', goalId] });
    queryClient.invalidateQueries({ queryKey: ['calendar', goalId] });
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除这个目标吗？所有打卡记录也会被删除。')) {
      return;
    }

    try {
      await deleteGoal(goalId);
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      navigate('/');
    } catch (err) {
      alert('删除失败');
    }
  };

  if (goalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">目标不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← 返回
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{goal.name}</h1>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            删除
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-500 mb-4">总进度</h2>
          <ProgressBar
            progress={goal.progress_percent || 0}
            completed={goal.completed_hours || 0}
            total={goal.total_hours}
            className="mb-4"
          />
          
          {goal.estimated_completion && (
            <p className="text-sm text-gray-600">
              预计完成：{goal.estimated_completion}
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-2xl font-bold text-orange-500">🔥</div>
            <div className="text-sm text-gray-500 mt-1">当前连胜</div>
            <div className="text-xl font-semibold">{goal.streak_days || 0} 天</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-2xl font-bold text-yellow-500">🏆</div>
            <div className="text-sm text-gray-500 mt-1">最长连胜</div>
            <div className="text-xl font-semibold">{goal.longest_streak || 0} 天</div>
          </div>
        </div>

        {/* Next Milestone */}
        {goal.next_milestone && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <div>
                <div className="text-sm font-medium text-gray-700">
                  下一个里程碑：{goal.next_milestone.hours} 小时
                </div>
                <div className="text-sm text-gray-500">
                  还差 {goal.next_milestone.remaining} 小时
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="text-sm font-medium text-gray-700">📅 本月打卡记录</h2>
          </div>
          <CalendarView goalId={goalId} />
        </div>

        {/* Recent Logs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">最近记录</h2>
          </div>
          <div className="divide-y">
            {logs && logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{log.hours} 小时</div>
                      {log.note && (
                        <div className="text-sm text-gray-500 mt-1">{log.note}</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">{log.date}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                还没有打卡记录
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowLogModal(true)}
          className="w-full py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 shadow-lg"
        >
          ➕ 今天学了多久？
        </button>
      </main>

      {/* Log Modal */}
      {showLogModal && (
        <LogModal
          goalId={goalId}
          onClose={() => setShowLogModal(false)}
          onSuccess={handleLogCreated}
        />
      )}
    </div>
  );
}
