/* IronLog service worker.

   It caches the app shell — Next's content-hashed JS, CSS and fonts under
   /_next/static, plus the icons — so a launch does not wait on the network for
   any of it. It still caches no pages and no data: every screen is live
   training data, and a stale cached copy of a workout would be worse than none.
   (The home screen's instant program card comes from localStorage, not from
   here — see components/cached-home.tsx.) A dropped signal in the gym gets a
   plain "offline" screen instead of the browser's error page. */
const CACHE = "ironlog-shell-v1";
// Old builds' hashed files pile up across deploys; the oldest go past this.
const MAX_ENTRIES = 300;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>IronLog — offline</title>
<style>html,body{margin:0;height:100%;background:#0b0b0c;color:#eee;font:16px system-ui,sans-serif}
main{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center}
h1{margin:0;font-size:22px;color:#ff6a1f;letter-spacing:.02em}p{margin:0;color:#999;max-width:280px}
button{margin-top:8px;padding:12px 24px;border:0;border-radius:999px;background:#ff6a1f;color:#111;font:600 16px system-ui}</style>
</head><body><main><h1>No connection</h1><p>IronLog needs the internet to load. Anything already logged is saved.</p>
<button onclick="location.reload()">Try again</button></main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

/* Only files whose URL changes when their content does. Anything under
   /_next/static is hashed by the build; the icons are redrawn by hand, rarely,
   and at worst show the old barbell until the cache is pruned. */
function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return url.pathname.startsWith("/_next/static/")
    || url.pathname.startsWith("/icons/")
    || url.pathname === "/icon.svg"
    || url.pathname === "/apple-icon.png";
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    trim(cache);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }

  if (isShellAsset(new URL(request.url))) event.respondWith(cacheFirst(request));
});
