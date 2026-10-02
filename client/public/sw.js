// PakMedRecord service worker: installable app shell, offline fallback, and offline copies
// of the signed-in patient's own records (cleared on sign-out by the app).
const SHELL = 'pmr-shell-v1';
const ASSETS = 'pmr-assets-v1';
const API = 'pmr-api';

// API reads worth keeping for offline use (the patient's own profile, records, medicines, appointments)
const OFFLINE_API = [/\/patient\/home\/\d+$/, /\/record\/getrecords\/\d+$/, /\/meds\/\d+/, /\/appointments\/mine\/\d+$/, /\/vaccines\/\d+$/, /\/affiliation\/getmydoctors\/\d+$/, /\/doctor\/home\/\d+$/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // App pages: always try the network, fall back to the cached shell offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((res) => {
      caches.open(SHELL).then((c) => c.put('/', res.clone()));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  // Hashed build assets and fonts never change: cache first
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok) caches.open(ASSETS).then((c) => c.put(request, res.clone()));
      return res;
    })));
    return;
  }

  // The patient's own data: fresh when online, last copy when offline
  if (url.origin !== self.location.origin && OFFLINE_API.some((rx) => rx.test(url.pathname))) {
    event.respondWith(networkFirst(request, API));
  }
});
