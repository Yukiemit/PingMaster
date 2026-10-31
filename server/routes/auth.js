import { Router } from 'express';
import { db, uid, hashPassword, verifyPassword, issueToken, publicUser } from '../data/store.js';
import { auth } from '../middleware.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', (req, res) => {
  const { email = '', password = '', name } = req.body || {};
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.users.some((u) => u.email === cleanEmail)) return res.status(409).json({ error: 'That email already has an account. Try logging in.' });

  const user = {
    id: uid('u_'),
    name: (name || cleanEmail.split('@')[0]).trim(),
    email: cleanEmail,
    passwordHash: hashPassword(password),
  };
  db.users.push(user);
  res.status(201).json({ token: issueToken(user.id), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = db.users.find((u) => u.email === email.trim().toLowerCase() && !u.isGuest);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

router.post('/guest', (req, res) => {
  const name = (req.body?.name || 'Guest').trim().slice(0, 30) || 'Guest';
  const user = { id: uid('u_'), name, email: null, isGuest: true };
  db.users.push(user);
  res.status(201).json({ token: issueToken(user.id), user: publicUser(user) });
});

// Forgot password is a stub: in production, email a reset link here.
router.post('/forgot', (req, res) => {
  res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
});

router.get('/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', auth(false), (req, res) => {
  const token = (req.get('authorization') || '').slice(7);
  db.tokens.delete(token);
  res.json({ ok: true });
});

export default router;
