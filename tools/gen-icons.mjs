/*
 * Erzeugt die App-Icons (kein externes Asset, kein CDN) — warmes Kochfreunde-
 * Motiv: Terracotta-Grund, cremefarbene Schüssel, Honig-Dampf. Rein prozedural
 * gezeichnet + als PNG (zlib) geschrieben. Lauf: node tools/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");
mkdirSync(OUT, { recursive: true });

function png(size, draw) {
  const W = size, H = size, raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = draw(x / W, y / H);
      const o = y * (1 + W * 4) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const crcTab = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTab[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function draw(u, v) {
  // Grund: warmer Terracotta-Verlauf
  const terra = [198, 93, 59], terraD = [150, 62, 36];
  let col = mix(terra, terraD, (u + v) / 2);
  const cx = 0.5, cy = 0.58, dx = u - cx, dy = v - cy, d = Math.sqrt(dx * dx + dy * dy);
  // Schüssel (cremefarbener Halbkreis)
  if (v > 0.5 && d < 0.34) col = [251, 245, 236];
  if (v > 0.5 && d < 0.34 && d > 0.30) col = [224, 164, 88]; // Rand honig
  // Suppe oben
  if (v > 0.48 && v < 0.56 && d < 0.30) col = [230, 150, 80];
  // Dampf
  const steam = Math.sin(u * 40) * 0.02;
  if (v < 0.42 && Math.abs(u - 0.42 - steam) < 0.025) col = mix(col, [251, 245, 236], 0.5);
  if (v < 0.42 && Math.abs(u - 0.58 + steam) < 0.025) col = mix(col, [251, 245, 236], 0.5);
  return [col[0], col[1], col[2], 255];
}

for (const s of [192, 512]) writeFileSync(join(OUT, `icon-${s}.png`), png(s, draw));
console.log("Icons geschrieben: icon-192.png, icon-512.png");
