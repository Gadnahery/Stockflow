/* StockFlow service worker v9 — offline-first app shell with user-confirmed updates */
const CACHE = 'stockflow-v9'

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('stockflow-') && k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/realtime/') ||
    url.pathname.startsWith('/api/')
  ) {
    return
  }

  // App shell is cache-first so installed users can launch without a data bundle.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const network = fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put('/index.html', res.clone()))
          return res
        })
        return cached || network.catch(() => caches.match('/'))
      }),
    )
    return
  }

  // Cache-first for app bundles: launch immediately offline or on a slow mobile network.
  // Refresh cached assets in the background for the next launch.
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css'))
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone()))
          return res
        }).catch(() => cached)
        return cached || refresh
      }),
    )
    return
  }

  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.json'))
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
  }
})
