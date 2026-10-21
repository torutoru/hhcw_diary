import { Link } from 'react-router-dom';
import type { FeedListItem } from '../api/types';
import { formatFeedDate } from '../lib/format';
import { PhotoIcon } from './Icons';

export default function FeedCard({ item }: { item: FeedListItem }) {
  const more = item.commentCount - item.comments.length;
  return (
    <Link to={`/feeds/${item.id}`} className="feed-card">
      <div className="feed-card-head">
        <div className="feed-card-date display">
          {formatFeedDate(item.date)}
          {item.isToday && <span className="badge-today">오늘</span>}
        </div>
        <span className="photo-count">
          <PhotoIcon />
          {item.photoCount}장
        </span>
      </div>

      {item.coverUrl ? (
        <img className="feed-cover" src={item.coverUrl} alt={`${formatFeedDate(item.date)} 대표 사진`} loading="lazy" />
      ) : (
        <div className="feed-cover" />
      )}

      <div className="feed-card-comments">
        {item.comments.map((c, i) => (
          <div key={i} className="comment-line">
            <b>{c.author}</b>
            {c.body}
          </div>
        ))}
        {more > 0 && <span className="muted">댓글 {more}개 더보기</span>}
        {item.commentCount === 0 && <span className="muted">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</span>}
      </div>
    </Link>
  );
}
