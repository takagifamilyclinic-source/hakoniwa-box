// 2回目からは、手元のページをすぐ開く。版が変わったときだけ新しいページを取りに行く
// ネットにつながらないときも、手元のページで遊べる
const CACHE = "hakoniwa-v3";
const PAGE = "./";
const STAMP = "./__build"; // 手元のページの版
const WAIT_MS = 2500; // 版の確認をこれ以上は待たない

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(tidy().then(() => self.clients.claim())),
);
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // 版の確認はいつもネットへ聞く。手元にためない
  if (url.pathname.endsWith("version.txt")) return;
  e.respondWith(e.request.mode === "navigate" ? page(e) : asset(e.request));
});

// 前の作りでたまっていた、版の確認の記録を消す
async function tidy() {
  const cache = await caches.open(CACHE);
  for (const key of await cache.keys()) {
    if (key.url.includes("version.txt")) await cache.delete(key);
  }
}

async function remoteVersion() {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), WAIT_MS);
  try {
    const res = await fetch("version.txt?t=" + Date.now(), {
      cache: "no-store",
      signal: stop.signal,
    });
    return res.ok ? (await res.text()).trim() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// ページ自身に書いてある版。配信が遅れて古いページが来たときに、新しい版と取り違えないため
async function buildOf(res) {
  const m = (await res.text()).match(/<meta name="build" content="([0-9]+)"/);
  return m ? m[1] : "";
}

async function page(e) {
  const cache = await caches.open(CACHE);
  const [kept, stamp, remote] = await Promise.all([
    cache.match(PAGE),
    cache.match(STAMP).then((r) => (r ? r.text() : "")),
    remoteVersion(),
  ]);
  if (kept && (!remote || remote === stamp)) return kept;
  try {
    const res = await fetch("./?v=" + (remote || Date.now()), {
      cache: "no-store",
    });
    if (!res.ok) return kept || res;
    const forStamp = res.clone();
    const forCache = res.clone();
    e.waitUntil(
      buildOf(forStamp).then(async (build) => {
        await cache.put(PAGE, forCache);
        await cache.put(STAMP, new Response(build));
      }),
    );
    return res;
  } catch (err) {
    if (kept) return kept;
    throw err;
  }
}

// アイコンなどの小さいファイル。ネットを先に見て、だめなら手元のもの
async function asset(request) {
  try {
    const res = await fetch(request.url, { cache: "no-store" });
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}
