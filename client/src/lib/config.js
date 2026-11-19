// Server settings the website needs (is Google Maps on, and the browser key). Fetched once.
let cached;
export function getConfig() {
  cached ||= fetch('/api/config').then((r) => (r.ok ? r.json() : { mapsEnabled: false })).catch(() => ({ mapsEnabled: false }));
  return cached;
}
