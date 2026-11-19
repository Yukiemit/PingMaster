// Creates the tables (db/schema.sql) and adds the demo account once.
// Usage (from server/):  npm run db:setup
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closePool } from '../data/db.js';
import { hashPassword, createUser, createGroup, addGroupMember, createSession, updateSession } from '../data/store.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function seedDemo() {
  const { rowCount } = await query(`select 1 from users where id = 'u_demo'`);
  if (rowCount) return console.log('Demo account already exists, skipping seed.');

  const demo = await createUser({ id: 'u_demo', name: 'Belle', email: 'demo@saantayo.app', passwordHash: hashPassword('tarakain'), emailVerified: true });

  const barkada = await createGroup({ id: 'g_barkada', ownerId: demo.id, name: 'Barkada' });
  for (const [id, name, preference] of [
    ['m1', 'Yuki', 'No pork'], ['m2', 'Tian', 'No restrictions'], ['m3', 'Belle', 'No restrictions'],
    ['m4', 'Rich', 'Vegetarian'], ['m5', 'Pia', 'Nut allergy'],
  ]) await addGroupMember(barkada.id, { id, name, preference });

  const family = await createGroup({ id: 'g_family', ownerId: demo.id, name: 'Family' });
  for (const [id, name, preference] of [
    ['m6', 'Mama', 'No restrictions'], ['m7', 'Papa', 'No pork'], ['m8', 'Kuya', 'No restrictions'], ['m9', 'Ate', 'Seafood allergy'],
  ]) await addGroupMember(family.id, { id, name, preference });

  const past = await createSession({
    name: 'Barkada Dinner Date',
    organizer: demo,
    members: [{ name: 'Yuki' }, { name: 'Tian' }, { name: 'Rich' }, { name: 'Pia' }],
  });
  await updateSession(past.id, { status: 'done', pickedRestaurantId: 'r2', schedule: { date: '2026-10-02', time: '19:00' } });

  const upcoming = await createSession({
    name: 'Family Dinner',
    organizer: demo,
    members: [{ name: 'Mama' }, { name: 'Papa' }, { name: 'Kuya' }],
  });
  await updateSession(upcoming.id, { status: 'done', pickedRestaurantId: 'r3', schedule: { date: '2026-11-06', time: '18:00' } });

  console.log('Added demo account: demo@saantayo.app / tarakain');
}

try {
  await query(fs.readFileSync(path.join(here, '../db/schema.sql'), 'utf8'));
  console.log('Tables are ready.');
  if (!process.argv.includes('--no-seed')) await seedDemo();
} catch (err) {
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
