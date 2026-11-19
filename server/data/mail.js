// Sends email through SMTP (a Gmail account with an App Password works out of the box).
// Without SMTP settings the email is printed to the server terminal instead, so local testing still works.
import nodemailer from 'nodemailer';

const user = () => (process.env.SMTP_USER || '').trim();
const pass = () => (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // Gmail shows App Passwords with spaces
export const mailEnabled = () => !!(user() && pass());

let transport;
function getTransport() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user: user(), pass: pass() },
  });
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailEnabled()) {
    console.log(`\n[mail] SMTP is not set up, so this email was not sent.\n  To: ${to}\n  Subject: ${subject}\n  ${text.replace(/\n/g, '\n  ')}\n`);
    return { sent: false };
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM || `Saan Tayo? <${user()}>`, to, subject, text, html });
  return { sent: true };
}

const box = (title, intro, code, outro) => `
<div style="font-family:Arial,Helvetica,sans-serif;background:#fbedc8;padding:28px">
  <div style="max-width:460px;margin:0 auto;background:#fffcf4;border-radius:16px;padding:28px;color:#241a17">
    <p style="margin:0;color:#e2281f;font-weight:700;font-size:20px">Saan Tayo?</p>
    <h1 style="font-size:22px;margin:14px 0 8px">${title}</h1>
    <p style="margin:0 0 18px;line-height:1.5">${intro}</p>
    <p style="font-size:34px;letter-spacing:10px;font-weight:700;background:#1e6340;color:#fdba4d;text-align:center;border-radius:12px;padding:14px 0;margin:0 0 18px">${code}</p>
    <p style="margin:0;color:#7d6e66;font-size:13px;line-height:1.5">${outro}</p>
  </div>
</div>`;

export function verifyEmail(code) {
  return {
    subject: `${code} is your Saan Tayo? code`,
    text: `Your Saan Tayo? verification code is ${code}. It expires in 10 minutes.\nIf you didn't sign up, you can ignore this email.`,
    html: box('Confirm your email', 'Enter this code in Saan Tayo? to finish creating your account:', code,
      "It expires in 10 minutes. If you didn't sign up, you can ignore this email."),
  };
}

export function resetEmail(code) {
  return {
    subject: `${code} is your Saan Tayo? password reset code`,
    text: `Your Saan Tayo? password reset code is ${code}. It expires in 10 minutes.\nIf you didn't ask to reset your password, you can ignore this email.`,
    html: box('Reset your password', 'Enter this code in Saan Tayo? to choose a new password:', code,
      "It expires in 10 minutes. If you didn't ask for this, you can ignore this email; your password stays the same."),
  };
}
