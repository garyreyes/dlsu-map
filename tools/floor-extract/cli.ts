// Photo of one floor's evacuation map → a draft floor (D17). Dev-only; never shipped. Run from the repo root:
//   npm run floor-extract -- crop <photo> <x,y> [<x,y> …]          zoomed, gridded crops to read the 4 corners
//   npm run floor-extract -- extract <photo> <tl> <tr> <br> <bl> [--style green-sign|white-map]
//                                       straighten, split colours, find walls and route (style detected if not given)
// Photos are DLSU's (data-src/photos/, gitignored); everything written goes to tools/floor-extract/out/ (gitignored).
// The rules live in the other files of this folder (pure, tested); this file only reads, writes and prints.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { STYLES, classify, detectStyle, type Style } from './colours.ts';
import { checkCorners, parsePoint } from './corners.ts';
import type { Point, Rgb } from './image.ts';
import { cropGridSvg, overlaySvg, preview3dSvg } from './preview.ts';
import { extractSegments, normalise } from './segments.ts';
import { warpPlan } from './warp.ts';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
/** Padding around the straightened plan, px: keeps the outer wall inside the image. */
const PAD = 40;
/** The spike's numbers (STRC 4F at 4032×3024 and 2F at 2048×1536 both read well with them); the gap is per style. */
const OPTIONS = { wallMin: 45, routeMin: 60, maxThickness: 40 };
const CROP = { size: 400, scale: 2, step: 25 };

async function load(photo: string): Promise<Rgb> {
  const { data, info } = await sharp(photo).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

const png = (img: Rgb, file: string) =>
  sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 3 } })
    .png()
    .toFile(file);

/** tools/floor-extract/out/<photo name>/, as a plain path (names with # or % stay intact, unlike URLs). */
function outDir(photo: string): string {
  const dir = join(OUT, basename(photo).replace(/.[^.]+$/, ''));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function points(args: readonly string[]): Point[] {
  return args.map((a) => {
    const p = parsePoint(a);
    if (!p) throw new Error(`"${a}" is not a point like 1234,567`);
    return p;
  });
}

async function crop(photo: string, rough: readonly Point[]): Promise<void> {
  const img = await load(photo);
  const dir = outDir(photo);
  for (const [n, [x, y]] of rough.entries()) {
    const left = Math.max(0, Math.min(img.width - CROP.size, Math.round(x - CROP.size / 2)));
    const top = Math.max(0, Math.min(img.height - CROP.size, Math.round(y - CROP.size / 2)));
    const grid = cropGridSvg(CROP.size, CROP.scale, left, top, CROP.step);
    const file = join(dir, `crop-${String(n + 1)}.png`);
    await sharp(photo)
      .rotate()
      .extract({ left, top, width: CROP.size, height: CROP.size })
      .resize(CROP.size * CROP.scale)
      .composite([{ input: Buffer.from(grid) }])
      .png()
      .toFile(file);
    console.log(`  ${file}: around (${String(x)}, ${String(y)}), grid lines labelled in photo pixels`);
  }
}

async function extract(photo: string, cornerArgs: readonly Point[], forced?: Style): Promise<void> {
  const started = Date.now();
  const img = await load(photo);
  const checked = checkCorners(cornerArgs, img);
  if ('error' in checked) throw new Error(checked.error);
  const { image, width, height } = warpPlan(img, checked.corners, PAD);
  const style = forced ?? detectStyle(image);
  const { dark, route } = classify(image, style);
  const found = extractSegments(dark, route, { ...OPTIONS, maxGap: STYLES[style].maxGap });
  const dir = outDir(photo);
  const straight = join(dir, '1-straightened.png');
  await png(image, straight);
  await sharp(straight)
    .composite([{ input: Buffer.from(overlaySvg(image.width, image.height, found.walls, found.route)) }])
    .png()
    .toFile(join(dir, '2-overlay.png'));
  await sharp(Buffer.from(preview3dSvg(image.width, image.height, PAD, found.walls, found.route)))
    .png()
    .toFile(join(dir, '3-preview-3d.png'));
  const norm = (s: (typeof found.walls)[number]) => normalise(s, PAD, width, height);
  const draft = {
    photo: basename(photo),
    corners: checked.corners,
    plan: { width, height },
    style,
    walls: found.walls.map(norm),
    route: found.route.map(norm),
  };
  writeFileSync(join(dir, 'draft.json'), `${JSON.stringify(draft, null, 1)}\n`);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `${basename(photo)}: plan ${String(width)}×${String(height)} px, ${style}${forced ? ' (given)' : ' (detected)'}`,
  );
  console.log(
    `  ${String(found.walls.length)} walls, ${String(found.route.length)} route segments in ${seconds} s → ${dir}`,
  );
}

const USAGE = 'usage: floor-extract crop <photo> <x,y>… | extract <photo> <tl> <tr> <br> <bl> [--style <style>]';

function styleFlag(args: string[]): Style | undefined {
  const at = args.indexOf('--style');
  if (at < 0) return undefined;
  const [value] = args.splice(at, 2).slice(1);
  if (value === 'green-sign' || value === 'white-map') return value;
  throw new Error(`--style must be green-sign or white-map, not "${value ?? ''}"`);
}

async function main(): Promise<void> {
  const [command, photo, ...rest] = process.argv.slice(2);
  const style = styleFlag(rest);
  if (command === 'crop' && photo && rest.length > 0) return crop(photo, points(rest));
  if (command === 'extract' && photo && rest.length === 4) return extract(photo, points(rest), style);
  throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(`floor-extract: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
