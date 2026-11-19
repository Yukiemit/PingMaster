# Saan Tayo?

Group food-trip planner: collect everyone's picks, vote, and settle the bill in one place.
**React (Vite) frontend + Express backend.**

## Run it

Requires Node.js 18+ and a Supabase project (the database).

```bash
npm run install:all   # installs root, server and client dependencies
```

Connect the database (once):

1. In Supabase, open your project → **Connect** → copy the **Transaction pooler** connection string (port 6543).
2. Copy `server/.env.example` to `server/.env` and paste it as `DATABASE_URL`, with your database password filled in.
3. Create the tables and the demo account: `npm run db:setup --prefix server`
   (or paste `server/db/schema.sql` into the Supabase SQL Editor; that skips the demo account).

Then:

```bash
npm run dev           # API on http://localhost:5000, website on http://localhost:5173
```

Open http://localhost:5173. Demo login: `demo@saantayo.app` / `tarakain` (or tap **Continue As Guest**).

Production build: `npm run build` then `npm start` — Express serves the built site and the API on port 5000.

## Real restaurants, maps and walking directions (Google)

With a Google key, the organizer sets a **meetup spot** on the Invite step (Use my location, or search a place).
Matching then uses real restaurants within ~1.5 km (Places API), shows them on a live map, and Results shows the
walking route, distance, time and step-by-step directions (Routes API). Without a key, the app uses the sample
restaurants and the illustrated map.

1. In Google Cloud Console, create a project and turn on billing (there is a monthly free allowance).
2. Enable **Places API (New)**, **Routes API** and **Maps JavaScript API**.
3. Create an API key (APIs & Services → Credentials) and put it in `server/.env` as `GOOGLE_MAPS_API_KEY=...`.
   Optionally add a second key restricted to your website as `GOOGLE_MAPS_BROWSER_KEY` (used only to draw the map).
4. Run `npm run db:setup --prefix server` once more (adds the meetup and restaurant tables), then restart `npm run dev`.

Notes: Google only reports vegetarian options, so other diet needs show as "Ask about: …" instead of filtering places
out. Places without price info get a neutral budget score. Results are cached per session; moving the meetup spot
refetches them and clears the votes.

## Deploy to Vercel

`vercel.json` builds the React site into `client/dist` (served from Vercel's CDN) and sends every `/api/*` request to `api/index.mjs`, which runs the same Express app as a Vercel Function.

1. Push the repo to GitHub, then import it at vercel.com/new (leave the preset settings as they are; `vercel.json` sets them).
2. Or from a terminal: `npm i -g vercel`, then `vercel` (preview) and `vercel --prod`.

In the Vercel project, add `DATABASE_URL` (your Supabase **Transaction pooler** connection string) and `GOOGLE_MAPS_API_KEY` under Settings → Environment Variables before deploying.

## Screens (routes)

| Route | Screen |
|---|---|
| `/` | Landing page (public) with the try-it voting demo |
| `/login`, `/signup` | Login / Sign up, with Continue As Guest |
| `/home` | Home: start a session, join by invite link or 4-digit PIN, how it works, recent sessions |
| `/groups` | My Group: groups, members, edit preferences, add friends, make group |
| `/calendar` | My Calendar: month view with session days, upcoming sessions |
| `/session/:id` | My Session: Invite → Preference → Matching → Results (organizer and joiner views) |
| `/join/:code` | Invite link handler |
| `/split` | Split the Bill: by order (shared items, charges, discounts) or split equally |

## Project layout

```
client/                React app (Vite)
  src/pages/           One file + CSS per screen
  src/components/      Nav, hero, footer, logo, icons, PIN input, map
  src/lib/api.js       fetch wrapper (token in localStorage)
  src/lib/split.js     bill-splitting math (centavo-exact); test: node src/lib/split.test.mjs
  src/styles/global.css  design tokens (colors, fonts) + shared styles
server/                Express API
  index.js             app + /api/calendar, /api/restaurants
  routes/auth.js       signup, login, guest, me, logout, forgot (stub)
  routes/groups.js     groups + members CRUD
  routes/sessions.js   create/join (code or PIN), preferences, matching, votes, results, schedule
  data/db.js           Postgres (Supabase) connection pool
  data/store.js        all database reads/writes (users, tokens, groups, sessions, votes)
  data/restaurants.js  sample restaurant catalogue
  db/schema.sql        tables (Row Level Security on, so only the server can read them)
  scripts/setup-db.js  creates the tables + demo account: npm run db:setup
```

## Notes / next steps

- **Data lives in Supabase Postgres.** The server connects directly with `DATABASE_URL`; the app does not use Supabase Auth or the Supabase JS client. Login tokens are stored in `auth_tokens` and expire after 30 days.
- **Restaurants** come from Google Places when `GOOGLE_MAPS_API_KEY` is set (see above), otherwise from the sample catalogue. Matching scores cuisine (45%), budget overlap (30%) and walking time (25%), and filters out places known not to meet someone's dietary needs.
- **Maps** are live Google maps (`components/GoogleMaps.jsx`) when a key is set; otherwise the illustrated `MapPreview.jsx` is shown.
- **Add to Google Calendar** opens a pre-filled Google Calendar event and saves the date to My Calendar.
- **Forgot Password** is a stub endpoint; wire it to an email service.
- Photos in `client/src/assets` were cropped from the design mockups — replace them with the original full-resolution images.
- Font: Poppins, self-hosted via `@fontsource/poppins`.
