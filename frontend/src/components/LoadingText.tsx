import { useEffect, useState } from 'react';

const DOT_MS = 400;

/**
 * "로그인 중." → "로그인 중.." → "로그인 중..." → "로그인 중." 처럼 점이 계속 바뀌어
 * 멈춘 게 아니라 진행 중임을 보여준다. 점 자리는 폭을 고정해 글자가 흔들리지 않게 한다
 */
export default function LoadingText({ text }: { text: string }) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => setDots((d) => (d % 3) + 1), DOT_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="loading-text">
      {text}
      <span className="loading-dots" aria-hidden="true">
        {'.'.repeat(dots)}
      </span>
    </span>
  );
}

const SLOW_MS = 5000;

/** 요청이 5초 넘게 걸리는지 (Render 무료 플랜이 잠에서 깨는 중으로 본다) */
export function useSlow(active: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [active]);
  return slow;
}
