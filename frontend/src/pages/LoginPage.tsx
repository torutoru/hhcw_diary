import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HomeHeartIcon } from '../components/Icons';
import { InstallCard } from '../components/InstallGuide';
import LoadingText, { useSlow } from '../components/LoadingText';
import { APP_NAME } from '../lib/app';
import { loadRememberedEmail, saveRememberedEmail } from '../lib/rememberLogin';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(() => loadRememberedEmail() ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => loadRememberedEmail() !== null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const slow = useSlow(submitting);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password, remember);
      saveRememberedEmail(remember ? email.trim().toLowerCase() : null);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="brand">
        <div className="brand-mark">
          <HomeHeartIcon />
        </div>
        <h1 className="display">{APP_NAME}</h1>
        <p>하루 한 장, 우리 집 이야기</p>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="family@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-pw">비밀번호</label>
          <input
            id="login-pw"
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>아이디 · 로그인 상태 기억하기</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <LoadingText text="로그인 중" /> : '로그인'}
        </button>
        {/* 5초 넘게 걸리면: 잠든 서버가 깨어나는 중이라고 알려준다 */}
        {slow && (
          <p className="slow-hint" role="status">
            서버를 깨우고 있어요. 첫 접속은 30초쯤 걸릴 수 있어요.
          </p>
        )}
        <Link to="/signup" className="btn btn-outline">
          회원가입
        </Link>
      </form>

      {/* 홈 화면 앱 설치 안내. 아이폰은 설치 후 처음 열 때 다시 로그인해야 해서 로그인 화면에 둔다 */}
      <InstallCard />

      <p className="auth-foot">
        가족만 쓰는 공간이에요.
        <br />
        가입하면 관리자 승인 후 로그인할 수 있어요.
      </p>
    </main>
  );
}
