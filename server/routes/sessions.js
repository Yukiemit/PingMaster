import { Router } from 'express';
import { db, uid, createSession } from '../data/store.js';
import { restaurants } from '../data/restaurants.js';
import { auth } from '../middleware.js';

const router = Router();
router.use(auth());

const findRestaurant = (id) => restaurants.find((r) => r.id === id) || null;

function me(session, user) {
  return session.participants.find((p) => p.userId === user.id);
}

function view(session, user) {
  const self = me(session, user);
  const organizer = session.participants.find((p) => p.role === 'organizer');
  return {
    id: session.id,
    code: session.code,
    pin: session.pin,
    name: session.name,
    status: session.status,
    createdAt: session.createdAt,
    organizerName: organizer?.name,
    participants: session.participants.map(({ id, name, role, userId }) => ({ id, name, role, joined: !!userId })),
    me: self ? { id: self.id, name: self.name, role: self.role } : null,
    myPreferences: self ? session.preferences[self.id] || null : null,
    myVotes: self ? session.votes[self.id] || {} : {},
    preferencesIn: Object.keys(session.preferences).length,
    votesIn: Object.keys(session.votes).length,
    picked: findRestaurant(session.pickedRestaurantId),
    schedule: session.schedule,
  };
}

function load(req, res) {
  const session = db.sessions.find((s) => s.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return null;
  }
  if (!me(session, req.user)) {
    res.status(403).json({ error: 'Join this session first.' });
    return null;
  }
  return session;
}

// ---- Matching -------------------------------------------------------------
export function rankRestaurants(session) {
  const prefs = Object.values(session.preferences);
  const n = Math.max(prefs.length, 1);

  const mins = prefs.map((p) => Number(p.budgetMin)).filter((v) => v > 0);
  const maxs = prefs.map((p) => Number(p.budgetMax)).filter((v) => v > 0);
  const budgetMin = mins.length ? Math.max(...mins) : 0;
  const budgetMax = maxs.length ? Math.min(...maxs) : Infinity;
  // If budgets don't overlap, fall back to the averages so we still get results.
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const [lo, hi] = budgetMin <= budgetMax ? [budgetMin, budgetMax] : [avg(mins), avg(maxs)];

  const walks = prefs.map((p) => Number(p.maxWalk)).filter((v) => v > 0);
  const maxWalk = walks.length ? Math.min(...walks) : 15;

  const diet = new Set(prefs.flatMap((p) => p.diet || []).filter((d) => d !== 'none'));
  const cravingCount = {};
  let anyCount = 0;
  for (const p of prefs) {
    const c = p.cravings || [];
    if (!c.length || c.includes('ANY')) anyCount += 1;
    else c.forEach((x) => (cravingCount[x] = (cravingCount[x] || 0) + 1));
  }

  return restaurants
    .filter((r) => [...diet].every((d) => r.diet.includes(d)))
    .map((r) => {
      const cuisineScore = ((cravingCount[r.cuisine] || 0) + anyCount) / n;
      const overlap = Math.max(0, Math.min(r.priceMax, hi) - Math.max(r.priceMin, lo));
      const budgetScore = hi === Infinity && lo === 0 ? 1 : overlap / Math.max(1, r.priceMax - r.priceMin);
      const walkScore = r.walkMins <= maxWalk ? 1 - (r.walkMins / maxWalk) * 0.5 : Math.max(0, 0.3 - (r.walkMins - maxWalk) * 0.05);
      const score = Math.round(45 * cuisineScore + 30 * budgetScore + 25 * walkScore);
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score || a.walkMins - b.walkMins)
    .slice(0, 6);
}

function tally(session) {
  const ranked = rankRestaurants(session);
  const points = {};
  for (const votes of Object.values(session.votes)) {
    for (const [rid, v] of Object.entries(votes)) points[rid] = (points[rid] || 0) + (v === 'yes' ? 2 : v === 'maybe' ? 1 : 0);
  }
  const board = ranked
    .map((r) => ({ ...r, points: points[r.id] || 0 }))
    .sort((a, b) => b.points - a.points || b.score - a.score);
  return board;
}

// ---- Routes ---------------------------------------------------------------
router.get('/', (req, res) => {
  const mine = db.sessions
    .filter((s) => me(s, req.user))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => view(s, req.user));
  res.json({ sessions: mine });
});

router.post('/', (req, res) => {
  const { name, groupId } = req.body || {};
  let members = [];
  if (groupId) {
    const group = db.groups.find((g) => g.id === groupId && g.ownerId === req.user.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    // Don't duplicate the organizer if they're listed in their own group.
    members = group.members.filter((m) => m.name.toLowerCase() !== req.user.name.toLowerCase());
  }
  const session = createSession({ name: name || (groupId ? `${db.groups.find((g) => g.id === groupId).name} Session` : ''), organizer: req.user, members });
  res.status(201).json({ session: view(session, req.user) });
});

router.post('/join', (req, res) => {
  const { code, pin, name } = req.body || {};
  const clean = String(code || '').trim().toLowerCase().split('/').pop();
  const session = db.sessions.find((s) => s.status !== 'done' && ((clean && s.code === clean) || (pin && s.pin === String(pin))));
  if (!session) return res.status(404).json({ error: "We couldn't find that session. Check the link or PIN." });

  let self = me(session, req.user);
  if (!self) {
    const displayName = (name || req.user.name || 'Guest').trim();
    // Claim a matching invited-only slot (e.g. "Tian" from the group) instead of adding a duplicate.
    self = session.participants.find((p) => p.invitedOnly && !p.userId && p.name.toLowerCase() === displayName.toLowerCase());
    if (self) Object.assign(self, { userId: req.user.id, invitedOnly: false });
    else {
      self = { id: uid('p_'), name: displayName, role: 'member', userId: req.user.id };
      session.participants.push(self);
    }
  }
  res.json({ session: view(session, req.user) });
});

router.get('/:id', (req, res) => {
  const session = load(req, res);
  if (session) res.json({ session: view(session, req.user) });
});

router.patch('/:id', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const self = me(session, req.user);
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    if (self.role !== 'organizer') return res.status(403).json({ error: 'Only the organizer can rename the session.' });
    session.name = req.body.name.trim();
  }
  res.json({ session: view(session, req.user) });
});

// A joiner sets the name the group sees.
router.patch('/:id/me', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const name = (req.body?.name || '').trim();
  if (name) me(session, req.user).name = name.slice(0, 30);
  res.json({ session: view(session, req.user) });
});

router.put('/:id/preferences', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const { budgetMin, budgetMax, maxWalk, cravings = [], diet = [] } = req.body || {};
  if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) {
    return res.status(400).json({ error: 'Minimum budget should be lower than the maximum.' });
  }
  session.preferences[me(session, req.user).id] = {
    budgetMin: Number(budgetMin) || 0,
    budgetMax: Number(budgetMax) || 0,
    maxWalk: Number(maxWalk) || 0,
    cravings: Array.isArray(cravings) ? cravings : [],
    diet: Array.isArray(diet) ? diet : [],
  };
  if (session.status === 'open') session.status = 'voting';
  res.json({ session: view(session, req.user) });
});

router.get('/:id/matches', (req, res) => {
  const session = load(req, res);
  if (session) res.json({ matches: rankRestaurants(session) });
});

router.put('/:id/votes', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const votes = {};
  for (const [rid, v] of Object.entries(req.body?.votes || {})) if (v === 'yes' || v === 'maybe') votes[rid] = v;
  session.votes[me(session, req.user).id] = votes;
  res.json({ session: view(session, req.user) });
});

router.get('/:id/results', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const board = tally(session);
  if (!session.pickedRestaurantId || session.status !== 'done') session.pickedRestaurantId = board[0]?.id || null;
  res.json({ winner: findRestaurant(session.pickedRestaurantId), board, session: view(session, req.user) });
});

router.put('/:id/schedule', (req, res) => {
  const session = load(req, res);
  if (!session) return;
  const { date, time } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Pick a date.' });
  session.schedule = { date, time: /^\d{2}:\d{2}$/.test(time || '') ? time : '12:00' };
  session.status = 'done';
  if (!session.pickedRestaurantId) session.pickedRestaurantId = tally(session)[0]?.id || null;
  res.json({ session: view(session, req.user) });
});

export default router;
