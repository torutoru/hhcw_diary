import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { todayKey } from '../lib/format';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-10" ± n개월 */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 달력 칸: 앞쪽 빈칸(null) + 그 달의 날짜(YYYY-MM-DD) */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  return cells;
}

/** 그 달에 피드가 있는 날짜 → 피드 id */
export function useMonthFeeds(month: string) {
  const [feeds, setFeeds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .feedDates(month)
      .then((res) => alive && setFeeds(new Map(res.feeds.map((f) => [f.date, f.id]))))
      .catch((err) => alive && setError((err as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  return { feeds, loading, error };
}

export interface DayInfo {
  date: string;
  /** 그날 피드 id (없으면 null) */
  feedId: string | null;
  isFuture: boolean;
  isToday: boolean;
}

interface Props {
  month: string;
  onMonthChange: (month: string) => void;
  feeds: Map<string, string>;
  loading: boolean;
  /** 누를 수 있는 날인지 (작성하기: 오늘까지 모두 / 검색하기: 피드가 있는 날만) */
  isEnabled: (day: DayInfo) => boolean;
  /** 화면 읽기 기능용 날짜 설명 */
  describe: (day: DayInfo) => string;
  onPick: (day: DayInfo) => void;
  legend: ReactNode;
}

/** 피드 작성하기·검색하기가 함께 쓰는 달력. 피드가 있는 날은 파란 점 */
export default function MonthCalendar({ month, onMonthChange, feeds, loading, isEnabled, describe, onPick, legend }: Props) {
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const cells = useMemo(() => monthCells(month), [month]);
  const [y, m] = month.split('-').map(Number);

  return (
    <>
      <section className="calendar" aria-label={`${y}년 ${m}월 달력`} aria-busy={loading}>
        <div className="calendar-head">
          <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            <ChevronLeftIcon size={22} />
          </button>
          <h2 className="display" aria-live="polite">
            {y}년 {m}월
          </h2>
          <button
            type="button"
            className="icon-btn"
            aria-label="다음 달"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            disabled={month >= thisMonth}
          >
            <ChevronRightIcon size={22} />
          </button>
        </div>

        <div className="calendar-grid" role="grid">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={`calendar-weekday${i === 0 ? ' is-sun' : ''}`} role="columnheader">
              {w}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={`blank-${i}`} aria-hidden="true" />;
            const day: DayInfo = {
              date,
              feedId: feeds.get(date) ?? null,
              isFuture: date > today,
              isToday: date === today,
            };
            return (
              <button
                key={date}
                type="button"
                className={`calendar-day${day.isToday ? ' is-today' : ''}${day.feedId ? ' has-feed' : ''}`}
                aria-label={`${m}월 ${Number(date.slice(8))}일${day.isToday ? ' 오늘' : ''}, ${describe(day)}`}
                disabled={loading || !isEnabled(day)}
                onClick={() => onPick(day)}
              >
                <span className="calendar-num">{Number(date.slice(8))}</span>
                <span className="calendar-dot" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>
      <div className="calendar-legend">{legend}</div>
    </>
  );
}
