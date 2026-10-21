import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 개발 중에는 /api 를 로컬 백엔드로 넘긴다 (배포 환경에서는 Netlify 가 Render 로 프록시)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
