// Draws the app icon (an orange barbell on near-black) and writes every size the
// PWA needs. Run once with `node scripts/make-icons.mjs`; the PNGs are committed.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const BG = "#0b0b0c", ACCENT = "#ff6a1f";

// `pad` shrinks the drawing toward the centre: maskable icons get cropped to a
// circle or squircle by Android, so the barbell has to sit inside the middle 80%.
function svg(pad = 1, rounded = false) {
  const s = 512, c = s / 2;
  const g = (x) => c + (x - c) * pad;
  const rect = (x, y, w, h, r) =>
    `<rect x="${g(x)}" y="${g(y)}" width="${w * pad}" height="${h * pad}" rx="${r * pad}" fill="${ACCENT}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs><radialGradient id="glow" cx="50%" cy="0%" r="90%">
    <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="${BG}"/>
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="url(#glow)"/>
  ${rect(96, 244, 320, 24, 6)}
  ${rect(136, 156, 44, 200, 12)}
  ${rect(332, 156, 44, 200, 12)}
  ${rect(96, 188, 30, 136, 10)}
  ${rect(386, 188, 30, 136, 10)}
  ${rect(62, 236, 30, 40, 6)}
  ${rect(420, 236, 30, 40, 6)}
</svg>`;
}

const png = (src, size, out) => sharp(Buffer.from(src)).resize(size, size).png().toFile(out);

await png(svg(), 192, "public/icons/icon-192.png");
await png(svg(), 512, "public/icons/icon-512.png");
await png(svg(0.78), 512, "public/icons/maskable-512.png");
await png(svg(), 180, "app/apple-icon.png"); // iOS rounds the corners itself
writeFileSync("app/icon.svg", svg(1, true)); // browser tab
console.log("icons written");
