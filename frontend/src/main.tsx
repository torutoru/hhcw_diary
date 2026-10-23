import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { applySavedFontSize } from './lib/fontSize';
import { listenForInstallPrompt } from './lib/pwa';
import './styles/global.css';

listenForInstallPrompt();
// 서버 응답을 기다리지 않고 이 기기에 기억된 글자 크기로 첫 화면을 그린다
applySavedFontSize();

// 아이폰 사파리는 viewport 의 확대 금지를 무시해서, 두 손가락 확대 제스처를 직접 막는다.
// (사진 크게 보기의 확대는 라이브러리가 터치 이벤트로 처리하므로 영향 없음)
document.addEventListener('gesturestart', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
