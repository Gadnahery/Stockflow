/* StockFlow service worker — offline-first app shell.
 *
 * Every file of ONE build (index.html + all hashed JS/CSS chunks + icons) is precached together
 * under a cache named after that build. The page and the scripts it needs therefore always come
 * from the same version, so an installed app launches offline after any number of deploys.
 * New versions install in the background and wait for the user to tap "Update" (no mid-sale reloads).
 *
 * The two placeholders below are filled in by the build (see vite.config.ts → sfPrecache).
 */
const BUILD = '__SF_BUILD__'
const PRECACHE_URLS = /*__SF_PRECACHE__*/ []

const SHELL_CACHE = 'sf-shell-' + BUILD
const IMG_CACHE = 'sf-img-v1' // product photos (Supabase public storage) — survives updates
const FONT_CACHE = 'sf-font-v1'
const MAX_IMAGES = 300
const DEV = BUILD.indexOf('__') === 0 // un-built copy (vite dev): do not cache anything

self.addEventListener('install', (event) => {
  if (DEV) return
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // 'reload' bypasses the HTTP cache so we store exactly this deploy's files.
      // addAll is atomic: if one file fails, install fails and the previous version keeps working.
      await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })))
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => (k.indexOf('sf-shell-') === 0 && k !== SHELL_CACHE) || k.indexOf('stockflow-') === 0)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type
  if (type === 'SKIP_WAITING') self.skipWaiting()
  if (type === 'CLEAR_CACHE') event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
})

function staleWhileRevalidate(cacheName, req, limit) {
  return caches.open(cacheName).then((cache) =>
    cache.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            cache.put(req, res.clone()).then(() => (limit ? trim(cache, limit) : undefined))
          }
          return res
        })
        .catch(() => cached || Response.error())
      return cached || refresh
    }),
  )
}

function trim(cache, limit) {
  return cache.keys().then((keys) => {
    if (keys.length <= limit) return undefined
    return Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)))
  })
}

// Any page navigation gets the cached app shell (this is a single-page app).
function appShell(req) {
  return caches.open(SHELL_CACHE).then((cache) =>
    cache.match('/index.html').then((cached) => cached || fetch(req)),
  )
}

// Build files: serve the precached copy; if somehow missing, try the network.
function precached(req) {
  return caches.open(SHELL_CACHE).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (res.ok && new URL(req.url).pathname.indexOf('/assets/') === 0) cache.put(req, res.clone())
        return res
      })
    }),
  )
}

self.addEventListener('fetch', (event) => {
  if (DEV) return
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Product photos hosted in Supabase Storage: show instantly, refresh quietly, work offline.
  if (url.pathname.indexOf('/storage/v1/object/public/') !== -1) {
    event.respondWith(staleWhileRevalidate(IMG_CACHE, req, MAX_IMAGES))
    return
  }

  // Never intercept the API, auth or realtime traffic — the sync engine handles failures itself.
  if (url.hostname.slice(-12) === 'supabase.co' || url.pathname.indexOf('/api/') === 0) return

  if (req.mode === 'navigate') {
    event.respondWith(appShell(req))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(precached(req))
    return
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(FONT_CACHE, req, 40))
  }
})
