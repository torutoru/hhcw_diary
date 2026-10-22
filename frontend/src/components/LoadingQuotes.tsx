import { useEffect, useState } from 'react';
import { FAMILY_QUOTES } from '../lib/familyQuotes';

const SHOW_AFTER_MS = 400; // 빠른 로딩에서는 문구가 깜빡이지 않게 잠깐 기다린 뒤 보여준다
const QUOTE_MS = 6000; // 문구 하나를 보여주는 시간
const FADE_MS = 700; // CSS .loading-quote 전환 시간과 같게
const WAKE_AFTER_MS = 5000; // 이보다 오래 걸리면 Render 무료 플랜이 잠에서 깨는 중으로 본다

const CONTINUE_WITHIN_MS = 1500; // 이 안에 다시 로딩 화면이 뜨면 이어지는 로딩으로 본다

// 앱을 열면 로그인 확인 → 피드 불러오기가 이어서 일어난다. 두 화면 사이에 문구가 끊기거나 바뀌지 않도록
// 지금 문구·시작 시각·마지막으로 보인 시각을 모듈에 기억해 둔다
const current = { index: Math.floor(Math.random() * FAMILY_QUOTES.length), startedAt: 0, lastSeenAt: 0 };

/**
 * 첫 로딩·서버 깨우는 중 화면: 가족 문구를 은은하게 바꿔 가며 보여준다.
 * 앱을 열 때 로그인 확인(AuthProvider)과 메인 피드 첫 불러오기에서 쓴다.
 */
export default function LoadingQuotes() {
  const [continuing] = useState(() => Date.now() - current.lastSeenAt < CONTINUE_WITHIN_MS);
  const [visible, setVisible] = useState(continuing);
  const [index, setIndex] = useState(() =>
    continuing ? current.index : Math.floor(Math.random() * FAMILY_QUOTES.length),
  );
  const [shown, setShown] = useState(true);
  const [waking, setWaking] = useState(() => continuing && Date.now() - current.startedAt > WAKE_AFTER_MS);

  useEffect(() => {
    if (!continuing) current.startedAt = Date.now();
    const elapsed = Date.now() - current.startedAt;
    const showTimer = window.setTimeout(() => setVisible(true), Math.max(0, SHOW_AFTER_MS - elapsed));
    const wakeTimer = window.setTimeout(() => setWaking(true), Math.max(0, WAKE_AFTER_MS - elapsed));
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(wakeTimer);
      // 사라지는 순간을 기억: 바로 다음 로딩 화면이 이어받는다
      current.lastSeenAt = Date.now();
    };
  }, [continuing]);

  useEffect(() => {
    current.index = index;
  }, [index]);

  // 문구 바꾸기: 사라지기 → 다음 문구로 바꾸고 → 나타나기
  useEffect(() => {
    if (!visible) return;
    let swap: number | undefined;
    const cycle = window.setInterval(() => {
      setShown(false);
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % FAMILY_QUOTES.length);
        setShown(true);
      }, FADE_MS);
    }, QUOTE_MS);
    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(swap);
    };
  }, [visible]);

  if (!visible) return <div className="loading-screen" aria-busy="true" />;

  return (
    <div className="loading-screen" aria-busy="true">
      <figure className={`loading-quote${shown ? ' is-shown' : ''}`}>
        <span className="loading-quote-mark" aria-hidden="true">
          “
        </span>
        <blockquote className="display">{FAMILY_QUOTES[index]}</blockquote>
      </figure>
      <div className="loading-status" role="status">
        <span className="spinner" aria-hidden="true" />
        {waking ? '서버를 깨우고 있어요. 첫 접속은 30초쯤 걸릴 수 있어요.' : '불러오는 중'}
      </div>
    </div>
  );
}
