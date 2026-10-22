import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const apiProxy = { '/api': 'http://localhost:4000' };

// 개발 중에는 /api 를 로컬 백엔드로 넘긴다 (배포 환경에서는 Netlify 가 Render 로 프록시)
export default defineConfig({
  plugins: [
    react(),
    // PWA: 홈 화면에 설치해서 앱처럼 쓰기 (안드로이드·아이폰). 자세한 내용은 docs/pwa.md
    VitePWA({
      // 새 버전이 나오면 바로 바꾸지 않고 "새 버전이 있어요" 안내 후 사용자가 누르면 갱신
      // (작성 중인 피드가 갑자기 새로고침되지 않게)
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: '우리가족',
        short_name: '우리가족',
        description: '하루 한 장, 우리 집 이야기',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F2EC',
        theme_color: '#F4F2EC',
        // 원본: docs/design/pwa-icons/ (사용자 제작)
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 화면 파일(JS·CSS·HTML·아이콘)만 미리 저장해서 두 번째 실행부터 빨리 뜨게 한다
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 주소창에 직접 들어온 화면은 저장된 index.html 로. API 는 절대 서비스 워커가 가로채지 않는다
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // 글꼴은 거의 바뀌지 않으니 오래 저장
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // API 응답과 사진(R2 서명 URL)은 캐시하지 않는다: 오래된 피드·만료된 사진 주소를 보여주지 않게
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  // `npm run preview` 로 빌드 결과(서비스 워커 포함)를 확인할 때도 같은 프록시
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
