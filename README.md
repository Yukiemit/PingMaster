# Saan Tayo?

Group food-trip planner: collect everyone's picks, vote, and settle the bill in one place.
**React (Vite) frontend + Express backend.**

## Run it

Requires Node.js 18+.

```bash
npm run install:all   # installs root, server and client dependencies
npm run dev           # API on http://localhost:5000, website on http://localhost:5173
```

Open http://localhost:5173. Demo login: `demo@saantayo.app` / `tarakain` (or tap **Continue As Guest**).

Production build: `npm run build` then `npm start` — Express serves the built site and the API on port 5000.

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
  data/store.js        in-memory data + demo seed (resets on restart)
  data/restaurants.js  sample restaurant catalogue
```

## Notes / next steps

- **Data is in memory.** Swap `server/data/store.js` for MongoDB/Postgres before real use.
- **Restaurants are sample data.** Matching scores cuisine (45%), budget overlap (30%) and walking time (25%), and filters out places that can't meet anyone's dietary needs. Plug in a real source (e.g. Google Places) in `routes/sessions.js`.
- **Map on Results is an illustration** with an "Open in Google Maps" link. Replace `components/MapPreview.jsx` with a real map when you have an API key.
- **Add to Google Calendar** opens a pre-filled Google Calendar event and saves the date to My Calendar.
- **Forgot Password** is a stub endpoint; wire it to an email service.
- Photos in `client/src/assets` were cropped from the design mockups — replace them with the original full-resolution images.
- Font: Poppins, self-hosted via `@fontsource/poppins`.
