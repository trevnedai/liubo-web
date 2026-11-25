/*
 * Liubo on the web: keeps the game's files on the device after the first visit.
 *
 * GitHub Pages tells browsers to keep files for only 10 minutes, so without this a returning visitor's browser asked
 * for every file again, and the table waited behind "Setting the table…". With it:
 *   - the page and the game's code are kept from the first visit (the list below is written by the build);
 *   - the game's code (assets/, every file name carries its own fingerprint, so it never changes): used at once;
 *   - pictures and icons (art/, icons/): kept as they are used, shown at once, quietly refreshed for the next visit;
 *   - the page itself: always asked for fresh first (so a new version arrives at once), the kept copy only offline.
 * Each publish writes a new build name below, so the files of the old version are cleared when the new one starts.
 * Only this site's own files are touched; nothing is sent anywhere.
 *
 * To switch it off for everyone: publish a sw.js that only unregisters itself (see docs/WEB_APP.md).
 */
const CACHE = 'liubo-1.1.0-mww3ldek'
const FILES = ["./","assets/BoardClassic-BcRxELSe.js","assets/game-B6VoAgsR.js","assets/game-BafY4LHN.css","assets/index-CDjH04Vp.js","assets/lang-D-Oax-G3.js","assets/owl.worker-DEv4m2hG.js","assets/react-BFPXi17q.js","assets/react-three-fiber.esm-r4kULonP.js","assets/riddles-CUiajQPm.js"]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (!Array.isArray(FILES)) return
  // One file that cannot be fetched must not stop the rest: whatever is missing is kept later, when it is used.
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(FILES.map((file) => cache.add(file).catch(() => {})))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('liubo-') && key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

const keep = async (request, response) => {
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

/**
 * The page: fresh from the network, so a new version arrives at once. The kept copy is used when there is no
 * connection, when the server answers with an error, or when the connection is so slow that nothing has come after
 * four seconds (a phone holding on to one bar of signal would otherwise show a blank page for a long time).
 */
const page = async (request) => {
  const kept = (await caches.match(request, { ignoreSearch: true })) || (await caches.match('./'))
  const fresh = fetch(request).then((response) => (response.ok || !kept ? keep(request, response) : kept))
  if (!kept) return fresh
  const slow = new Promise((resolve) => setTimeout(() => resolve(kept), 4000))
  return Promise.race([fresh, slow]).catch(() => kept)
}

/** The game's code: fingerprinted file names never change, so a kept copy is always right. */
const code = async (request) => (await caches.match(request)) || keep(request, await fetch(request))

/** Pictures: the kept copy at once, a fresh one fetched for next time. */
const picture = (event) => {
  const fresh = fetch(event.request).then((response) => keep(event.request, response))
  event.waitUntil(fresh.catch(() => {}))
  return caches.match(event.request).then((kept) => kept || fresh)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.includes('/assets/')) event.respondWith(code(request))
  else if (/\/(art|icons)\//.test(url.pathname)) event.respondWith(picture(event))
})
