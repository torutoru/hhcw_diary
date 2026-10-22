interface ImportMetaEnv {
  /** 서비스 이름 (Netlify 환경변수). 없으면 "우리가족" */
  readonly VITE_APP_NAME?: string;
  /** 홈 화면 아이콘 아래 짧은 이름. 없으면 VITE_APP_NAME */
  readonly VITE_APP_SHORT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
