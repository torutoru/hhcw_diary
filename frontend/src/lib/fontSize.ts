import type { FontSize } from '../api/types';

// 글자 크기 설정. 모든 font-size 가 calc(Npx * var(--font-scale)) 라서 이 값만 바꾸면 화면 전체 글자가 바뀐다.
// 버튼, 입력칸, 사진 같은 화면 틀은 그대로 둔다.
export const FONT_SCALES: Record<FontSize, number> = { small: 0.75, normal: 1, large: 1.25 };

// 이 기기에 마지막 설정을 기억해 둔다: 서버 응답 전 첫 화면과 로그인 화면도 같은 크기로 그리기 위해
const STORAGE_KEY = 'hhcw_font_size';

function isFontSize(v: unknown): v is FontSize {
  return typeof v === 'string' && v in FONT_SCALES;
}

export function applyFontSize(size: FontSize) {
  document.documentElement.style.setProperty('--font-scale', String(FONT_SCALES[size]));
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // 저장소를 못 쓰는 환경이면 이번 화면에만 적용
  }
}

/** 앱 시작 시 한 번: 이 기기에 기억된 크기를 먼저 적용 */
export function applySavedFontSize() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 무시
  }
  if (isFontSize(saved)) applyFontSize(saved);
}
