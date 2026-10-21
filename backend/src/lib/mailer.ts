import { config } from '../config.js';

interface Mail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Resend HTTP API로 메일을 보낸다.
 * Render 무료 인스턴스는 SMTP 포트가 막혀 있어 HTTP API 방식을 쓴다.
 * RESEND_API_KEY 가 없으면 개발용으로 로그에만 남긴다.
 */
export async function sendMail(mail: Mail, log: (msg: string) => void) {
  if (!config.RESEND_API_KEY) {
    log(`[mail:dev] to=${mail.to} subject=${mail.subject}\n${mail.html}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.MAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html }),
  });
  if (!res.ok) {
    throw new Error(`메일 전송 실패 (${res.status}): ${await res.text()}`);
  }
}
