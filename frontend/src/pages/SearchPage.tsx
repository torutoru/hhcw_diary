import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { BackIcon } from '../components/Icons';
import MonthCalendar, { useMonthFeeds } from '../components/MonthCalendar';
import { todayKey } from '../lib/format';
import type { FeedOutletContext } from './FeedPage';

// 검색 달력 위에 뜬 상세에서 댓글을 달거나 지워도 달력에는 바꿀 것이 없다
const noop = () => undefined;

/**
 * /search — 피드 검색하기: 피드가 있는 날(파란 점)만 누를 수 있고, 누르면 그 피드 상세가 달력 위에 뜬다.
 * 상세(/search/feeds/:id)를 닫으면 보던 달 그대로 달력으로 돌아온다 (이 화면은 계속 떠 있음)
 */
export default function SearchPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const { feeds, loading, error } = useMonthFeeds(month);

  return (
    <div className="members-page">
      <header className="sub-header">
        <Link to="/" className="icon-btn" aria-label="피드로 돌아가기">
          <BackIcon />
        </Link>
        <h1 className="display">피드 검색하기</h1>
      </header>

      <main className="calendar-page">
        <p className="page-desc">파란 점이 있는 날을 누르면 그날 피드를 볼 수 있어요.</p>

        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          feeds={feeds}
          loading={loading}
          isEnabled={(d) => !d.isFuture && d.feedId !== null}
          describe={(d) => (d.isFuture ? '아직 오지 않은 날' : d.feedId ? '피드 있음, 눌러서 보기' : '피드 없음')}
          onPick={(d) => d.feedId && navigate(`/search/feeds/${d.feedId}`)}
          legend={
            <span>
              <span className="calendar-dot is-sample" aria-hidden="true" /> 피드가 있는 날 — 누르면 보기
            </span>
          }
        />

        {!loading && !error && feeds.size === 0 && (
          <p className="hint calendar-empty-month">이 달에는 피드가 없어요. 화살표로 다른 달을 볼 수 있어요.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </main>

      <Outlet
        context={
          {
            onCommentAdded: noop,
            onCommentDeleted: noop,
            onCommentEdited: noop,
            closeTo: '/search',
          } satisfies FeedOutletContext
        }
      />
    </div>
  );
}
