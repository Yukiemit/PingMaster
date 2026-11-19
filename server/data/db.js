// Postgres connection (Supabase). Set DATABASE_URL in server/.env locally,
// or in the Vercel project's Environment Variables when deployed.
import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates (avoids timezone shifts).
pg.types.setTypeParser(1082, (v) => v);

let pool;

export function getPool() {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set. Add your Supabase connection string to server/.env.');
  const url = new URL(raw);
  url.searchParams.delete('sslmode'); // SSL is configured below
  const local = ['localhost', '127.0.0.1'].includes(url.hostname) || process.env.PGSSL === 'off';
  pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    // Serverless functions should hold very few connections; use Supabase's pooler URL there.
    max: Number(process.env.PG_POOL_MAX) || (process.env.VERCEL ? 1 : 5),
  });
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

// Run fn(client) inside a transaction.
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}
