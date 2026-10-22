import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import MonthCalendar, { useMonthFeeds } from '../components/MonthCalendar';
import { todayKey } from '../lib/format';

/** /compose — 피드 작성하기: 날짜를 고르면 그날 피드를 작성(빈 날) 또는 수정(파란 점) */
export default function CalendarPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const { feeds, loading, error } = useMonthFeeds(month);

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

        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          feeds={feeds}
          loading={loading}
          isEnabled={(d) => !d.isFuture}
          describe={(d) =>
            d.isFuture ? '아직 오지 않은 날' : d.feedId ? '피드 있음, 눌러서 수정' : '피드 없음, 눌러서 작성'
          }
          onPick={(d) => navigate(`/compose/${d.date}`)}
          legend={
            <>
              <span>
                <span className="calendar-dot is-sample" aria-hidden="true" /> 작성한 날 — 누르면 수정
              </span>
              <span>
                <span className="calendar-empty-sample" aria-hidden="true" /> 빈 날 — 누르면 작성
              </span>
            </>
          }
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
