const kstDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const kstDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now = new Date()) {
  return kstDate.format(now);
}

/** 메일 표시용: 2026-10-21 20:14 */
export function formatKST(date: Date) {
  return kstDateTime.format(date);
}

const kstClock = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: 'numeric',
});

/** 안내 문구용: 오후 3시 12분 */
export function formatKSTClock(date: Date) {
  return kstClock.format(date);
}

export function nowISO() {
  return new Date().toISOString();
}
