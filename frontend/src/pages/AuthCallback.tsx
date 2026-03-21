import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const picture = searchParams.get('picture');
    const authError = searchParams.get('auth_error');

    if (authError) {
      console.error('Auth error:', authError);
      window.location.href = `/?auth_error=${authError}`;
      return;
    }

    if (token && email) {
      // 保存登录信息
      const user = {
        email,
        name: decodeURIComponent(name || ''),
        picture: decodeURIComponent(picture || ''),
      };

      localStorage.setItem(
        'learning_tracker_auth',
        JSON.stringify({ token, user })
      );

      // 跳转到首页
      window.location.href = '/';
    } else {
      // 缺少必要参数
      window.location.href = '/?auth_error=missing_params';
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">正在登录...</h2>
        <p className="text-gray-500">请稍候</p>
      </div>
    </div>
  );
}
