import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { FontSize } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { BackIcon } from '../components/Icons';
import { NotificationSettings } from '../components/NotificationSettings';
import { Avatar, PersonName } from '../components/Person';

const TOAST_MS = 3000;

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: '작게' },
  { value: 'normal', label: '보통' },
  { value: 'large', label: '크게' },
];

/** /me — 내 정보: 이메일(고정), 호칭(수정 가능), 가족관계(고정), 글자 크기(누르면 바로 저장) */
export default function MyInfoPage() {
  const { user, updateNickname, updateFontSize } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fontSaving, setFontSaving] = useState(false);
  const [fontError, setFontError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), TOAST_MS);
  }

  if (!user) return null;

  const trimmed = nickname.trim();
  const changed = trimmed !== user.nickname;
  const canSave = trimmed.length > 0 && changed && !saving;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await updateNickname(trimmed);
      setNickname(trimmed);
      showToast('호칭을 바꿨어요');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onPickFontSize(fontSize: FontSize) {
    if (!user || fontSize === user.fontSize || fontSaving) return;
    setFontSaving(true);
    setFontError('');
    try {
      await updateFontSize(fontSize);
      showToast(`글자 크기를 ‘${FONT_SIZE_OPTIONS.find((o) => o.value === fontSize)!.label}’로 바꿨어요`);
    } catch (err) {
      setFontError((err as Error).message);
    } finally {
      setFontSaving(false);
    }
  }

  return (
    <div className="members-page">
      <header className="sub-header">
        <Link to="/" className="icon-btn" aria-label="피드로 돌아가기">
          <BackIcon />
        </Link>
        <h1 className="display">내 정보</h1>
      </header>

      <form className="members" onSubmit={onSubmit}>
        <div className="member-me">
          <Avatar nickname={trimmed || user.nickname} relation={user.relation} size="lg" />
          <div className="member-text">
            <div className="member-name">
              <PersonName nickname={trimmed || user.nickname} relation={user.relation} />
              {user.role === 'parent' && <span className="badge-admin">관리자</span>}
            </div>
            <span className="member-email">{user.email}</span>
          </div>
        </div>

        <div className="stack" style={{ gap: 18 }}>
          <div className="field">
            <label htmlFor="me-email">이메일</label>
            <input id="me-email" className="input is-readonly" type="email" value={user.email} readOnly />
            <span className="hint">로그인에 쓰는 이메일은 바꿀 수 없어요.</span>
          </div>

          <div className="field">
            <label htmlFor="me-nickname">호칭</label>
            <input
              id="me-nickname"
              className="input"
              type="text"
              maxLength={20}
              placeholder="예: 햇살맘"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
            <span className="hint">댓글과 화면에 이 이름으로 보여요.</span>
          </div>

          <div className="field">
            <label htmlFor="me-relation">가족관계</label>
            <input id="me-relation" className="input is-readonly" type="text" value={user.relation} readOnly />
            <span className="hint">
              권한을 정하는 정보라 바꿀 수 없어요.
              {user.role === 'parent' ? ' 엄마·아빠는 피드 작성과 구성원 관리를 할 수 있어요.' : ''}
            </span>
          </div>

          <div className="field">
            <span className="field-label" id="me-font-size">
              글자 크기
            </span>
            <div className="font-size-options" role="radiogroup" aria-labelledby="me-font-size">
              {FONT_SIZE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={user.fontSize === o.value}
                  className="font-size-option"
                  disabled={fontSaving}
                  onClick={() => onPickFontSize(o.value)}
                >
                  <span className={`font-size-sample is-${o.value}`} aria-hidden="true">
                    가
                  </span>
                  <span className="font-size-name">{o.label}</span>
                </button>
              ))}
            </div>
            <span className="hint">누르면 바로 앱 전체 글자 크기가 바뀌어요. 다른 기기에서도 같은 크기로 보여요.</span>
            {fontError && <span className="error-text">{fontError}</span>}
          </div>

          <NotificationSettings />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: 'auto' }} disabled={!canSave}>
          {saving ? '저장 중…' : '호칭 저장하기'}
        </button>
      </form>

      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')}>
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
