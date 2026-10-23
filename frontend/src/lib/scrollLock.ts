// 상세 모달 등이 떠 있는 동안 뒤 페이지 스크롤을 막는다.
// body { overflow: hidden } 은 아이폰 사파리에서 자주 무시되어, 모달을 끌면 뒤 목록까지 움직였다(사용자 제보).
// 그래서 body 를 지금 위치 그대로 position: fixed 로 고정했다가, 풀 때 보던 위치로 되돌린다.
// 모달 위에 다른 겹치는 화면이 떠도 안전하도록 잠금 횟수를 센다.

let locks = 0;
let savedY = 0;

export function lockScroll() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const s = document.body.style;
  s.position = 'fixed';
  s.top = `-${savedY}px`;
  s.left = '0';
  s.right = '0';
  s.width = '100%';
  s.overflow = 'hidden';
}

export function unlockScroll() {
  if (locks === 0 || --locks > 0) return;
  const s = document.body.style;
  s.position = '';
  s.top = '';
  s.left = '';
  s.right = '';
  s.width = '';
  s.overflow = '';
  window.scrollTo(0, savedY);
}
