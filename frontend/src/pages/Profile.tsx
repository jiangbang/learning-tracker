import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface UserStats {
  total_goals: number;
  total_hours: number;
  current_streak: number;
  longest_streak: number;
  subscription_plan: string;
}

interface SubscriptionInfo {
  plan: string;
  goals_count: number;
  goals_limit: number;
}

function getAuthHeaders(): Record<string, string> {
  const saved = localStorage.getItem('learning_tracker_auth');
  const token = saved ? JSON.parse(saved).token : '';
  return { Authorization: `Bearer ${token}` };
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [paypalStatus, setPaypalStatus] = useState<string | null>(null);

  // 处理 PayPal 支付回调
  useEffect(() => {
    const paypalResult = searchParams.get('paypal');
    const paypalToken = searchParams.get('token'); // PayPal 回调带的 order ID

    if (paypalResult === 'success' && paypalToken) {
      capturePayPalOrder(paypalToken);
    } else if (paypalResult === 'cancelled') {
      setPaypalStatus('cancelled');
      setIsUpgrading(false);
    }
  }, [searchParams]);

  async function capturePayPalOrder(orderId: string) {
    setIsLoading(true);
    try {
      const res = await fetch('https://api.keeprecord.shop/api/payment/paypal/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaypalStatus('success');
        // 刷新订阅信息
        await loadSubscription();
      } else {
        setPaypalStatus('failed');
        setError(data.error || '支付失败');
      }
    } catch {
      setPaypalStatus('failed');
      setError('支付验证失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubscription() {
    try {
      const res = await fetch('https://api.keeprecord.shop/api/subscription', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.data);
      }
    } catch {
      setError('获取订阅信息失败');
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }

    // 获取用户统计
    fetch('https://api.keeprecord.shop/api/users/stats', {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.data);
        }
      })
      .catch(console.error);

    // 获取订阅信息
    loadSubscription().then(() => setIsLoading(false));
  }, [user, authLoading, navigate]);

  async function handleUpgrade() {
    if (!user) return;
    setIsUpgrading(true);
    setError(null);
    setPaypalStatus(null);

    try {
      const res = await fetch('https://api.keeprecord.shop/api/payment/paypal/create', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '创建订单失败');
      }

      // 跳转到 PayPal 批准页面
      if (data.data?.approval_url) {
        window.location.href = data.data.approval_url;
      } else {
        throw new Error('未收到 PayPal 链接');
      }
    } catch (err: any) {
      setError(err.message || '发起支付失败');
      setIsUpgrading(false);
    }
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-gray-800">个人中心</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* PayPal 状态提示 */}
        {paypalStatus === 'success' && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✅ 支付成功！您已是 Pro 用户，享受无限目标创建。
          </div>
        )}
        {paypalStatus === 'cancelled' && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
            支付已取消，您可以稍后再试。
          </div>
        )}
        {paypalStatus === 'failed' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error || '支付失败，请联系客服。'}
          </div>
        )}

        {/* 用户信息卡片 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                {user.name?.[0] || user.email[0]}
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {user.name || '未设置昵称'}
              </h2>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        {/* 订阅计划卡片 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">订阅计划</h3>

          {subscription && (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      subscription.plan === 'pro'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {subscription.plan === 'pro' ? 'Pro' : '免费版'}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {subscription.plan === 'pro'
                      ? '无限目标'
                      : `${subscription.goals_count}/1 目标`}
                  </span>
                </div>
              </div>

              {subscription.plan !== 'pro' && (
                <button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpgrading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      跳转 PayPal...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.657h6.999c2.557 0 4.082.243 4.545.725.46.479.476 1.12.046 1.901l-6.21 11.27a.385.385 0 0 1-.36.213l-2.091.165z"/>
                      </svg>
                      升级到 Pro（$0.01/月）
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {error && !paypalStatus && (
            <div className="text-red-500 text-sm mt-2">{error}</div>
          )}

          <div className="mt-4 text-xs text-gray-400">
            支付由 PayPal 沙盒环境提供 · 测试模式
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">学习统计</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-500">
                  {stats.total_goals}
                </div>
                <div className="text-gray-500 text-sm mt-1">总目标数</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-green-500">
                  {stats.total_hours.toFixed(1)}
                </div>
                <div className="text-gray-500 text-sm mt-1">总学习小时</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-500">
                  {stats.current_streak}
                </div>
                <div className="text-gray-500 text-sm mt-1">当前连续天数</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-500">
                  {stats.longest_streak}
                </div>
                <div className="text-gray-500 text-sm mt-1">最长连续天数</div>
              </div>
            </div>
          </div>
        )}

        {/* 功能菜单 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <button className="w-full flex items-center justify-between text-left">
              <span className="text-gray-700">账号设置</span>
              <span className="text-gray-400">→</span>
            </button>
          </div>
          <div className="p-4 border-b border-gray-100">
            <button className="w-full flex items-center justify-between text-left">
              <span className="text-gray-700">帮助与反馈</span>
              <span className="text-gray-400">→</span>
            </button>
          </div>
          <div className="p-4">
            <button className="w-full flex items-center justify-between text-left text-red-500">
              <span>退出登录</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
