import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = 'https://api.keeprecord.shop/api';
const STORAGE_KEY = 'learning_tracker_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化 - 从 localStorage 恢复登录状态
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { user: savedUser, token: savedToken } = JSON.parse(saved);
        setUser(savedUser);
        setToken(savedToken);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  // 登录 - 跳转到后端 OAuth
  const login = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  // 登出
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 导出登录处理函数供 AuthCallback 页面调用
export function useAuthCallback() {
  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
    window.location.href = '/';
  };
  return setAuth;
}
