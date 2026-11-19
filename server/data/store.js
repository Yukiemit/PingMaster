// Data access for Saan Tayo?, backed by Postgres (Supabase). See db/schema.sql for the tables.
// Every function returns plain objects in the same shapes the routes have always used.
import crypto from 'node:crypto';
import { query, tx } from './db.js';

export const uid = (prefix = '') => prefix + crypto.randomBytes(5).toString('hex');

// ---- Passwords & tokens ------------------------------------------------------
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

export async function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  await query('insert into auth_tokens (token, user_id) values ($1, $2)', [token, userId]);
  return token;
}

export async function userForToken(token) {
  const { rows } = await query(
    `select u.* from auth_tokens t join users u on u.id = t.user_id
     where t.token = $1 and t.expires_at > now()`,
    [token],
  );
  return toUser(rows[0]);
}

export async function revokeToken(token) {
  await query('delete from auth_tokens where token = $1', [token]);
}

// ---- Users -------------------------------------------------------------------
const toUser = (r) => r && {
  id: r.id, name: r.name, email: r.email, passwordHash: r.password_hash, isGuest: r.is_guest,
  emailVerified: r.email_verified !== false,
};

export function publicUser(u) {
  return u && { id: u.id, name: u.name, email: u.email, isGuest: !!u.isGuest, emailVerified: !u.isGuest && u.emailVerified !== false };
}

export async function findUserByEmail(email, { includeGuests = true } = {}) {
  const { rows } = await query(
    `select * from users where email = $1 ${includeGuests ? '' : 'and not is_guest'} limit 1`,
    [email],
  );
  return toUser(rows[0]);
}

export async function createUser({ id = uid('u_'), name, email = null, passwordHash = null, isGuest = false, emailVerified = false }) {
  const { rows } = await query(
    'insert into users (id, name, email, password_hash, is_guest, email_verified) values ($1, $2, $3, $4, $5, $6) returning *',
    [id, name, email, passwordHash, isGuest, emailVerified],
  );
  return toUser(rows[0]);
}

export async function setEmailVerified(userId) {
  await query('update users set email_verified = true where id = $1', [userId]);
}

export async function setPassword(userId, passwordHash) {
  await query('update users set password_hash = $2 where id = $1', [userId, passwordHash]);
  await query('delete from auth_tokens where user_id = $1', [userId]); // log out everywhere
}

// ---- Email codes (verification & password reset) --------------------------------
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// Makes a new 6-digit code (replacing any older one). Returns null if the last one is under a minute old.
export async function newEmailCode(userId, purpose) {
  const { rows } = await query(
    `select created_at > now() - interval '60 seconds' as recent from email_codes where user_id = $1 and purpose = $2`,
    [userId, purpose],
  );
  if (rows[0]?.recent) return null;
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await query(
    `insert into email_codes (user_id, purpose, code_hash, expires_at) values ($1, $2, $3, now() + interval '${CODE_TTL_MIN} minutes')
     on conflict (user_id, purpose) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, created_at = now()`,
    [userId, purpose, hashCode(userId, code)],
  );
  return code;
}

// 'ok' | 'wrong' | 'expired' | 'missing' | 'locked'
export async function checkEmailCode(userId, purpose, code) {
  const { rows } = await query('select *, expires_at < now() as expired from email_codes where user_id = $1 and purpose = $2', [userId, purpose]);
  const row = rows[0];
  if (!row) return 'missing';
  if (row.expired) return 'expired';
  if (row.attempts >= MAX_ATTEMPTS) return 'locked';
  const given = Buffer.from(hashCode(userId, String(code || '').trim()), 'hex');
  if (!crypto.timingSafeEqual(given, Buffer.from(row.code_hash, 'hex'))) {
    await query('update email_codes set attempts = attempts + 1 where user_id = $1 and purpose = $2', [userId, purpose]);
    return row.attempts + 1 >= MAX_ATTEMPTS ? 'locked' : 'wrong';
  }
  await query('delete from email_codes where user_id = $1 and purpose = $2', [userId, purpose]);
  return 'ok';
}

// ---- Groups ------------------------------------------------------------------
// A group has an owner (who made it) and members, who are real accounts.
async function attachMembers(groups, viewerId) {
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const [{ rows }, owners] = await Promise.all([
    query(
      `select m.id, m.group_id, m.user_id, coalesce(u.name, m.name) as name, m.preference
       from group_members m left join users u on u.id = m.user_id
       where m.group_id = any($1) order by m.seq`,
      [ids],
    ),
    query('select id, name from users where id = any($1)', [groups.map((g) => g.owner_id)]),
  ]);
  const open = await query(
    `select distinct on (group_id) group_id, id, name from sessions
     where group_id = any($1) and status <> 'done' order by group_id, created_at desc`,
    [ids],
  );
  return groups.map((g) => {
    const owner = owners.rows.find((u) => u.id === g.owner_id);
    const os = open.rows.find((x) => x.group_id === g.id);
    return {
      id: g.id,
      ownerId: g.owner_id,
      owner: { id: g.owner_id, name: owner?.name || 'Owner', isYou: g.owner_id === viewerId },
      name: g.name,
      role: g.owner_id === viewerId ? 'owner' : 'member',
      openSession: os ? { id: os.id, name: os.name } : null, // the owner's session that's still being planned
      members: rows.filter((m) => m.group_id === g.id).map((m) => ({
        id: m.id,
        name: m.name,
        preference: m.preference,
        userId: m.user_id,
        hasAccount: !!m.user_id,
        isYou: !!viewerId && m.user_id === viewerId,
      })),
    };
  });
}

// Groups the user made plus groups they were added to.
export async function listGroups(userId) {
  const { rows } = await query(
    `select g.* from friend_groups g
     where g.owner_id = $1 or exists (select 1 from group_members m where m.group_id = g.id and m.user_id = $1)
     order by (g.owner_id = $1) desc, g.created_at, g.id`,
    [userId],
  );
  return attachMembers(rows, userId);
}

// Returns the group only if it belongs to ownerId.
export async function getGroup(id, ownerId) {
  const { rows } = await query('select * from friend_groups where id = $1 and owner_id = $2', [id, ownerId]);
  return (await attachMembers(rows, ownerId))[0] || null;
}

// Returns the group if the user owns it or is a member of it.
export async function getGroupForUser(id, userId) {
  const { rows } = await query(
    `select g.* from friend_groups g where g.id = $1
     and (g.owner_id = $2 or exists (select 1 from group_members m where m.group_id = g.id and m.user_id = $2))`,
    [id, userId],
  );
  return (await attachMembers(rows, userId))[0] || null;
}

export async function createGroup({ id = uid('g_'), ownerId, name }) {
  await query('insert into friend_groups (id, owner_id, name) values ($1, $2, $3)', [id, ownerId, name]);
  return getGroup(id, ownerId);
}

export async function deleteGroup(id) {
  await query('delete from friend_groups where id = $1', [id]);
}

// Exact, case-insensitive match on an account's name or email (guests excluded).
// Exact matching means nobody can browse other people's accounts by typing a few letters.
export async function findAccounts(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return [];
  const { rows } = await query(
    `select id, name, email from users where not is_guest and email_verified and (lower(email) = $1 or lower(name) = $1) limit 5`,
    [t],
  );
  return rows;
}

export async function addGroupMember(groupId, { id = uid('m_'), name, preference, userId = null }) {
  await query(
    'insert into group_members (id, group_id, name, preference, user_id) values ($1, $2, $3, $4, $5)',
    [id, groupId, name, preference, userId],
  );
}

export async function updateGroupMember(groupId, memberId, { name, preference }) {
  await query(
    `update group_members set name = coalesce($3, name), preference = coalesce($4, preference)
     where id = $1 and group_id = $2`,
    [memberId, groupId, name ?? null, preference ?? null],
  );
}

export async function deleteGroupMember(groupId, memberId) {
  await query('delete from group_members where id = $1 and group_id = $2', [memberId, groupId]);
}

// ---- Sessions ----------------------------------------------------------------
// Short invite code for links (saantayo.app/join/<code>) and a 4-digit PIN that is
// unique among sessions that aren't done.
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const randomCode = () => Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
const randomPin = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

async function freshCodeAndPin(client) {
  for (;;) {
    const code = randomCode();
    const pin = randomPin();
    const { rowCount } = await client.query(
      `select 1 from sessions where code = $1 or (pin = $2 and status <> 'done')`,
      [code, pin],
    );
    if (!rowCount) return { code, pin };
  }
}

export async function createSession({ name, organizer, members = [], groupId = null }) {
  const id = uid('s_');
  for (let attempt = 0; ; attempt++) {
    try {
      await tx(async (client) => {
        const { code, pin } = await freshCodeAndPin(client);
        await client.query(
          'insert into sessions (id, code, pin, name, organizer_id, group_id) values ($1, $2, $3, $4, $5, $6)',
          [id, code, pin, name || 'Untitled Session', organizer.id, groupId],
        );
        // participants: account users and named guests who joined via link/PIN
        await client.query(
          `insert into participants (id, session_id, name, role, user_id) values ($1, $2, $3, 'organizer', $1)`,
          [organizer.id, id, organizer.name],
        );
        // Invited members: linked to their account when they have one, so the session shows up
        // on their Home page right away; invited_only stays true until they open it.
        for (const m of members) {
          await client.query(
            `insert into participants (id, session_id, name, role, user_id, invited_only) values ($1, $2, $3, 'member', $4, true)`,
            [uid('p_'), id, m.name, m.userId || null],
          );
        }
      });
      return getSession(id);
    } catch (err) {
      // Another session grabbed the same code/PIN at the same moment: try again.
      if (err.code === '23505' && attempt < 5) continue;
      throw err;
    }
  }
}

// Loads a session in the shape the routes and matcher use:
// { id, code, pin, name, organizerId, status, createdAt, participants[], preferences{}, votes{},
//   pickedRestaurantId, schedule }
export async function getSession(id) {
  const { rows } = await query('select * from sessions where id = $1', [id]);
  const s = rows[0];
  if (!s) return null;
  const [parts, prefs, votes, places, picks] = await Promise.all([
    query('select * from participants where session_id = $1 order by seq', [id]),
    query('select * from preferences where session_id = $1', [id]),
    query('select * from votes where session_id = $1', [id]),
    query('select data from session_places where session_id = $1', [id]),
    query('select participant_id, date, time from time_proposals where session_id = $1 order by updated_at', [id]),
  ]);
  const preferences = {};
  for (const p of prefs.rows) {
    preferences[p.participant_id] = {
      budgetMin: p.budget_min,
      budgetMax: p.budget_max,
      maxWalk: p.max_walk,
      cravings: p.cravings,
      diet: p.diet,
    };
  }
  const voteMap = {};
  for (const v of votes.rows) (voteMap[v.participant_id] ||= {})[v.restaurant_id] = v.value;
  return {
    id: s.id,
    code: s.code,
    pin: s.pin,
    name: s.name,
    organizerId: s.organizer_id,
    status: s.status,
    createdAt: new Date(s.created_at).toISOString(),
    participants: parts.rows.map((p) => ({ id: p.id, name: p.name, role: p.role, userId: p.user_id, invitedOnly: p.invited_only })),
    preferences,
    votes: voteMap,
    pickedRestaurantId: s.picked_restaurant_id,
    schedule: s.schedule_date ? { date: s.schedule_date, time: s.schedule_time } : null,
    // Where the group meets; nearby restaurants and walking distances are measured from here.
    meetup: s.meet_lat != null ? { lat: s.meet_lat, lng: s.meet_lng, label: s.meet_label, placeId: s.meet_place_id } : null,
    places: places.rows.map((r) => r.data), // real restaurants from Google for this meetup spot
    proposals: Object.fromEntries(picks.rows.map((r) => [r.participant_id, { date: r.date, time: r.time }])), // date & time picks
  };
}

export async function listSessionsForUser(userId) {
  const { rows } = await query(
    `select distinct s.id, s.created_at from sessions s join participants p on p.session_id = s.id
     where p.user_id = $1 order by s.created_at desc`,
    [userId],
  );
  return Promise.all(rows.map((r) => getSession(r.id)));
}

// Open/voting session matching an invite code or a PIN.
export async function findJoinableSession({ code, pin }) {
  const { rows } = await query(
    `select id from sessions where status <> 'done'
     and (($1 <> '' and code = $1) or ($2 <> '' and pin = $2))
     order by created_at desc limit 1`,
    [code || '', pin ? String(pin) : ''],
  );
  return rows[0] ? getSession(rows[0].id) : null;
}

export async function markJoined(sessionId, participantId) {
  await query('update participants set invited_only = false where session_id = $1 and id = $2', [sessionId, participantId]);
}

export async function claimParticipant(sessionId, participantId, userId) {
  await query('update participants set user_id = $3, invited_only = false where session_id = $1 and id = $2', [sessionId, participantId, userId]);
}

export async function addParticipant(sessionId, { id = uid('p_'), name, role = 'member', userId }) {
  await query(
    'insert into participants (id, session_id, name, role, user_id) values ($1, $2, $3, $4, $5)',
    [id, sessionId, name, role, userId],
  );
}

export async function renameParticipant(sessionId, participantId, name) {
  await query('update participants set name = $3 where session_id = $1 and id = $2', [sessionId, participantId, name]);
}

export async function updateSession(id, fields) {
  const cols = { name: 'name', status: 'status', pickedRestaurantId: 'picked_restaurant_id' };
  const sets = [];
  const vals = [id];
  for (const [key, col] of Object.entries(cols)) {
    if (key in fields) {
      vals.push(fields[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if ('schedule' in fields) {
    vals.push(fields.schedule?.date ?? null, fields.schedule?.time ?? null);
    sets.push(`schedule_date = $${vals.length - 1}`, `schedule_time = $${vals.length}`);
  }
  if (sets.length) await query(`update sessions set ${sets.join(', ')} where id = $1`, vals);
}

export async function savePreferences(sessionId, participantId, p) {
  await query(
    `insert into preferences (participant_id, session_id, budget_min, budget_max, max_walk, cravings, diet)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (session_id, participant_id) do update set budget_min = excluded.budget_min, budget_max = excluded.budget_max,
       max_walk = excluded.max_walk, cravings = excluded.cravings, diet = excluded.diet, updated_at = now()`,
    [participantId, sessionId, p.budgetMin, p.budgetMax, p.maxWalk, p.cravings, p.diet],
  );
}

// Replaces a participant's votes: { restaurantId: 'yes' | 'maybe' }
export async function saveVotes(sessionId, participantId, votes) {
  await tx(async (client) => {
    await client.query('delete from votes where session_id = $1 and participant_id = $2', [sessionId, participantId]);
    for (const [rid, value] of Object.entries(votes)) {
      await client.query(
        'insert into votes (participant_id, session_id, restaurant_id, value) values ($1, $2, $3, $4)',
        [participantId, sessionId, rid, value],
      );
    }
  });
}

// Sets the meetup spot. The old restaurant list, routes, votes and pick no longer apply, so they're cleared.
export async function setMeetup(sessionId, { lat, lng, label, placeId }) {
  await tx(async (client) => {
    await client.query(
      `update sessions set meet_lat = $2, meet_lng = $3, meet_label = $4, meet_place_id = $5, picked_restaurant_id = null
       where id = $1`,
      [sessionId, lat, lng, label, placeId],
    );
    await client.query('delete from session_places where session_id = $1', [sessionId]);
    await client.query('delete from session_routes where session_id = $1', [sessionId]);
    await client.query('delete from votes where session_id = $1', [sessionId]);
  });
}

export async function savePlaces(sessionId, places) {
  await tx(async (client) => {
    await client.query('delete from session_places where session_id = $1', [sessionId]);
    for (const p of places) {
      await client.query('insert into session_places (session_id, place_id, data) values ($1, $2, $3)', [sessionId, p.id, p]);
    }
  });
}

export async function getRoute(sessionId, placeId) {
  const { rows } = await query('select data from session_routes where session_id = $1 and place_id = $2', [sessionId, placeId]);
  return rows[0]?.data || null;
}

export async function saveRoute(sessionId, placeId, data) {
  await query(
    `insert into session_routes (session_id, place_id, data) values ($1, $2, $3)
     on conflict (session_id, place_id) do update set data = excluded.data, fetched_at = now()`,
    [sessionId, placeId, data],
  );
}

// A participant's suggested date & time (one per person; saving again replaces it).
export async function saveProposal(sessionId, participantId, { date, time }) {
  await query(
    `insert into time_proposals (session_id, participant_id, date, time) values ($1, $2, $3, $4)
     on conflict (session_id, participant_id) do update set date = excluded.date, time = excluded.time, updated_at = now()`,
    [sessionId, participantId, date, time],
  );
}

// Every scheduled session the user is part of, for My Calendar.
export async function scheduledSessionsForUser(userId) {
  const { rows } = await query(
    `select s.id, s.name, s.schedule_date, s.schedule_time, s.picked_restaurant_id,
            (select sp.data->>'name' from session_places sp
              where sp.session_id = s.id and sp.place_id = s.picked_restaurant_id) as picked_name,
            (select count(*)::int from participants x where x.session_id = s.id) as people
     from sessions s
     where s.schedule_date is not null
       and exists (select 1 from participants p where p.session_id = s.id and p.user_id = $1)`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.schedule_date,
    time: r.schedule_time,
    pickedRestaurantId: r.picked_restaurant_id,
    pickedName: r.picked_name,
    people: r.people,
  }));
}
