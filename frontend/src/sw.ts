/// <reference lib="webworker" />
// 우리가족 서비스 워커: 화면 파일 캐시 + 푸시 알림 + 홈 화면 아이콘 배지.
// vite-plugin-pwa(injectManifest)가 빌드할 때 self.__WB_MANIFEST 자리에 미리 저장할 파일 목록을 넣는다.
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// ---------- 화면 파일 캐시 (이전 generateSW 설정과 같음) ----------

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 주소창에 직접 들어온 화면은 저장된 index.html 로. /api 는 절대 가로채지 않는다 (승인 메일 링크 등)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);
// API 응답과 사진(R2 서명 URL)은 캐시하지 않는다

// "새 버전이 있어요 → 새로고침"을 누르면 화면에서 이 메시지를 보낸다
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- 푸시 알림 ----------

/** 백엔드 backend/src/lib/push.ts 의 PushPayload 와 같은 모양 */
interface PushPayload {
  kind: 'feed' | 'comment';
  title: string;
  body: string;
  url: string;
  tag: string;
  feedLabel?: string;
}

interface NotificationData {
  url: string;
  count: number;
}

const ICON = '/icons/icon-192.png';
// 안드로이드 상단 상태바에 보이는 작은 단색 아이콘 (N)
const STATUS_BAR_BADGE = '/icons/notification-badge.png';

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    return;
  }
  event.waitUntil(showPush(payload));
});

async function showPush(p: PushPayload) {
  // 같은 피드의 댓글 알림은 하나로 묶어 "새 댓글 N개"로 덮어쓴다
  let count = 1;
  if (p.kind === 'comment') {
    const existing = await self.registration.getNotifications({ tag: p.tag });
    const prev = existing[0]?.data as NotificationData | undefined;
    if (prev) count = prev.count + 1;
  }
  const body = count > 1 && p.feedLabel ? `${p.feedLabel}에 새 댓글 ${count}개` : p.body;

  await self.registration.showNotification(p.title, {
    body,
    tag: p.tag,
    icon: ICON,
    badge: STATUS_BAR_BADGE,
    data: { url: p.url, count } satisfies NotificationData,
    // 묶인 알림이 갱신될 때도 다시 알려준다 (소리·진동은 기기 설정을 따름)
    renotify: count > 1,
  } as NotificationOptions);

  // 홈 화면 아이콘 배지: 숫자 대신 "새 소식 있음" 한 가지 상태(1). 앱을 열면 지운다.
  // 아이폰·PC 는 이 값이 보이고, 안드로이드는 런처가 알림을 보고 점·숫자를 붙인다
  await self.navigator.setAppBadge?.(1).catch(() => undefined);
}

// 알림을 누르면 해당 피드 상세로. 이미 열린 앱 창이 있으면 그 창을 앞으로 가져와 이동한다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as NotificationData | undefined)?.url ?? '/';
  event.waitUntil(openApp(url));
});

/** 앱 화면(frontend/src/components/AppStatus.tsx)이 받는 메시지: 새로고침 없이 앱 안에서 이 주소로 이동 */
interface OpenUrlMessage {
  type: 'OPEN_URL';
  url: string;
}

async function openApp(url: string) {
  const target = new URL(url, self.location.origin);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const client = windows.find((c) => new URL(c.url).origin === self.location.origin);
  if (client) {
    // 이미 켜진 앱: 앞으로 가져온 뒤 앱 안에서 이동하라고 알린다.
    // (client.navigate 는 아이폰 홈 화면 앱에서 동작하지 않는 경우가 있고, 화면 전체를 새로 불러온다)
    await client.focus().catch(() => undefined);
    client.postMessage({ type: 'OPEN_URL', url: target.pathname + target.search + target.hash } satisfies OpenUrlMessage);
    return;
  }
  // 꺼져 있으면 그 주소로 앱을 연다
  await self.clients.openWindow(target.href);
}
