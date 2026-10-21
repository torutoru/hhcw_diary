import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { BackIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';
import { todayKey } from '../lib/format';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-10" ± n개월 */
function shiftMonth(month: string, n: number) {
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

/** /compose — 피드 작성하기: 날짜를 고르면 그날 피드를 작성(빈 날) 또는 수정(파란 점) */
export default function CalendarPage() {
  const navigate = useNavigate();
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [posted, setPosted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .feedDates(month)
      .then((res) => alive && setPosted(new Set(res.dates)))
      .catch((err) => alive && setError((err as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const cells = useMemo(() => monthCells(month), [month]);
  const [y, m] = month.split('-').map(Number);

  return (
    <div className="members-page">
      <header className="sub-header">
        <Link to="/" className="icon-btn" aria-label="피드로 돌아가기">
          <BackIcon />
        </Link>
        <h1 className="display">피드 작성하기</h1>
      </header>

      <main className="calendar-page">
        <p className="page-desc">날짜를 골라 주세요. 하루에 피드는 하나예요.</p>

        <section className="calendar" aria-label={`${y}년 ${m}월 달력`}>
          <div className="calendar-head">
            <button
              type="button"
              className="icon-btn"
              aria-label="이전 달"
              onClick={() => setMonth((v) => shiftMonth(v, -1))}
            >
              <ChevronLeftIcon size={22} />
            </button>
            <h2 className="display" aria-live="polite">
              {y}년 {m}월
            </h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="다음 달"
              onClick={() => setMonth((v) => shiftMonth(v, 1))}
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
              const day = Number(date.slice(8));
              const has = posted.has(date);
              const future = date > today;
              const label = `${m}월 ${day}일${date === today ? ' 오늘' : ''}, ${
                future ? '아직 오지 않은 날' : has ? '피드 있음, 눌러서 수정' : '피드 없음, 눌러서 작성'
              }`;
              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-day${date === today ? ' is-today' : ''}${has ? ' has-feed' : ''}`}
                  aria-label={label}
                  disabled={future || loading}
                  onClick={() => navigate(`/compose/${date}`)}
                >
                  <span className="calendar-num">{day}</span>
                  <span className="calendar-dot" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="calendar-legend">
          <span>
            <span className="calendar-dot is-sample" aria-hidden="true" /> 작성한 날 — 누르면 수정
          </span>
          <span>
            <span className="calendar-empty-sample" aria-hidden="true" /> 빈 날 — 누르면 작성
          </span>
        </div>
      </main>
    </div>
  );
}
