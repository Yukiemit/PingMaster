import { Router } from 'express';
import {
  hashPassword, verifyPassword, issueToken, revokeToken, publicUser, findUserByEmail, createUser,
  setEmailVerified, setPassword, newEmailCode, checkEmailCode,
} from '../data/store.js';
import { sendMail, verifyEmail, resetEmail, mailEnabled } from '../data/mail.js';
import { auth, h } from '../middleware.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_TAKEN = 'That email already has an account. Try logging in.';
const CODE_ERRORS = {
  wrong: 'That code is not right. Check the email and try again.',
  expired: 'That code has expired. Tap “Send a new code”.',
  missing: 'There is no active code. Tap “Send a new code”.',
  locked: 'Too many wrong tries. Tap “Send a new code” to get a fresh one.',
};

async function sendVerifyCode(user) {
  const code = await newEmailCode(user.id, 'verify');
  if (!code) return { tooSoon: true };
  await sendMail({ to: user.email, ...verifyEmail(code) });
  return { sent: true };
}

router.post('/signup', h(async (req, res) => {
  const { email = '', password = '', name } = req.body || {};
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (await findUserByEmail(cleanEmail)) return res.status(409).json({ error: EMAIL_TAKEN });

  let user;
  try {
    user = await createUser({
      name: (name || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      passwordHash: hashPassword(password),
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: EMAIL_TAKEN }); // signed up twice at once
    throw err;
  }
  const token = await issueToken(user.id);
  // The account exists either way; if the email fails, they can resend from the verify screen.
  await sendVerifyCode(user).catch((err) => console.error('Could not send verification email:', err.message));
  res.status(201).json({ token, user: publicUser(user) });
}));

router.post('/login', h(async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = await findUserByEmail(email.trim().toLowerCase(), { includeGuests: false });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  res.json({ token: await issueToken(user.id), user: publicUser(user) });
}));

router.post('/guest', h(async (req, res) => {
  const name = (req.body?.name || 'Guest').trim().slice(0, 30) || 'Guest';
  const user = await createUser({ name, isGuest: true });
  res.status(201).json({ token: await issueToken(user.id), user: publicUser(user) });
}));

// ---- Email verification ---------------------------------------------------------
router.post('/verify', auth(), h(async (req, res) => {
  if (req.user.isGuest) return res.status(400).json({ error: 'Guest accounts have no email to verify.' });
  if (req.user.emailVerified) return res.json({ user: publicUser(req.user) });
  const result = await checkEmailCode(req.user.id, 'verify', req.body?.code);
  if (result !== 'ok') return res.status(400).json({ error: CODE_ERRORS[result], reason: result });
  await setEmailVerified(req.user.id);
  res.json({ user: publicUser({ ...req.user, emailVerified: true }) });
}));

router.post('/resend', auth(), h(async (req, res) => {
  if (req.user.isGuest || req.user.emailVerified) return res.json({ ok: true });
  const r = await sendVerifyCode(req.user);
  if (r.tooSoon) return res.status(429).json({ error: 'A code was just sent. Wait a minute before asking for another.' });
  res.json({ ok: true, emailed: mailEnabled() });
}));

// ---- Forgot / reset password ------------------------------------------------------
// Always answers the same way, so nobody can use it to check which emails have accounts.
router.post('/forgot', h(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const user = await findUserByEmail(email, { includeGuests: false });
  if (user) {
    const code = await newEmailCode(user.id, 'reset');
    if (code) await sendMail({ to: user.email, ...resetEmail(code) }).catch((err) => console.error('Could not send reset email:', err.message));
  }
  res.json({ ok: true, message: 'If that email has an account, we sent a 6-digit code to it.' });
}));

router.post('/reset', h(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const { code, password = '' } = req.body || {};
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const user = await findUserByEmail(email, { includeGuests: false });
  if (!user) return res.status(400).json({ error: CODE_ERRORS.wrong, reason: 'wrong' });
  const result = await checkEmailCode(user.id, 'reset', code);
  if (result !== 'ok') return res.status(400).json({ error: CODE_ERRORS[result], reason: result });
  await setPassword(user.id, hashPassword(password));
  await setEmailVerified(user.id); // they proved they own the inbox
  res.json({ token: await issueToken(user.id), user: publicUser({ ...user, emailVerified: true }) });
}));

router.get('/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', auth(false), h(async (req, res) => {
  const token = (req.get('authorization') || '').slice(7);
  if (token) await revokeToken(token);
  res.json({ ok: true });
}));

export default router;
