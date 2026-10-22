import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { isStandalone } from './pwa';

/**
 * 이 기기의 알림 상태
 * - unsupported: 브라우저가 웹 푸시를 지원하지 않거나 서비스 워커가 없음 (개발 서버 등)
 * - needs-install: 아이폰인데 홈 화면 앱이 아님 (iOS 는 설치한 앱에서만 알림 가능)
 * - unavailable: 서버에 알림 키가 설정되지 않음
 * - denied: 사용자가 브라우저·OS 설정에서 알림을 막음
 * - off: 알림을 받을 수 있지만 아직 켜지 않음
 * - on: 이 기기에서 알림 받는 중
 */
export type PushStatus = 'unsupported' | 'needs-install' | 'unavailable' | 'denied' | 'off' | 'on';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** 개발 서버에서는 서비스 워커가 없으니 ready 를 기다리지 않고 바로 확인한다 */
async function getRegistration() {
  if (!('serviceWorker' in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration();
}

function base64UrlToBytes(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

let publicKeyCache: Promise<string | null> | null = null;
const publicKey = () => (publicKeyCache ??= api.pushPublicKey().then((r) => r.publicKey).catch(() => null));

export async function getPushStatus(): Promise<PushStatus> {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported';
  const reg = await getRegistration();
  if (!reg) return 'unsupported';
  if (!(await publicKey())) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** 알림 켜기. 반드시 버튼 클릭 안에서 불러야 한다 (아이폰은 사용자 동작 없이 권한을 물을 수 없음) */
export async function enablePush(): Promise<PushStatus> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await getRegistration();
  const key = await publicKey();
  if (!reg || !key) return 'unavailable';

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) }));
  await api.pushSubscribe(sub.toJSON());
  return 'on';
}

/** 이 기기 알림 끄기 (로그아웃할 때도 호출). 서버와 브라우저 양쪽에서 구독을 지운다 */
export async function disablePush() {
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** 이미 켠 기기는 로그인할 때 서버에 다시 알려서, 지금 로그인한 계정으로 알림이 가게 한다 */
export async function resyncPush() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const sub = await (await getRegistration())?.pushManager.getSubscription();
  if (sub) await api.pushSubscribe(sub.toJSON()).catch(() => undefined);
}

/** 앱을 열면 홈 화면 아이콘 배지와 알림 센터에 남은 우리가족 알림을 지운다 */
export async function clearBadgeAndNotifications() {
  await navigator.clearAppBadge?.().catch(() => undefined);
  const reg = await getRegistration();
  const list = (await reg?.getNotifications()) ?? [];
  list.forEach((n) => n.close());
}

export function usePushStatus() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const refresh = useCallback(() => {
    getPushStatus()
      .then(setStatus)
      .catch(() => setStatus('unsupported'));
  }, []);
  useEffect(refresh, [refresh]);
  return { status, setStatus, refresh };
}
