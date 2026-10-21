// Generates the app icon, adaptive icon, splash, favicon and notification icon (no dependencies).
// Logo: a white "pocket" (rounded card with a flap) holding a gold coin, on PocketBank blue.
// Run: node scripts/generate-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE_TOP = [25, 118, 210];
const BLUE_BOTTOM = [13, 71, 161];
const WHITE = [255, 255, 255];
const GOLD = [245, 179, 1];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Signed distance helpers in unit space (0..1).
const roundedRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

/** Colour of the logo at unit coordinate (x, y), or null for transparent. */
function logo(x, y, { background, mono }) {
  // Coin peeking out of the pocket, then the pocket body and its flap line.
  const coin = circle(x, y, 0.5, 0.36, 0.13);
  const pocket = roundedRect(x, y, 0.5, 0.58, 0.27, 0.17, 0.07);
  const flap = Math.abs(y - 0.5) < 0.012 && Math.abs(x - 0.5) < 0.2;
  const slot = roundedRect(x, y, 0.5, 0.62, 0.07, 0.025, 0.02);
  if (pocket < 0) {
    if (flap || slot < 0) return mono ? null : BLUE_BOTTOM;
    return WHITE;
  }
  if (coin < 0) return mono ? WHITE : GOLD;
  if (background) return BLUE_TOP.map((c, i) => Math.round(c + (BLUE_BOTTOM[i] - c) * y));
  return null;
}

function render(size, { background = true, mono = false, scale = 1, canvasColor = null } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          // Scale the logo about the centre (splash/adaptive icons need padding).
          const ux = ((px + (sx + 0.5) / ss) / size - 0.5) / scale + 0.5;
          const uy = ((py + (sy + 0.5) / ss) / size - 0.5) / scale + 0.5;
          const c = logo(ux, uy, { background: background && !canvasColor, mono }) ?? canvasColor;
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = ss * ss;
      const i = (py * size + px) * 4;
      const cover = a / 255;
      out[i] = cover ? Math.round(r / cover) : 0;
      out[i + 1] = cover ? Math.round(g / cover) : 0;
      out[i + 2] = cover ? Math.round(b / cover) : 0;
      out[i + 3] = Math.round(a / n);
    }
  }
  return png(size, size, out);
}

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', render(1024));
writeFileSync('assets/adaptive-icon.png', render(1024, { background: false, scale: 0.7 }));
writeFileSync('assets/splash-icon.png', render(512, { background: false }));
writeFileSync('assets/favicon.png', render(64));
writeFileSync('assets/notification-icon.png', render(96, { background: false, mono: true }));
console.log('assets written: icon, adaptive-icon, splash-icon, favicon, notification-icon');
