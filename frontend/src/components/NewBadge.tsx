/** 안 본 피드·댓글에 붙는 작은 빨간 "N" */
export default function NewBadge({ label = '새 소식' }: { label?: string }) {
  return (
    <span className="new-badge" role="img" aria-label={label}>
      N
    </span>
  );
}
