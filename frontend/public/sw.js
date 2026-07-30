// WellnessQuest service worker.
// - precaches app shell
// - network-first for /api/v1/** GETs with stale fallback
// - offline IndexedDB queue for POST /api/v1/water, drained on background sync

const SHELL_CACHE = "wq-shell-v2";
const API_CACHE = "wq-api-v1";
const SHELL_URLS = ["/", "/dashboard", "/water", "/login", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== API_CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

const API_PREFIX = "/api/v1/";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith(API_PREFIX)) {
    if (req.method === "GET") {
      event.respondWith(networkFirst(req));
      return;
    }
    if (req.method === "POST" && url.pathname === API_PREFIX + "water") {
      event.respondWith(offlineQueueablePost(req));
      return;
    }
    return; // default network for everything else
  }

  if (req.method === "GET" && req.mode === "navigate") {
    // Next ships each page with a sibling `.txt` RSC payload. If the app was
    // rebuilt under an open tab, the App Router gives up on the client-side
    // transition and does a full browser navigation to that `.txt` URL, which
    // renders as a wall of raw flight payload. Send those back to the page.
    if (url.pathname.endsWith(".txt")) {
      event.respondWith(Response.redirect(htmlPathForRsc(url.pathname) + url.search, 302));
      return;
    }
    event.respondWith(networkFirst(req, SHELL_CACHE));
  }
});

// "/period/index.txt" -> "/period/", "/period.txt" -> "/period"
function htmlPathForRsc(pathname) {
  if (pathname.endsWith("/index.txt")) return pathname.slice(0, -"index.txt".length);
  return pathname.slice(0, -".txt".length) || "/";
}

async function networkFirst(req, cacheName = API_CACHE) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function offlineQueueablePost(req) {
  try {
    return await fetch(req.clone());
  } catch (_err) {
    const body = await req.clone().json().catch(() => null);
    if (!body) throw _err;
    if (!body.client_id) body.client_id = crypto.randomUUID();
    await enqueue({ url: req.url, body, headers: serialiseHeaders(req.headers) });
    if ("sync" in self.registration) {
      try {
        await self.registration.sync.register("wq-water-sync");
      } catch (_e) {}
    }
    return new Response(
      JSON.stringify({
        queued: true,
        entry: { id: -1, ml: body.ml, source: "pwa", occurred_at: new Date().toISOString(), client_id: body.client_id },
        total_ml: 0,
        goal_ml: 0,
        xp_delta: 0,
        goal_met: false,
      }),
      { status: 202, headers: { "Content-Type": "application/json", "x-wq-queued": "1" } },
    );
  }
}

function serialiseHeaders(h) {
  const out = {};
  for (const [k, v] of h.entries()) out[k] = v;
  return out;
}

// --- IndexedDB queue
const DB_NAME = "wq";
const STORE = "queue";

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function enqueue(item) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ...item, ts: Date.now() });
    tx.oncomplete = () => res(undefined);
    tx.onerror = () => rej(tx.error);
  });
}

async function drainQueue() {
  const db = await openDb();
  const items = await new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  for (const item of items) {
    try {
      const resp = await fetch(item.url, {
        method: "POST",
        headers: item.headers,
        body: JSON.stringify(item.body),
      });
      if (resp.ok || resp.status === 409) {
        await deleteItem(db, item.id);
      }
    } catch (_e) {
      break; // still offline; let next sync try
    }
  }
}

function deleteItem(db, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res(undefined);
    tx.onerror = () => rej(tx.error);
  });
}

self.addEventListener("sync", (event) => {
  if (event.tag === "wq-water-sync") {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "wq-drain") event.waitUntil(drainQueue());
});
