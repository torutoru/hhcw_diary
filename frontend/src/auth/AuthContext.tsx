import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';
import { disablePush, resyncPush } from '../lib/notifications';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setUser(res.user);
        resyncPush();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const res = await api.login(email, password, remember);
    setUser(res.user);
    // 이 기기에서 전에 알림을 켰다면 지금 로그인한 계정으로 다시 연결
    resyncPush();
  }, []);

  const logout = useCallback(async () => {
    // 로그아웃한 기기로 알림이 가지 않게 먼저 해제 (서버 요청에 로그인이 필요해서 로그아웃 전에)
    await disablePush().catch(() => undefined);
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const updateNickname = useCallback(async (nickname: string) => {
    const res = await api.updateMe(nickname);
    setUser(res.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateNickname }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서 써야 해요.');
  return ctx;
}
