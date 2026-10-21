import { avatarColor } from '../lib/avatar';

interface Props {
  nickname: string;
  relation: string;
}

/** 호칭(이름) 옆에 가족관계를 작게 붙인다: 햇살맘 엄마 */
export function PersonName({ nickname, relation }: Props) {
  return (
    <span className="person-name">
      <b>{nickname}</b>
      {relation && relation !== nickname && <span className="relation-tag">{relation}</span>}
    </span>
  );
}

/** 동그란 아바타. 색은 가족관계로(사람마다 고정), 글자는 호칭 첫 글자 */
export function Avatar({ nickname, relation, size }: Props & { size?: 'lg' }) {
  return (
    <div
      className={`avatar${size === 'lg' ? ' avatar-lg' : ''}`}
      style={{ background: avatarColor(relation) }}
      aria-hidden="true"
    >
      {nickname.slice(0, 1)}
    </div>
  );
}
