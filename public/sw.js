/* IronLog service worker. Deliberately caches no pages or data: every screen is
   live training data, and a stale cached copy of a workout would be worse than
   none. It exists so the app installs, and so a dropped signal in the gym shows
   a plain "offline" screen instead of the browser's error page. */
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
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
