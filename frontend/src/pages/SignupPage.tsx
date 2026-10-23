import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { BackIcon, MailIcon } from '../components/Icons';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = password2.length > 0 && password !== password2;
  const canSubmit =
    email && relation.trim() && nickname.trim() && password.length >= 4 && password === password2 && !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await api.signup(email, password, relation.trim(), nickname.trim());
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setDone(false);
    setPassword('');
    setPassword2('');
  }

  return (
    <>
      <div className="topbar">
        <Link to="/login" className="icon-btn" aria-label="로그인으로 돌아가기">
          <BackIcon />
        </Link>
      </div>

      {done ? (
        <main className="result" style={{ paddingTop: 80 }}>
          <div className="result-icon" style={{ width: 84, height: 84 }}>
            <MailIcon />
          </div>
          <h1 className="display" style={{ fontSize: 'calc(26px * var(--font-scale))' }}>가입 요청을 보냈어요</h1>
          <p>
            관리자에게 승인 메일이 전송됐어요.
            {'\n'}승인 링크는 1시간 동안만 유효해요.
            {'\n'}승인되면 이 이메일로 로그인할 수 있어요.
          </p>
          <Link to="/login" className="btn btn-primary">
            로그인 화면으로
          </Link>
          <button type="button" className="btn-text" onClick={reset}>
            다시 입력하기
          </button>
        </main>
      ) : (
        <form className="page-pad" onSubmit={onSubmit}>
          <div className="stack" style={{ gap: 8 }}>
            <h1 className="page-title display">가족 가입 요청</h1>
            <p className="page-desc">요청을 보내면 관리자가 메일로 승인해요.</p>
            <div className="guide">
              <p>
                가족관계 <b>엄마</b>, <b>아빠</b>는 한 명씩만 등록할 수 있어요.
              </p>
              <p>피드 작성·수정과 구성원 관리는 엄마, 아빠만 할 수 있어요.</p>
              <p>나머지 가족은 가족관계를 자유롭게 입력하고, 피드를 보고 댓글을 남길 수 있어요.</p>
              <p>가족관계는 가입 후 바꿀 수 없어요. 호칭은 내 정보에서 언제든 바꿀 수 있어요.</p>
            </div>
          </div>

          <div className="stack" style={{ gap: 18 }}>
            <div className="field">
              <label htmlFor="su-email">이메일</label>
              <input
                id="su-email"
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
              <label htmlFor="su-relation">가족관계</label>
              <input
                id="su-relation"
                className="input"
                type="text"
                placeholder="예: 엄마, 아빠, 큰딸, 할머니"
                maxLength={20}
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                required
              />
              <span className="hint">권한을 정하는 정보예요. 이름 옆에 작게 표시돼요.</span>
            </div>
            <div className="field">
              <label htmlFor="su-nickname">호칭</label>
              <input
                id="su-nickname"
                className="input"
                type="text"
                placeholder="예: 햇살맘, 우리집대장, 꼬맹이"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
              <span className="hint">댓글과 화면에 이 이름으로 보여요.</span>
            </div>
            <div className="field">
              <label htmlFor="su-pw">비밀번호</label>
              <input
                id="su-pw"
                className="input"
                type="password"
                autoComplete="new-password"
                placeholder="4자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="hint">4자 이상이면 돼요.</span>
            </div>
            <div className="field">
              <label htmlFor="su-pw2">비밀번호 확인</label>
              <input
                id="su-pw2"
                className={`input${mismatch ? ' is-error' : ''}`}
                type="password"
                autoComplete="new-password"
                placeholder="한 번 더 입력"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                aria-invalid={mismatch}
                aria-describedby={mismatch ? 'su-pw2-error' : undefined}
                required
              />
              {mismatch && (
                <span id="su-pw2-error" className="error-text">
                  비밀번호가 서로 달라요.
                </span>
              )}
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 'auto' }} disabled={!canSubmit}>
            {submitting ? '보내는 중…' : '가입 요청 보내기'}
          </button>
        </form>
      )}
    </>
  );
}
