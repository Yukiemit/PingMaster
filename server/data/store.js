// In-memory data store. Everything resets when the server restarts.
// Swap these arrays for a real database (MongoDB, Postgres, ...) when ready.
import crypto from 'node:crypto';

export const db = {
  users: [],      // { id, name, email, passwordHash, isGuest }
  tokens: new Map(), // token -> userId
  groups: [],     // { id, ownerId, name, members: [{ id, name, preference }] }
  sessions: [],   // see createSession()
};

export const uid = (prefix = '') => prefix + crypto.randomBytes(5).toString('hex');

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

export function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens.set(token, userId);
  return token;
}

export function publicUser(u) {
  return u && { id: u.id, name: u.name, email: u.email, isGuest: !!u.isGuest };
}

// Short invite code for links (saantayo.app/join/<code>) and a unique 4-digit PIN.
export function newInviteCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  } while (db.sessions.some((s) => s.code === code));
  return code;
}

export function newPin() {
  let pin;
  do {
    pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  } while (db.sessions.some((s) => s.pin === pin && s.status !== 'done'));
  return pin;
}

export function createSession({ name, organizer, members = [] }) {
  const session = {
    id: uid('s_'),
    code: newInviteCode(),
    pin: newPin(),
    name: name || 'Untitled Session',
    organizerId: organizer.id,
    status: 'open', // open -> voting -> done
    createdAt: new Date().toISOString(),
    // participants: account users and named guests who joined via link/PIN
    participants: [
      { id: organizer.id, name: organizer.name, role: 'organizer', userId: organizer.id },
      ...members.map((m) => ({ id: uid('p_'), name: m.name, role: 'member', userId: null, invitedOnly: true })),
    ],
    preferences: {}, // participantId -> { budgetMin, budgetMax, maxWalk, cravings[], diet[] }
    votes: {},       // participantId -> { restaurantId: 'yes' | 'maybe' }
    pickedRestaurantId: null,
    schedule: null,  // { date: 'YYYY-MM-DD', time: 'HH:MM' }
  };
  db.sessions.push(session);
  return session;
}

// ---- Demo seed -----------------------------------------------------------
const demo = {
  id: 'u_demo',
  name: 'Belle',
  email: 'demo@saantayo.app',
  passwordHash: hashPassword('tarakain'),
};
db.users.push(demo);

db.groups.push(
  {
    id: 'g_barkada',
    ownerId: demo.id,
    name: 'Barkada',
    members: [
      { id: 'm1', name: 'Yuki', preference: 'No pork' },
      { id: 'm2', name: 'Tian', preference: 'No restrictions' },
      { id: 'm3', name: 'Belle', preference: 'No restrictions' },
      { id: 'm4', name: 'Rich', preference: 'Vegetarian' },
      { id: 'm5', name: 'Pia', preference: 'Nut allergy' },
    ],
  },
  {
    id: 'g_family',
    ownerId: demo.id,
    name: 'Family',
    members: [
      { id: 'm6', name: 'Mama', preference: 'No restrictions' },
      { id: 'm7', name: 'Papa', preference: 'No pork' },
      { id: 'm8', name: 'Kuya', preference: 'No restrictions' },
      { id: 'm9', name: 'Ate', preference: 'Seafood allergy' },
    ],
  },
);

const past = createSession({
  name: 'Barkada Dinner Date',
  organizer: demo,
  members: db.groups[0].members.filter((m) => m.name !== 'Belle'),
});
Object.assign(past, { status: 'done', pickedRestaurantId: 'r2', schedule: { date: '2026-10-02', time: '19:00' } });

const upcoming = createSession({
  name: 'Family Dinner',
  organizer: demo,
  members: db.groups[1].members.slice(0, 3),
});
Object.assign(upcoming, { status: 'done', pickedRestaurantId: 'r3', schedule: { date: '2026-11-06', time: '18:00' } });
