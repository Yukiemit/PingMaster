import { db } from './data/store.js';

// Reads "Authorization: Bearer <token>" and attaches req.user when valid.
export function auth(required = true) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const userId = token && db.tokens.get(token);
    req.user = userId ? db.users.find((u) => u.id === userId) : null;
    if (required && !req.user) return res.status(401).json({ error: 'Please log in or continue as guest.' });
    next();
  };
}
