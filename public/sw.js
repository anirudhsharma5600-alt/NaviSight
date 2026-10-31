const CACHE_NAME = 'naviable-ai-v1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon.svg'
]

// Install: precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Skip model files (too large to cache)
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/models/')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
