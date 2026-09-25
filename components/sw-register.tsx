"use client";

import { useEffect } from "react";

/* Registers public/sw.js in production only — in dev it would outlive the
   server and serve the offline page over every restart. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
