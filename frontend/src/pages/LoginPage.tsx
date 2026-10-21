import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HomeHeartIcon } from '../components/Icons';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
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
        <h1 className="display">우리가족</h1>
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
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
        <Link to="/signup" className="btn btn-outline">
          회원가입
        </Link>
      </form>

      <p className="auth-foot">
        가족만 쓰는 공간이에요.
        <br />
        가입하면 관리자 승인 후 로그인할 수 있어요.
      </p>
    </main>
  );
}
