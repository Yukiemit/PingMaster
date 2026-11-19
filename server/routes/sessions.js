import { Router } from 'express';
import {
  createSession, getSession, listSessionsForUser, findJoinableSession, getGroupForUser,
  claimParticipant, markJoined, addParticipant, renameParticipant, updateSession, savePreferences, saveVotes,
  setMeetup, savePlaces, getRoute, saveRoute, saveProposal,
} from '../data/store.js';
import { restaurants } from '../data/restaurants.js';
import { mapsEnabled, nearbyRestaurants, walkingRoute, describeSpot } from '../data/google.js';
import { auth, h, verified } from '../middleware.js';

const router = Router();
router.use(auth(), verified());

// The sample catalogue knows every diet a place can handle; Google data only knows some.
const SAMPLE = restaurants.map((r) => ({ ...r, source: 'sample', dietNo: [], dietCertain: true, priceKnown: true }));

// Which restaurants a session chooses from: real nearby places once a meetup spot is set (and
// Google is configured), otherwise the sample catalogue so the app still works without a key.
const usesGoogle = (session) => mapsEnabled() && !!session.meetup;
const candidates = (session) => (usesGoogle(session) ? session.places : SAMPLE);

const findRestaurant = (session, id) =>
  (id && (session.places.find((r) => r.id === id) || SAMPLE.find((r) => r.id === id))) || null;

// Fetch nearby restaurants from Google the first time they're needed for this meetup spot.
async function ensurePlaces(session) {
  if (!usesGoogle(session) || session.places.length) return;
  session.places = await nearbyRestaurants(session.meetup);
  await savePlaces(session.id, session.places);
}

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
    participants: session.participants.map(({ id, name, role, userId, invitedOnly }) => ({ id, name, role, joined: !!userId && !invitedOnly })),
    me: self ? { id: self.id, name: self.name, role: self.role } : null,
    myPreferences: self ? session.preferences[self.id] || null : null,
    myVotes: self ? session.votes[self.id] || {} : {},
    preferencesIn: Object.keys(session.preferences).length,
    votesIn: Object.keys(session.votes).length,
    picked: findRestaurant(session, session.pickedRestaurantId),
    schedule: session.schedule,
    meetup: session.meetup ? { lat: session.meetup.lat, lng: session.meetup.lng, label: session.meetup.label } : null,
    // Everyone's suggested date & time; the organizer confirms the final one (schedule).
    proposals: session.participants
      .filter((p) => session.proposals[p.id])
      .map((p) => ({ participantId: p.id, name: p.name, isYou: !!self && p.id === self.id, ...session.proposals[p.id] })),
    myProposal: self ? session.proposals[self.id] || null : null,
    mapsEnabled: mapsEnabled(),
  };
}

// Loads the session from the URL, or answers 404/403 and returns null.
async function load(req, res) {
  const session = await getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return null;
  }
  const self = me(session, req.user);
  if (!self) {
    res.status(403).json({ error: 'Join this session first.' });
    return null;
  }
  // A group member who was invited to this session counts as joined once they open it.
  if (self.invitedOnly) {
    await markJoined(session.id, self.id);
    self.invitedOnly = false;
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

  // A place is ruled out when it's known not to meet a need. For Google places most needs are
  // unknown: those places stay in, with the needs listed in dietUnknown so the group can ask.
  const fails = (r, d) => (r.dietCertain ? !r.diet.includes(d) : r.dietNo.includes(d));

  return candidates(session)
    .filter((r) => ![...diet].some((d) => fails(r, d)))
    .map((r) => {
      const cuisineScore = ((cravingCount[r.cuisine] || 0) + anyCount) / n;
      const overlap = Math.max(0, Math.min(r.priceMax, hi) - Math.max(r.priceMin, lo));
      const budgetScore = hi === Infinity && lo === 0 ? 1
        : !r.priceKnown ? 0.5 // no price info from Google: neutral
          : overlap / Math.max(1, r.priceMax - r.priceMin);
      const walkScore = r.walkMins <= maxWalk ? 1 - (r.walkMins / maxWalk) * 0.5 : Math.max(0, 0.3 - (r.walkMins - maxWalk) * 0.05);
      const score = Math.round(45 * cuisineScore + 30 * budgetScore + 25 * walkScore);
      const dietUnknown = [...diet].filter((d) => !r.diet.includes(d));
      return { ...r, score, dietUnknown };
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
router.get('/', h(async (req, res) => {
  const mine = await listSessionsForUser(req.user.id);
  res.json({ sessions: mine.map((s) => view(s, req.user)) });
}));

router.post('/', h(async (req, res) => {
  const { name, groupId } = req.body || {};
  let members = [];
  let group = null;
  if (groupId) {
    group = await getGroupForUser(groupId, req.user.id);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    // The owner sets up the group's session (and its meetup spot); members join it.
    if (group.role !== 'owner') {
      return res.status(403).json({
        error: group.openSession
          ? `Only ${group.owner.name} can start a session for this group. Join their open session instead.`
          : `Only ${group.owner.name} can start a session for this group. You'll see it here once they do.`,
        openSession: group.openSession,
      });
    }
    // Everyone in the group except whoever is starting the session (owner included when a member starts it).
    const everyone = [{ name: group.owner.name, userId: group.ownerId }, ...group.members];
    members = everyone.filter((m) => (m.userId ? m.userId !== req.user.id : m.name.toLowerCase() !== req.user.name.toLowerCase()));
  }
  const session = await createSession({ name: name || (group ? `${group.name} Session` : ''), organizer: req.user, members, groupId: group?.id || null });
  res.status(201).json({ session: view(session, req.user) });
}));

router.post('/join', h(async (req, res) => {
  const { code, pin, name } = req.body || {};
  const clean = String(code || '').trim().toLowerCase().split('/').pop();
  let session = await findJoinableSession({ code: clean, pin });
  if (!session) return res.status(404).json({ error: "We couldn't find that session. Check the link or PIN." });

  const already = me(session, req.user);
  if (already?.invitedOnly) {
    await markJoined(session.id, already.id);
    session = await getSession(session.id);
  }
  if (!already) {
    const displayName = (name || req.user.name || 'Guest').trim();
    // Claim a matching invited-only slot (e.g. "Tian" from the group) instead of adding a duplicate.
    const slot = session.participants.find((p) => p.invitedOnly && !p.userId && p.name.toLowerCase() === displayName.toLowerCase());
    if (slot) await claimParticipant(session.id, slot.id, req.user.id);
    else await addParticipant(session.id, { name: displayName, userId: req.user.id });
    session = await getSession(session.id);
  }
  res.json({ session: view(session, req.user) });
}));

router.get('/:id', h(async (req, res) => {
  const session = await load(req, res);
  if (session) res.json({ session: view(session, req.user) });
}));

router.patch('/:id', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  const self = me(session, req.user);
  if (typeof req.body?.name === 'string' && req.body.name.trim()) {
    if (self.role !== 'organizer') return res.status(403).json({ error: 'Only the organizer can rename the session.' });
    session.name = req.body.name.trim();
    await updateSession(session.id, { name: session.name });
  }
  res.json({ session: view(session, req.user) });
}));

// A joiner sets the name the group sees.
router.patch('/:id/me', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  const name = (req.body?.name || '').trim();
  if (name) {
    const self = me(session, req.user);
    self.name = name.slice(0, 30);
    await renameParticipant(session.id, self.id, self.name);
  }
  res.json({ session: view(session, req.user) });
}));

router.put('/:id/preferences', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  const { budgetMin, budgetMax, maxWalk, cravings = [], diet = [] } = req.body || {};
  if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) {
    return res.status(400).json({ error: 'Minimum budget should be lower than the maximum.' });
  }
  const self = me(session, req.user);
  const prefs = {
    budgetMin: Number(budgetMin) || 0,
    budgetMax: Number(budgetMax) || 0,
    maxWalk: Number(maxWalk) || 0,
    cravings: Array.isArray(cravings) ? cravings.map(String) : [],
    diet: Array.isArray(diet) ? diet.map(String) : [],
  };
  await savePreferences(session.id, self.id, prefs);
  session.preferences[self.id] = prefs;
  if (session.status === 'open') {
    session.status = 'voting';
    await updateSession(session.id, { status: 'voting' });
  }
  res.json({ session: view(session, req.user) });
}));

// Organizer sets where the group meets: { lat, lng, label?, placeId? }
router.put('/:id/meetup', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  if (me(session, req.user).role !== 'organizer') return res.status(403).json({ error: 'Only the organizer can set the meetup spot.' });
  if (session.status === 'done') return res.status(400).json({ error: 'This session is already scheduled.' });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'That location is not valid.' });
  }
  let label = String(req.body?.label || '').trim().slice(0, 120);
  if (!label && mapsEnabled()) label = (await describeSpot({ lat, lng }).catch(() => null)) || '';
  label ||= 'Pinned location';
  const placeId = typeof req.body?.placeId === 'string' ? req.body.placeId : null;
  await setMeetup(session.id, { lat, lng, label, placeId });
  res.json({ session: view(await getSession(session.id), req.user) });
}));

router.get('/:id/matches', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  if (mapsEnabled() && !session.meetup) return res.json({ matches: [], needsMeetup: true });
  await ensurePlaces(session);
  res.json({ matches: rankRestaurants(session), meetup: view(session, req.user).meetup });
}));

// Walking directions from the meetup spot to the picked restaurant.
router.get('/:id/route', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  const place = findRestaurant(session, session.pickedRestaurantId);
  if (!usesGoogle(session) || !place || place.source !== 'google') return res.json({ route: null });
  let route = await getRoute(session.id, place.id);
  if (!route) {
    route = await walkingRoute(session.meetup, { placeId: place.id, lat: place.lat, lng: place.lng });
    if (route) await saveRoute(session.id, place.id, route);
  }
  res.json({ route, from: view(session, req.user).meetup, to: { name: place.name, lat: place.lat, lng: place.lng, placeId: place.id } });
}));

router.put('/:id/votes', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  const votes = {};
  for (const [rid, v] of Object.entries(req.body?.votes || {})) if (v === 'yes' || v === 'maybe') votes[rid] = v;
  const self = me(session, req.user);
  await saveVotes(session.id, self.id, votes);
  session.votes[self.id] = votes;
  res.json({ session: view(session, req.user) });
}));

router.get('/:id/results', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  if (mapsEnabled() && !session.meetup && !session.pickedRestaurantId) {
    return res.json({ winner: null, board: [], needsMeetup: true, session: view(session, req.user) });
  }
  await ensurePlaces(session);
  const board = tally(session);
  if (!session.pickedRestaurantId || session.status !== 'done') {
    const leader = board[0]?.id || null;
    if (leader !== session.pickedRestaurantId) await updateSession(session.id, { pickedRestaurantId: leader });
    session.pickedRestaurantId = leader;
  }
  res.json({ winner: findRestaurant(session, session.pickedRestaurantId), board, session: view(session, req.user) });
}));

// Today's date in the Philippines, as YYYY-MM-DD.
const todayPH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

function readWhen(body) {
  const { date, time } = body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(date))) return { error: 'Pick a date.' };
  if (date < todayPH()) return { error: 'That date has already passed. Pick today or a later day.' };
  return { date, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '') ? time : '12:00' };
}

// Anyone suggests the date & time that works for them (until the organizer confirms).
router.put('/:id/proposal', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  if (session.status === 'done') return res.status(400).json({ error: 'The date is already final.' });
  const when = readWhen(req.body);
  if (when.error) return res.status(400).json({ error: when.error });
  const self = me(session, req.user);
  await saveProposal(session.id, self.id, when);
  session.proposals[self.id] = when;
  res.json({ session: view(session, req.user) });
}));

// The organizer (group owner) confirms the final date & time.
router.put('/:id/schedule', h(async (req, res) => {
  const session = await load(req, res);
  if (!session) return;
  if (me(session, req.user).role !== 'organizer') {
    return res.status(403).json({ error: 'Only the organizer can set the final date. Suggest yours instead.' });
  }
  const when = readWhen(req.body);
  if (when.error) return res.status(400).json({ error: when.error });
  // The final date has to be one of the group's picks (the organizer's own pick counts as one).
  const picked = Object.values(session.proposals).some((p) => p.date === when.date && p.time === when.time);
  if (!picked) return res.status(400).json({ error: "Choose one of the group's picks. To suggest a different time, send it as your own pick first." });
  session.schedule = when;
  session.status = 'done';
  if (!session.pickedRestaurantId) {
    await ensurePlaces(session);
    session.pickedRestaurantId = tally(session)[0]?.id || null;
  }
  await updateSession(session.id, { schedule: session.schedule, status: 'done', pickedRestaurantId: session.pickedRestaurantId });
  res.json({ session: view(session, req.user) });
}));

export default router;
