// Google Maps Platform calls (server side). Needs GOOGLE_MAPS_API_KEY with these APIs enabled:
// Places API (New), Routes API. The browser map also uses Maps JavaScript API.
const PLACES = process.env.GOOGLE_PLACES_BASE || 'https://places.googleapis.com/v1';
const ROUTES = process.env.GOOGLE_ROUTES_BASE || 'https://routes.googleapis.com';

const serverKey = () => (process.env.GOOGLE_MAPS_API_KEY || '').trim();
export const mapsEnabled = () => !!serverKey();
// Key the browser uses to draw maps. Use a separate key restricted to your website if you can.
export const browserKey = () => (process.env.GOOGLE_MAPS_BROWSER_KEY || '').trim() || serverKey();

// POST with a JSON body, or GET when body is null. fieldMask is optional for some endpoints.
async function google(url, body, fieldMask) {
  const headers = { 'X-Goog-Api-Key': serverKey() };
  if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const api = url.includes('routes.googleapis') || url.includes('computeRoutes') ? 'Routes API' : 'Places API (New)';
    const err = new Error(`Google ${api} error (${res.status}): ${data.error?.message || 'request failed'}`);
    err.status = res.status;
    err.publicMessage = err.message;
    throw err;
  }
  return data;
}

// ---- Helpers -------------------------------------------------------------------
const WALK_M_PER_MIN = 80; // about 4.8 km/h
const DETOUR = 1.3;        // streets are rarely a straight line

export function distanceMeters(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CUISINE_RULES = [
  ['Burgers', ['hamburger']],
  ['Japanese', ['japanese', 'ramen', 'sushi']],
  ['Korean', ['korean']],
  ['Chinese', ['chinese', 'dim_sum', 'dumpling', 'cantonese']],
  ['Vietnamese', ['vietnamese']],
  ['Filipino', ['filipino']],
  ['Mexican', ['mexican', 'taco']],
  ['Italian', ['italian', 'pizza']],
  ['American', ['american', 'steak', 'barbecue', 'diner']],
  ['Pastry', ['bakery', 'pastry', 'dessert', 'cake', 'donut', 'confectionery']],
  ['Cafe', ['cafe', 'coffee', 'tea_house']],
];

const pretty = (t) => t.replace(/_restaurant$|_shop$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function cuisineOf(place) {
  const types = [place.primaryType, ...(place.types || [])].filter(Boolean);
  for (const t of types) {
    for (const [cuisine, keys] of CUISINE_RULES) if (keys.some((k) => t.includes(k))) return cuisine;
  }
  const generic = ['restaurant', 'food', 'point_of_interest', 'establishment', 'store'];
  const named = types.find((t) => !generic.includes(t));
  return named ? pretty(named) : 'Restaurant';
}

// Peso ranges per person for Google's price levels (used when a place has no exact price range).
const LEVEL_PESOS = {
  PRICE_LEVEL_INEXPENSIVE: [100, 300],
  PRICE_LEVEL_MODERATE: [300, 600],
  PRICE_LEVEL_EXPENSIVE: [600, 1200],
  PRICE_LEVEL_VERY_EXPENSIVE: [1200, 2500],
};

export function pricesOf(place) {
  const start = Number(place.priceRange?.startPrice?.units);
  const end = Number(place.priceRange?.endPrice?.units);
  if (start > 0) return { priceMin: start, priceMax: end > start ? end : Math.round(start * 1.5), priceKnown: true };
  const level = LEVEL_PESOS[place.priceLevel];
  if (level) return { priceMin: level[0], priceMax: level[1], priceKnown: true };
  return { priceMin: 0, priceMax: 0, priceKnown: false };
}

// Turns a Places API result into the restaurant shape the matcher uses.
export function toRestaurant(place, meetup) {
  const loc = { lat: place.location.latitude, lng: place.location.longitude };
  const straight = distanceMeters(meetup, loc);
  const distanceM = Math.round(straight * DETOUR);
  const veg = place.servesVegetarianFood;
  return {
    id: place.id,
    source: 'google',
    name: place.displayName?.text || 'Unnamed place',
    cuisine: cuisineOf(place),
    ...pricesOf(place),
    distanceM,
    walkMins: Math.max(1, Math.round(distanceM / WALK_M_PER_MIN)),
    address: place.shortFormattedAddress || place.formattedAddress || '',
    lat: loc.lat,
    lng: loc.lng,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? 0,
    mapsUri: place.googleMapsUri || null,
    // Google only reports vegetarian options; every other need is "unknown" (ask the restaurant).
    diet: veg === true ? ['vegetarian'] : [],
    dietNo: veg === false ? ['vegetarian', 'vegan'] : [],
    dietCertain: false,
  };
}

// ---- Places API (New) -----------------------------------------------------------
const NEARBY_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'location', 'primaryType', 'types',
  'priceLevel', 'priceRange', 'rating', 'userRatingCount', 'servesVegetarianFood', 'googleMapsUri', 'businessStatus',
].map((f) => `places.${f}`).join(',');

export const SEARCH_RADIUS_M = 1500; // about a 20-minute walk

// Up to 40 nearby food places around the meetup spot: the 20 closest plus the 20 most popular.
export async function nearbyRestaurants(meetup) {
  const body = (rankPreference) => ({
    includedTypes: ['restaurant', 'cafe', 'bakery'],
    maxResultCount: 20,
    rankPreference,
    locationRestriction: { circle: { center: { latitude: meetup.lat, longitude: meetup.lng }, radius: SEARCH_RADIUS_M } },
  });
  const url = `${PLACES}/places:searchNearby`;
  const [near, popular] = await Promise.all([
    google(url, body('DISTANCE'), NEARBY_FIELDS),
    google(url, body('POPULARITY'), NEARBY_FIELDS),
  ]);
  const seen = new Map();
  for (const p of [...(near.places || []), ...(popular.places || [])]) {
    if (!p.location || seen.has(p.id)) continue;
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') continue;
    seen.set(p.id, toRestaurant(p, meetup));
  }
  return [...seen.values()];
}

// Text search for the meetup spot picker ("UP Diliman", "SM North EDSA", ...).
export async function searchPlaces(text, near) {
  const body = { textQuery: text, maxResultCount: 6, languageCode: 'en' };
  if (near) body.locationBias = { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } };
  const data = await google(`${PLACES}/places:searchText`, body, 'places.id,places.displayName,places.formattedAddress,places.location');
  return (data.places || []).map((p) => ({
    placeId: p.id,
    label: p.displayName?.text || p.formattedAddress,
    address: p.formattedAddress || '',
    lat: p.location.latitude,
    lng: p.location.longitude,
  }));
}

// Short name for a dropped pin / GPS spot: the closest place within ~150 m ("Near Jollibee Katipunan").
export async function describeSpot(spot) {
  const data = await google(`${PLACES}/places:searchNearby`, {
    maxResultCount: 1,
    rankPreference: 'DISTANCE',
    locationRestriction: { circle: { center: { latitude: spot.lat, longitude: spot.lng }, radius: 150 } },
  }, 'places.displayName,places.shortFormattedAddress');
  const p = data.places?.[0];
  if (!p) return null;
  return p.displayName?.text ? `Near ${p.displayName.text}` : p.shortFormattedAddress || null;
}

// Suggestions while typing a meetup spot (Autocomplete (New)). sessionToken groups the
// keystrokes and the final pick into one billed session.
export async function autocompletePlaces(text, near, sessionToken) {
  const body = { input: text, languageCode: 'en', includedRegionCodes: ['ph'] };
  if (sessionToken) body.sessionToken = sessionToken;
  if (near) {
    body.locationBias = { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 30000 } };
    body.origin = { latitude: near.lat, longitude: near.lng };
  }
  const data = await google(`${PLACES}/places:autocomplete`, body);
  return (data.suggestions || []).map((s) => s.placePrediction).filter(Boolean).map((p) => ({
    placeId: p.placeId,
    main: p.structuredFormat?.mainText?.text || p.text?.text || '',
    secondary: p.structuredFormat?.secondaryText?.text || '',
    distanceMeters: p.distanceMeters ?? null,
  }));
}

// Coordinates for a picked suggestion.
export async function placeDetails(placeId, sessionToken) {
  const q = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '';
  const p = await google(`${PLACES}/places/${encodeURIComponent(placeId)}${q}`, null, 'id,displayName,formattedAddress,location');
  return {
    placeId: p.id,
    label: p.displayName?.text || p.formattedAddress,
    address: p.formattedAddress || '',
    lat: p.location.latitude,
    lng: p.location.longitude,
  };
}

// ---- Routes API -------------------------------------------------------------------
export async function walkingRoute(from, to) {
  const data = await google(
    `${ROUTES}/directions/v2:computeRoutes`,
    {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: to.placeId
        ? { placeId: to.placeId }
        : { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: 'WALK',
      languageCode: 'en',
      units: 'METRIC',
    },
    'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction',
  );
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    distanceMeters: route.distanceMeters || 0,
    durationSeconds: parseInt(route.duration, 10) || 0,
    polyline: route.polyline?.encodedPolyline || '',
    steps: (route.legs || []).flatMap((leg) => leg.steps || [])
      .filter((s) => s.navigationInstruction?.instructions)
      .map((s) => ({ instruction: s.navigationInstruction.instructions, distanceMeters: s.distanceMeters || 0 })),
  };
}
