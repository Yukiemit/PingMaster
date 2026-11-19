// Checks the Google key in server/.env against each API the app uses and explains any error.
// Usage (from the project folder):  npm run maps:check --prefix server
import 'dotenv/config';

const key = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
if (!key) {
  console.log('GOOGLE_MAPS_API_KEY is empty in server/.env');
  process.exit(1);
}
console.log(`Key: ${key.slice(0, 6)}… (${key.length} characters)\n`);

const HELP = {
  SERVICE_DISABLED: 'This API is NOT enabled in the project that owns this key. Open the link below (it is for the right project) and click Enable.',
  API_KEY_SERVICE_BLOCKED: "The key's API restrictions don't allow this API. Credentials → your key → API restrictions: tick this API (or Don't restrict key) → Save.",
  BILLING_DISABLED: 'Billing is not turned on for this project. Billing → link a billing account to this project.',
  API_KEY_INVALID: 'The key is wrong. Copy it again from Credentials (no spaces or quotes).',
  API_KEY_HTTP_REFERRER_BLOCKED: 'The key is limited to websites. Credentials → your key → Application restrictions: None → Save.',
  API_KEY_IP_ADDRESS_BLOCKED: 'The key is limited to certain IP addresses. Credentials → your key → Application restrictions: None → Save.',
};

async function check(name, url, body, mask) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return console.log(`✅ ${name}: working`);
    const info = (data.error?.details || []).find((d) => d.reason) || {};
    console.log(`❌ ${name}: ${res.status} ${data.error?.message || ''}`);
    if (info.reason) console.log(`   Reason: ${info.reason}`);
    if (info.metadata?.consumer) console.log(`   Project: ${info.metadata.consumer}`);
    if (HELP[info.reason]) console.log(`   Fix: ${HELP[info.reason]}`);
    if (info.metadata?.activationUrl) console.log(`   Link: ${info.metadata.activationUrl}`);
  } catch (e) {
    console.log(`❌ ${name}: could not reach Google (${e.message})`);
  }
  console.log();
}

const here = { latitude: 14.6537, longitude: 121.0687 };
await check('Places API (New)', 'https://places.googleapis.com/v1/places:searchNearby',
  { includedTypes: ['restaurant'], maxResultCount: 1, locationRestriction: { circle: { center: here, radius: 500 } } },
  'places.displayName');
await check('Routes API', 'https://routes.googleapis.com/directions/v2:computeRoutes',
  { origin: { location: { latLng: here } }, destination: { location: { latLng: { latitude: 14.6555, longitude: 121.0700 } } }, travelMode: 'WALK' },
  'routes.distanceMeters');
console.log('Maps JavaScript API (the map itself) can only be checked in the browser: if the map is grey or shows an error, enable it the same way.');
