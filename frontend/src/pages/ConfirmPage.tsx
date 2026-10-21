import { Link, useSearchParams } from 'react-router-dom';
import { AlertIcon, CheckIcon } from '../components/Icons';

// 관리자가 승인 메일의 링크를 누르면 백엔드가 처리 후 이 화면으로 보낸다
const COPY: Record<string, { title: string; desc: (email: string, name: string) => string }> = {
  success: {
    title: '가입 완료 처리되었습니다!',
    desc: (email) => `${email || '요청자'} 님의 가입을 승인했어요.\n이제 이 이메일로 우리가족에 로그인할 수 있어요.`,
  },
  expired: {
    title: '승인 링크가 만료됐어요',
    desc: () => '링크는 발급 후 1시간 동안만 유효해요.\n가입을 다시 요청해 달라고 알려주세요.',
  },
  used: {
    title: '이미 처리된 링크예요',
    desc: () => '이 승인 링크는 한 번만 쓸 수 있어요.\n가입은 이미 완료됐어요.',
  },
  taken: {
    title: '이미 등록된 호칭이에요',
    desc: (_email, name) =>
      `'${name || '엄마/아빠'}' 호칭은 이미 다른 가족이 쓰고 있어서 승인하지 않았어요.\n다른 호칭으로 다시 가입을 요청해 달라고 알려주세요.`,
  },
  invalid: {
    title: '올바르지 않은 링크예요',
    desc: () => '메일에 있는 주소를 그대로 열었는지 확인해 주세요.',
  },
};

export default function ConfirmPage() {
  const [params] = useSearchParams();
  const status = params.get('status') ?? 'invalid';
  const copy = COPY[status] ?? COPY.invalid;
  const success = status === 'success';

  return (
    <main className="result">
      <div className={`result-icon${success ? '' : ' is-fail'}`}>{success ? <CheckIcon /> : <AlertIcon />}</div>
      <h1 className="display">{copy.title}</h1>
      <p>{copy.desc(params.get('email') ?? '', params.get('name') ?? '')}</p>
      <Link to="/" className="btn btn-primary">
        우리가족 열기
      </Link>
    </main>
  );
}
