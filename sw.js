/*
 * Liubo on the web: keeps the game's files on the device after the first visit.
 *
 * GitHub Pages tells browsers to keep files for only 10 minutes, so without this a returning visitor's browser asked
 * for every file again, and the table waited behind "Setting the table…". With it:
 *   - the page and the game's code are kept from the first visit (the list below is written by the build);
 *   - the game's code (assets/, every file name carries its own fingerprint, so it never changes): used at once;
 *   - pictures and icons (art/, icons/): kept as they are used and then used at once, without asking the site again;
 *   - the page itself: always asked for fresh first (so a new version arrives at once), the kept copy only offline.
 * Each publish writes a new build name below, so the files of the old version are cleared when the new one starts.
 * What has not changed is carried over instead of downloaded again (26 Nov 2026): code files with the same
 * fingerprinted name, and pictures the site still serves unchanged (same ETag, asked with a small HEAD request).
 * Only this site's own files are touched; nothing is sent anywhere.
 *
 * To switch it off for everyone: publish a sw.js that only unregisters itself (see docs/WEB_APP.md).
 */
const CACHE = 'liubo-1.1.0-mwwpy7yu'
const FILES = ["./","assets/BoardClassic-C5gt05OO.js","assets/game-Crsu0qEs.js","assets/game-F-K48u_b.css","assets/index-EvYhVrhQ.js","assets/lang-D-Oax-G3.js","assets/owl.worker-DEv4m2hG.js","assets/react-BFPXi17q.js","assets/react-three-fiber.esm-r4kULonP.js","assets/riddles-CUiajQPm.js"]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (!Array.isArray(FILES)) return
  // One file that cannot be fetched must not stop the rest: whatever is missing is kept later, when it is used.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await Promise.all(
        FILES.map(async (file) => {
          try {
            // A code file an older version already kept is the very same file (its name carries its fingerprint).
            const old = file.startsWith('assets/') ? await caches.match(file) : undefined
            if (old) await cache.put(file, old)
            else await cache.add(file)
          } catch {
            /* kept later, when it is used */
          }
        }),
      )
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      for (const key of await caches.keys()) {
        if (!key.startsWith('liubo-') || key === CACHE) continue
        await carry(await caches.open(key), cache).catch(() => {})
        await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

/** Pictures of the old version that the site still serves unchanged move to the new store, so an update does not download them again. */
const carry = async (old, cache) => {
  const pictures = (await old.keys()).filter((request) => /\/(art|icons)\//.test(new URL(request.url).pathname))
  await Promise.all(
    pictures.map(async (request) => {
      try {
        const kept = await old.match(request)
        const tag = kept && kept.headers.get('etag')
        if (!tag || (await cache.match(request))) return
        const head = await fetch(request.url, { method: 'HEAD', cache: 'no-store' })
        if (head.ok && head.headers.get('etag') === tag) await cache.put(request, kept)
      } catch {
        /* fetched again when it is used */
      }
    }),
  )
}

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

/**
 * Pictures: the kept copy, without asking the site again (until 25 Nov 2026 every picture was downloaded again in the
 * background on every visit, about 1.8 MB for nothing). A changed picture arrives with the next publish: see `carry`.
 */
const picture = async (request) => (await caches.match(request)) || keep(request, await fetch(request))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.includes('/assets/')) event.respondWith(code(request))
  else if (/\/(art|icons)\//.test(url.pathname)) event.respondWith(picture(request))
})
