// Self-destruct service worker.
//
// Earlier versions of this SW aggressively cached the app shell. On iOS that
// trapped installed PWAs on stale HTML — bumping CACHE versions wasn't enough
// because the old SW is the one deciding whether to fetch the new one, and
// iOS's grip on registrations is sticky. This version exists only to:
//   1. Take over from the old SW (skipWaiting)
//   2. Delete every cache
//   3. Unregister itself
//   4. Force every open client to reload, so they pick up fresh HTML directly
//      from the network on next launch.
//
// The page itself no longer registers a service worker — IndexedDB still
// gives us offline-write resilience for captured photos.
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_e) {}
    try { await self.registration.unregister(); } catch (_e) {}
    try {
      const cs = await self.clients.matchAll({ type: "window" });
      cs.forEach((c) => { try { c.navigate(c.url); } catch (_e) {} });
    } catch (_e) {}
  })());
});
self.addEventListener("fetch", () => { /* passthrough — no caching */ });
