// "아이디 · 로그인 상태 기억하기"에서 브라우저에 남기는 값. 비밀번호는 저장하지 않는다.
// 로그인 상태 자체는 서버가 httpOnly 쿠키로 유지한다 (마지막 사용 후 30일).
const KEY = 'hhcw.rememberedEmail';

export function loadRememberedEmail(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveRememberedEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(KEY, email);
    else localStorage.removeItem(KEY);
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 로그인은 그대로 진행
  }
}
