import type { MetadataRoute } from "next";

/* Installable as an app: Add to Home Screen on iPhone, Install on Android/desktop.
   Served outside the passcode gate (see middleware) — the browser fetches it
   without the cookie. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IronLog",
    short_name: "IronLog",
    description: "Strength training log with effective-rep tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
