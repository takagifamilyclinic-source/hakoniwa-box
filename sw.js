// ネットにつながるときは最新を取り、つながらないときは前回のものを使う
const CACHE = "hakoniwa-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(
    fetch(e.request.url, { cache: "no-store" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request.mode === "navigate" ? "./" : e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request.mode === "navigate" ? "./" : e.request).then((hit) => hit || caches.match("./")),
      ),
  );
});
