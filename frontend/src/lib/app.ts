/**
 * 서비스 이름. Netlify 환경변수 VITE_APP_NAME 으로 바꾼다 (빌드할 때 들어감, 바꾸면 다시 배포 필요).
 * 예: "철구네 우리가족". 없으면 "우리가족"
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || '우리가족';

/** 마지막 글자에 받침이 있는지 (한글이 아니면 받침 없음으로 본다) */
function hasBatchim(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 이름 + 을/를 : "철구네 우리가족을", "우리 둥지를" */
export const withObject = (word: string) => `${word}${hasBatchim(word) ? '을' : '를'}`;
