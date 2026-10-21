const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Params {
  email: string;
  name: string;
  requestedAt: string;
  expiresAt: string;
  confirmUrl: string;
}

/** 디자인의 "관리자 승인 메일" 화면. 메일 클라이언트 호환을 위해 table + inline style로 작성 */
export function approvalEmail(p: Params) {
  const font = "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:6px 0;width:110px;color:#4F574F;font-size:15px">${label}</td>
      <td style="padding:6px 0;font-size:15px;${bold ? 'font-weight:700;' : ''}">${value}</td>
    </tr>`;

  return `<!doctype html>
<html lang="ko"><body style="margin:0;background:#ECE9E1;font-family:${font};color:#1D2620">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE9E1;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:536px;background:#FFFFFF;border-radius:20px">
<tr><td style="padding:36px 40px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;border-radius:11px;background:#2F6B4F;text-align:center;color:#FFFFFF;font-size:18px">&#8962;</td>
    <td style="padding-left:10px;font-size:20px">우리가족</td>
  </tr></table>
  <h1 style="margin:24px 0;font-size:28px;font-weight:400">새 가족이 가입을 요청했어요</h1>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EC;border-radius:14px;padding:12px 20px">
    ${row('요청 이메일', escape(p.email), true)}
    ${row('호칭', escape(p.name))}
    ${row('요청 시각', escape(p.requestedAt))}
    ${row('링크 만료', `${escape(p.expiresAt)} (1시간 후)`)}
  </table>
  <a href="${escape(p.confirmUrl)}" style="display:block;margin:24px 0;height:56px;line-height:56px;border-radius:14px;background:#2F6B4F;color:#FFFFFF;font-size:17px;font-weight:700;text-align:center;text-decoration:none">가입 승인하기</a>
  <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4F574F">버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.</p>
  <p style="margin:0 0 8px;padding:10px 12px;border-radius:10px;background:#F4F2EC;font-family:Consolas,Menlo,monospace;font-size:12px;word-break:break-all">${escape(p.confirmUrl)}</p>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#4F574F">이 링크는 발급 후 1시간 동안, 한 번만 쓸 수 있어요. 모르는 요청이면 이 메일을 무시하세요.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
