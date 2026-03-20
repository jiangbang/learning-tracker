import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getGoals } from '../api';
import ProgressBar from '../components/ProgressBar';
import CreateGoalModal from '../components/CreateGoalModal';

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  });

  const handleGoalCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">加载失败：{(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">📚 Learning Tracker</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
          >
            + 新增目标
          </button>
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
