const TZ = 'Asia/Seoul';

/** "2026-10-21" → Date (KST 자정) */
function fromDateKey(date: string) {
  return new Date(`${date}T00:00:00+09:00`);
}

const monthDayWeekday = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, month: 'long', day: 'numeric', weekday: 'long' });
const fullDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});
const timeOnly = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const monthDay = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, month: 'long', day: 'numeric' });
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 10월 21일 수요일 */
export const formatFeedDate = (date: string) => monthDayWeekday.format(fromDateKey(date));

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export const todayKey = () => dateKey.format(new Date());

/** 올해면 "10월 21일 수요일", 다른 해면 "2025년 10월 21일 화요일" */
export function formatComposeDate(date: string) {
  return date.slice(0, 4) === todayKey().slice(0, 4) ? formatFeedDate(date) : formatFullDate(date);
}

/** 2026년 10월 21일 수요일 */
export const formatFullDate = (date: string) => fullDate.format(fromDateKey(date));

/** 오전 8:40 */
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));

/** 같은 날이면 시간만, 아니면 "10월 21일 오후 9:12" */
export function formatDateTime(iso: string, baseDate?: string) {
  const d = new Date(iso);
  if (baseDate && dateKey.format(d) === baseDate) return timeOnly.format(d);
  return `${monthDay.format(d)} ${timeOnly.format(d)}`;
}

/** 작성 오전 8:40 · 수정됨 10월 21일 오후 9:12 */
export function formatWrittenLine(date: string, createdAt: string, updatedAt: string) {
  const written = `작성 ${formatDateTime(createdAt, date)}`;
  // 저장 직후 몇 초 차이는 수정으로 보지 않는다
  if (new Date(updatedAt).getTime() - new Date(createdAt).getTime() < 60_000) return written;
  return `${written} · 수정됨 ${formatDateTime(updatedAt)}`;
}
