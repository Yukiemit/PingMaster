import { userForToken } from './data/store.js';

// Lets route handlers be async: a rejected promise goes to Express's error handler.
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Reads "Authorization: Bearer <token>" and attaches req.user when valid.
export function auth(required = true) {
  return h(async (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    req.user = token ? await userForToken(token) : null;
    if (required && !req.user) return res.status(401).json({ error: 'Please log in or continue as guest.' });
    next();
  });
}

// Accounts must confirm their email before using groups and sessions (guests are fine).
export function verified() {
  return (req, res, next) => {
    if (req.user && !req.user.isGuest && !req.user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the 6-digit code.', reason: 'EMAIL_UNVERIFIED' });
    }
    next();
  };
}
