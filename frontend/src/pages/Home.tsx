import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getGoals } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import CreateGoalModal from '../components/CreateGoalModal';

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user, isLoading: authLoading, login, logout } = useAuth();

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  });

  const handleGoalCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  // 未登录时显示登录提示
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-800">📚 Learning Tracker</h1>
            <button
              onClick={login}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google 登录
            </button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
            <p className="text-gray-500 mb-6">登录 Google 账号以开始追踪你的学习进度</p>
            <button
              onClick={login}
              className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              使用 Google 登录
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">📚 Learning Tracker</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 hover:bg-gray-100 rounded-md px-2 py-1"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                  {user.name?.[0] || user.email[0]}
                </div>
              )}
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user.name || user.email}
              </span>
            </button>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              退出
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
            >
              + 新增目标
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {goals && goals.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">还没有学习目标</h2>
            <p className="text-gray-500 mb-6">创建你的第一个目标，开始追踪学习进度吧！</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              创建目标
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals?.map((goal) => (
              <div
                key={goal.id}
                onClick={() => navigate(`/goal/${goal.id}`)}
                className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{goal.name}</h3>
                    {goal.streak_days !== undefined && (
                      <p className="text-sm text-orange-500 mt-1">
                        🔥 连胜 {goal.streak_days} 天
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {goal.progress_percent?.toFixed(1)}%
                  </span>
                </div>
                
                <ProgressBar
                  progress={goal.progress_percent || 0}
                  completed={goal.completed_hours || 0}
                  total={goal.total_hours}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGoalModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleGoalCreated}
        />
      )}
    </div>
  );
}
