// Offline support. The build fills in VERSION and PRECACHE (see vite.config.js).
// - The app itself (HTML, scripts, styles, fonts, base terrain): saved on the first visit, so the site opens offline.
// - Official data (data/*.json): always fetched fresh when online; the saved copy is used only when offline.
//   The site shows how old every dataset is, so an offline copy is never passed off as new.
// - River routing tiles and close-up terrain: saved as they are used, so a lake or river looked at once works offline.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP = 'app-' + VERSION, DATA = 'data', TILES = 'tiles', MAX_TILES = 600;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('app-') && k !== APP) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isData = (u) => u.origin === location.origin && /\/data\/.+\.json$/.test(u.pathname);
const isTile = (u) => u.hostname === 'elevation-tiles-prod.s3.amazonaws.com' || (u.origin === location.origin && u.pathname.includes('/terrain/route/'));

async function networkFirst(req, cacheName) {
  const c = await caches.open(cacheName);
  try {
    // revalidate data with the server; a navigation request can't be re-issued with options
    const r = await (req.mode === 'navigate' ? fetch(req) : fetch(req, { cache: 'no-cache' }));
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true }); // any cache: also the copy saved at install
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, cacheName, limit) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) {
    await c.put(req, r.clone());
    if (limit) { const keys = await c.keys(); for (let i = 0; i < keys.length - limit; i++) await c.delete(keys[i]); } // oldest first
  }
  return r;
}

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (req.mode === 'navigate') {
    // the page: fresh when online (new deploys show at once), saved copy offline
    e.respondWith(networkFirst(req, APP).catch(async () => (await caches.open(APP)).match('./') || Response.error()));
    return;
  }
  if (isData(u)) return e.respondWith(networkFirst(req, DATA));
  if (isTile(u)) return e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  if (u.origin === location.origin) e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
