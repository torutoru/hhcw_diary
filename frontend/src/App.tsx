import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import FeedDetailModal from './components/FeedDetailModal';
import CalendarPage from './pages/CalendarPage';
import ComposePage from './pages/ComposePage';
import ConfirmPage from './pages/ConfirmPage';
import FeedPage from './pages/FeedPage';
import LoginPage from './pages/LoginPage';
import MembersPage from './pages/MembersPage';
import SignupPage from './pages/SignupPage';

function RequireAuth({ children, parentOnly = false }: { children: ReactNode; parentOnly?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-loading">불러오는 중…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (parentOnly && user.role !== 'parent') return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-loading">불러오는 중…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><SignupPage /></GuestOnly>} />
        <Route path="/signup/confirm" element={<ConfirmPage />} />
        <Route path="/" element={<RequireAuth><FeedPage /></RequireAuth>}>
          {/* 피드 목록 위에 모달로 띄운다 */}
          <Route path="feeds/:id" element={<FeedDetailModal />} />
        </Route>
        <Route path="/compose" element={<RequireAuth parentOnly><CalendarPage /></RequireAuth>} />
        <Route path="/compose/:date" element={<RequireAuth parentOnly><ComposePage /></RequireAuth>} />
        {/* 권한이 없으면 페이지 안에서 "관리자만 볼 수 있어요"를 보여준다 */}
        <Route path="/members" element={<RequireAuth><MembersPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
