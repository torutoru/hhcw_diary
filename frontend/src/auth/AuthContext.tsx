import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { FontSize, User } from '../api/types';
import { applyFontSize } from '../lib/fontSize';
import { disablePush, resyncPush } from '../lib/notifications';

// 앱을 열 때 로그인 확인: 한 번에 1분씩 최대 2번(총 2분) 기다린다. 잠든 Render 가 깨는 데 1분쯤 걸린다
const ME_TIMEOUT_MS = 60_000;
const ME_ATTEMPTS = 2;
// 서버까지 못 간 빠른 실패(프록시 오류·로딩 페이지·네트워크 끊김)는 이 간격으로 다시 묻는다 (기다리는 시간 안에서)
const NOT_REACHED_RETRY_MS = 3000;

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateFontSize: (fontSize: FontSize) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱을 열 때 로그인 확인 (가족 문구 화면을 띄운 채):
  // - 정상 응답 → 피드 / 서버의 실제 오류 응답(401·403·500 등) → 로그인 화면
  // - 1분 안에 서버가 답하지 않으면(시간 초과, 프록시 오류·로딩 페이지·네트워크 끊김) 1분 더 기다리고,
  //   총 2분 동안 답이 없으면 로그인 화면
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const deadline = Date.now() + ME_TIMEOUT_MS * ME_ATTEMPTS;
    const finish = (u: User | null) => {
      setUser(u);
      setLoading(false);
      if (u) resyncPush();
    };

    const check = () => {
      const startedAt = Date.now();
      const wait = Math.min(ME_TIMEOUT_MS, deadline - startedAt);
      api
        .me(wait)
        .then((res) => alive && finish(res.user))
        .catch((err) => {
          if (!alive) return;
          const notReached = err instanceof ApiError && !err.reached;
          const left = deadline - Date.now();
          if (!notReached || left <= 0) return finish(null);
          // 1분을 다 기다린 시간 초과면 바로 다음 1분, 빨리 돌아온 실패면 잠깐 쉬고 다시
          const timedOut = Date.now() - startedAt >= wait;
          timer = window.setTimeout(check, timedOut ? 0 : Math.min(NOT_REACHED_RETRY_MS, left));
        });
    };
    check();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
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
    const res = await api.updateMe({ nickname });
    setUser(res.user);
  }, []);

  // 누르는 즉시 화면에 적용하고 저장한다. 저장에 실패하면 원래 크기로 되돌린다
  const updateFontSize = useCallback(
    async (fontSize: FontSize) => {
      const prev = user?.fontSize ?? 'normal';
      applyFontSize(fontSize);
      try {
        const res = await api.updateMe({ fontSize });
        setUser(res.user);
      } catch (err) {
        applyFontSize(prev);
        throw err;
      }
    },
    [user?.fontSize],
  );

  // 로그인한 계정의 설정을 화면 전체에 적용 (로그아웃해도 이 기기의 마지막 크기는 유지)
  useEffect(() => {
    if (user) applyFontSize(user.fontSize);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateNickname, updateFontSize }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서 써야 해요.');
  return ctx;
}
