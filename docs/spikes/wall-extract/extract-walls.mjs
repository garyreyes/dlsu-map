// THROWAWAY SPIKE (2026-10-19): can walls + the hallway line be pulled out of an evacuation-map PHOTO automatically?
// Not production code. Photos are DLSU's and gitignored (data-src/photos/); outputs go to ./out (gitignored).
// Run from this folder: node extract-walls.mjs <photo> <tlx,tly> <trx,try> <brx,bry> <blx,bly>
// The 4 points are the building's outer corners in the photo (a maintainer would click these in a real tool).
// RESULT (STRC 4F 4032x3024, STRC 2F 2048x1536 angled): ~4 s per floor. Hallway route line extracted cleanly on both.
// Most walls found; door gaps fall out of the drawing. Misses: some single-line walls (4F), walls break at pillars.
// False positives: stair treads read as walls, ACU-deck lines poke outside the building. Elevator box, room numbers
// and stairs are NOT identified; they need labelling. Fit onto the real OSM outline was NOT tested (no snapshot yet).
import cvModule from '@techstark/opencv-js';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const cv = cvModule.Mat
  ? cvModule
  : typeof cvModule.then === 'function'
    ? await new Promise((r) => cvModule.then((m) => r(m)))
    : await new Promise((r) => (cvModule.onRuntimeInitialized = () => r(cvModule)));

const [photo, ...cornerArgs] = process.argv.slice(2);
const corners = cornerArgs.map((s) => s.split(',').map(Number));
if (!photo || corners.length !== 4) throw new Error('usage: extract-walls.mjs <photo> tl tr br bl');

const OUT = `out/${basename(photo, '.jpg')}`;
mkdirSync(OUT, { recursive: true });
const PX_PER_PLAN = 1; // warped image keeps roughly the photo's own resolution

// ---------- load + straighten ----------
const { data, info } = await sharp(photo).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
const src = cv.matFromArray(info.height, info.width, cv.CV_8UC3, data);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const W = Math.round(Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2])) * PX_PER_PLAN);
const H = Math.round(Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2])) * PX_PER_PLAN);
const PAD = 40; // keep the outer wall inside the image
const M = cv.getPerspectiveTransform(
  cv.matFromArray(4, 1, cv.CV_32FC2, corners.flat()),
  cv.matFromArray(4, 1, cv.CV_32FC2, [PAD, PAD, W + PAD, PAD, W + PAD, H + PAD, PAD, H + PAD]),
);
const warped = new cv.Mat();
cv.warpPerspective(src, warped, M, new cv.Size(W + 2 * PAD, H + 2 * PAD), cv.INTER_LINEAR, cv.BORDER_REPLICATE);

// ---------- colour masks ----------
const hsv = new cv.Mat();
cv.cvtColor(warped, hsv, cv.COLOR_RGB2HSV);
const N = hsv.rows * hsv.cols;
const dark = new cv.Mat(hsv.rows, hsv.cols, cv.CV_8UC1);
const green = new cv.Mat(hsv.rows, hsv.cols, cv.CV_8UC1);
for (let i = 0; i < N; i++) {
  const h = hsv.data[i * 3], s = hsv.data[i * 3 + 1], v = hsv.data[i * 3 + 2];
  // Sampled on STRC 4F: walls V 20-55 (often tinted green by the photo), route V ~110 S ~250, background V ~208.
  const isGreenRoute = h >= 55 && h <= 90 && s >= 140 && v >= 85 && v <= 200;
  const isRed = (h <= 10 || h >= 165) && s >= 90;
  green.data[i] = isGreenRoute ? 255 : 0;
  dark.data[i] = v <= 75 && !isRed ? 255 : 0; // black-ish ink: walls, text, symbols
}

// ---------- keep only long straight runs (kills text, numbers, fire symbols) ----------
function longRuns(mask, len) {
  const out = new cv.Mat();
  const tmp = new cv.Mat();
  const kh = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(len, 1));
  const kv = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, len));
  cv.morphologyEx(mask, out, cv.MORPH_OPEN, kh);
  cv.morphologyEx(mask, tmp, cv.MORPH_OPEN, kv);
  return { h: out, v: tmp };
}

// Connected components of a run mask -> axis-aligned segments {x0,y0,x1,y1,t}
function segments(mask, horizontal) {
  const labels = new cv.Mat(), stats = new cv.Mat(), cents = new cv.Mat();
  const n = cv.connectedComponentsWithStats(mask, labels, stats, cents, 8, cv.CV_32S);
  const segs = [];
  for (let i = 1; i < n; i++) {
    const [x, y, w, h] = [0, 1, 2, 3].map((k) => stats.intAt(i, k));
    if (horizontal && w > 2 * h) segs.push({ x0: x, y0: y + h / 2, x1: x + w, y1: y + h / 2, t: h });
    if (!horizontal && h > 2 * w) segs.push({ x0: x + w / 2, y0: y, x1: x + w / 2, y1: y + h, t: w });
  }
  return segs;
}

// Evacuation maps draw each wall as TWO thin parallel lines. Merge close, overlapping parallels into one thick wall.
function mergeDoubleLines(segs, horizontal, maxGap = 24) {
  const key = horizontal ? (s) => s.y0 : (s) => s.x0;
  const span = horizontal ? (s) => [s.x0, s.x1] : (s) => [s.y0, s.y1];
  const sorted = [...segs].sort((a, b) => key(a) - key(b));
  const used = new Set(), out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const a = sorted[i];
    const [a0, a1] = span(a);
    for (let j = i + 1; j < sorted.length && key(sorted[j]) - key(a) <= maxGap; j++) {
      if (used.has(j)) continue;
      const b = sorted[j], [b0, b1] = span(b);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      if (overlap < 0.6 * Math.min(a1 - a0, b1 - b0)) continue;
      used.add(j);
      const mid = (key(a) + key(b)) / 2, t = key(b) - key(a) + (a.t + b.t) / 2;
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
      a.merged = horizontal ? { x0: lo, x1: hi, y0: mid, y1: mid, t } : { x0: mid, x1: mid, y0: lo, y1: hi, t };
      break;
    }
    out.push(a.merged ?? a);
  }
  return out;
}

const WALL_MIN = 45; // px: shorter than a wall stub, longer than any digit stroke
const walls = longRuns(dark, WALL_MIN);
const rawH = segments(walls.h, true).filter((s) => s.t <= 40);
const rawV = segments(walls.v, false).filter((s) => s.t <= 40);
const wallSegs = [...mergeDoubleLines(rawH, true), ...mergeDoubleLines(rawV, false)];
const route = longRuns(green, 60);
const routeSegs = [...segments(route.h, true), ...segments(route.v, false)];

// ---------- outputs ----------
const toPng = (mat, ch, file) =>
  sharp(Buffer.from(mat.data), { raw: { width: mat.cols, height: mat.rows, channels: ch } }).png().toFile(`${OUT}/${file}`);
await toPng(warped, 3, '1-straightened.png');

const Wi = warped.cols, Hi = warped.rows;
const line = (s, color, w) => `<line x1="${s.x0}" y1="${s.y0}" x2="${s.x1}" y2="${s.y1}" stroke="${color}" stroke-width="${w}"/>`;
const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wi}" height="${Hi}">
  <rect width="100%" height="100%" fill="white" opacity="0.55"/>
  ${wallSegs.map((s) => line(s, '#d00', Math.max(4, s.t))).join('')}
  ${routeSegs.map((s) => line(s, '#06f', 10)).join('')}</svg>`;
await sharp(`${OUT}/1-straightened.png`).composite([{ input: Buffer.from(overlay) }]).png().toFile(`${OUT}/2-overlay.png`);

// Plain 3D preview: rotate the plan, tilt it, extrude each wall to a fixed height (painter's order).
const S = 2400 / Wi, ANG = -0.5, TILT = 0.55, WALL_H = 70;
const proj = ([x, y, z]) => {
  const xr = x * Math.cos(ANG) - y * Math.sin(ANG), yr = x * Math.sin(ANG) + y * Math.cos(ANG);
  return [xr * S + 300, yr * S * TILT - z * S + 1400, yr];
};
const boxes = wallSegs.map((s) => {
  const ht = s.t / 2, hz = s.y0 === s.y1;
  const [x0, x1] = hz ? [s.x0, s.x1] : [s.x0 - ht, s.x0 + ht];
  const [y0, y1] = hz ? [s.y0 - ht, s.y0 + ht] : [s.y0, s.y1];
  return { x0, x1, y0, y1, depth: proj([(x0 + x1) / 2, (y0 + y1) / 2, 0])[2] };
}).sort((a, b) => a.depth - b.depth);
const poly = (pts, fill) => `<polygon points="${pts.map((p) => proj(p).slice(0, 2).join(',')).join(' ')}" fill="${fill}" stroke="#7a8794" stroke-width="0.6"/>`;
const faces = boxes.map(({ x0, x1, y0, y1 }) => {
  const Z = WALL_H;
  return [
    poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, Z], [x0, y1, Z]], '#c9d3dc'), // front
    poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, Z], [x1, y0, Z]], '#aab6c2'), // side
    poly([[x0, y0, Z], [x1, y0, Z], [x1, y1, Z], [x0, y1, Z]], '#f2f5f8'), // top
  ].join('');
});
const floorPoly = poly([[PAD, PAD, 0], [Wi - PAD, PAD, 0], [Wi - PAD, Hi - PAD, 0], [PAD, Hi - PAD, 0]], '#e8e2d6');
const routeLines = routeSegs.map((s) => {
  const a = proj([s.x0, s.y0, 2]), b = proj([s.x1, s.y1, 2]);
  return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#0a7a3a" stroke-width="6" stroke-linecap="round"/>`;
});
const iso = `<svg xmlns="http://www.w3.org/2000/svg" width="2800" height="1700"><rect width="100%" height="100%" fill="#fff"/>
  ${floorPoly}${routeLines.join('')}${faces.join('')}</svg>`;
await sharp(Buffer.from(iso)).png().toFile(`${OUT}/3-preview-3d.png`);

// Normalised plan coordinates (0..1 across the building), the shape a real pipeline would fit onto the OSM outline.
const norm = (s) => ({ x0: (s.x0 - PAD) / W, y0: (s.y0 - PAD) / H, x1: (s.x1 - PAD) / W, y1: (s.y1 - PAD) / H });
writeFileSync(`${OUT}/floor.json`, JSON.stringify({ photo: basename(photo), walls: wallSegs.map(norm), hallwayRoute: routeSegs.map(norm) }, null, 1));
console.log(`${basename(photo)}: ${wallSegs.length} wall segments, ${routeSegs.length} route segments -> ${OUT}/`);
