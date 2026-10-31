import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import sessionRoutes from './routes/sessions.js';
import { auth } from './middleware.js';
import { db } from './data/store.js';
import { restaurants, CUISINES } from './data/restaurants.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/restaurants', (req, res) => res.json({ restaurants, cuisines: CUISINES }));

// Every scheduled session the user is part of, for My Calendar.
app.get('/api/calendar', auth(), (req, res) => {
  const events = db.sessions
    .filter((s) => s.schedule && s.participants.some((p) => p.userId === req.user.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      date: s.schedule.date,
      time: s.schedule.time,
      restaurant: restaurants.find((r) => r.id === s.pickedRestaurantId)?.name || 'TBD',
      people: s.participants.length,
    }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  res.json({ events });
});

// In production, serve the built React app from the same server.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

app.listen(PORT, () => console.log(`Saan Tayo? API running on http://localhost:${PORT}`));
