// Riviera Capture service worker.
//
// Two jobs:
//   1. Cache the app shell (HTML + manifest + icons) so the app boots offline.
//   2. Background Sync: when the app posts a 'drain' message, trigger a sync;
//      when the browser fires the sync, the page wakes up and drains its IDB queue.
//      (The actual drain logic lives in the page — the SW just nudges it.)
//
// We deliberately do NOT cache POSTs to the edge function — those must always
// hit the network. We let them fail naturally when offline and the page handles
// queueing locally.

const CACHE = "riviera-capture-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  
  
  
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never cache writes — let them go to the network and fail when offline.
  if (e.request.method !== "GET") return;

  // Never intercept calls to the edge function or Storage uploads.
  if (url.hostname.endsWith("supabase.co")) return;

  // App shell: cache-first.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Opportunistically cache same-origin GETs
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

// Background Sync: tells clients (open pages) to drain their queue.
self.addEventListener("sync", (e) => {
  if (e.tag === "drain-queue") {
    e.waitUntil(notifyClientsDrain());
  }
});

async function notifyClientsDrain() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((c) => c.postMessage({ type: "drain" }));
}
