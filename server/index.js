import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import sessionRoutes from './routes/sessions.js';
import { auth, h, verified } from './middleware.js';
import { scheduledSessionsForUser } from './data/store.js';
import { restaurants, CUISINES } from './data/restaurants.js';
import { mapsEnabled, browserKey, searchPlaces, autocompletePlaces, placeDetails } from './data/google.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/restaurants', (req, res) => res.json({ restaurants, cuisines: CUISINES }));

// Tells the website whether real maps are on, and which key draws them.
app.get('/api/config', (req, res) => res.json({ mapsEnabled: mapsEnabled(), mapsKey: mapsEnabled() ? browserKey() : '' }));

// Search for a meetup spot (organizer's picker).
app.get('/api/places/search', auth(), h(async (req, res) => {
  if (!mapsEnabled()) return res.status(503).json({ error: 'Maps are not set up yet (GOOGLE_MAPS_API_KEY is missing).' });
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ places: [] });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && req.query.lat ? { lat, lng } : { lat: 14.5995, lng: 120.9842 }; // default: Manila
  res.json({ places: await searchPlaces(q, near) });
}));

const nearFrom = (query) => {
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  return query.lat && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: 14.5995, lng: 120.9842 }; // default: Manila
};
const token = (t) => (typeof t === 'string' && /^[\w-]{8,64}$/.test(t) ? t : undefined);

// Suggestions as the organizer types a meetup spot.
app.get('/api/places/autocomplete', auth(), h(async (req, res) => {
  if (!mapsEnabled()) return res.status(503).json({ error: 'Maps are not set up yet (GOOGLE_MAPS_API_KEY is missing).' });
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q.length < 2) return res.json({ suggestions: [] });
  res.json({ suggestions: await autocompletePlaces(q, nearFrom(req.query), token(req.query.token)) });
}));

// Location of a picked suggestion.
app.get('/api/places/details/:placeId', auth(), h(async (req, res) => {
  if (!mapsEnabled()) return res.status(503).json({ error: 'Maps are not set up yet (GOOGLE_MAPS_API_KEY is missing).' });
  if (!/^[\w-]{10,300}$/.test(req.params.placeId)) return res.status(400).json({ error: 'Invalid place.' });
  res.json({ place: await placeDetails(req.params.placeId, token(req.query.token)) });
}));

// Every scheduled session the user is part of, for My Calendar.
app.get('/api/calendar', auth(), verified(), h(async (req, res) => {
  const events = (await scheduledSessionsForUser(req.user.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      date: s.date,
      time: s.time,
      restaurant: s.pickedName || restaurants.find((r) => r.id === s.pickedRestaurantId)?.name || 'TBD',
      people: s.people,
    }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json({ events });
}));

// In production, serve the built React app from the same server.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  // Errors worth showing as-is: Google Maps problems (API not enabled, billing, key) and an outdated database.
  if (err.publicMessage) return res.status(502).json({ error: err.publicMessage });
  if (err.code === '42P01' || err.code === '42703') {
    return res.status(500).json({ error: 'The database tables are out of date. Run: npm run db:setup --prefix server' });
  }
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

// On Vercel the app runs as a serverless function (see api/index.mjs), so only listen when run directly.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Saan Tayo? API running on http://localhost:${PORT}`));
}

export default app;
