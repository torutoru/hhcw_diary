import { useSyncExternalStore } from 'react';

// 크롬(안드로이드)이 "설치할 수 있음"을 알려주는 이벤트. 표준 타입에 없어서 직접 선언
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** main.tsx 에서 앱 시작 전에 한 번 호출. 이벤트가 화면보다 먼저 올 수 있어서 일찍 붙인다 */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // 크롬 기본 설치 배너 대신 로그인 화면 안내 카드·프로필 메뉴에서 설치 창을 띄운다
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

const ua = () => navigator.userAgent;

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS 사파리 홈 화면 실행
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  // iPadOS 는 맥으로 보이므로 터치 지원으로 구분
  return /iPad|iPhone|iPod/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
  return /Android/i.test(ua());
}

/** 카카오톡·네이버·인스타그램 등 앱 안 브라우저: 홈 화면 설치가 안 된다 */
function isInAppBrowser() {
  return /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(ua());
}

/**
 * 지금 기기에서 가능한 설치 방법.
 * - installed: 이미 앱으로 실행 중(또는 방금 설치함)
 * - inapp: 앱 안 브라우저 → 사파리/크롬으로 열어야 함
 * - prompt: 안드로이드 크롬 등 → 설치 창을 바로 띄울 수 있음
 * - ios: 공유 → 홈 화면에 추가 (사파리·크롬)
 * - android-menu: 안드로이드인데 설치 창이 아직 준비 안 됨 → 크롬 메뉴에서 설치
 * - desktop: PC 인데 설치 창이 아직 준비 안 됨 (개발 서버 등) → 주소창 설치 아이콘·메뉴 안내
 */
export type InstallMode = 'installed' | 'inapp' | 'prompt' | 'ios' | 'android-menu' | 'desktop';

function getMode(): InstallMode {
  if (installed || isStandalone()) return 'installed';
  if (isInAppBrowser()) return 'inapp';
  if (deferred) return 'prompt';
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android-menu';
  return 'desktop';
}

export function useInstallMode() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getMode,
    () => 'desktop' as InstallMode,
  );
}

/** 안드로이드 설치 창 띄우기. 설치했으면 true */
export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === 'accepted';
}

// 로그인 화면의 설치 안내 카드를 닫았는지 (기기별로 기억).
// v2: 카드를 메인 피드에서 로그인 화면으로 옮기면서, 예전에 닫은 기록과 상관없이 한 번 다시 보이게 함
const DISMISS_KEY = 'hhcw.installCardDismissed.v2';

export function isInstallCardDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstallCard() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // 저장이 막혀도 이번 화면에서는 닫힌다
  }
}
