// Photo of one floor's evacuation map → a draft floor (D17). Dev-only; never shipped. Run from the repo root:
//   npm run floor-extract -- crop <photo> <x,y> [<x,y> …]          zoomed, gridded crops to read the 4 corners
//   npm run floor-extract -- extract <photo> <tl> <tr> <br> <bl> [--style green-sign|white-map]
//                                       [--dark <ratio>] [--red-sat <S>]
//                                       straighten, split colours, find walls and route (style detected if not given;
//                                       --dark and --red-sat only for a washed-out photo, see colours.ts Tuning)
//   npm run floor-extract -- floor <photo>   the draft → a first data-src/floors/<building>/<NN>.json (D36);
//                                       never overwrites one, since it holds cleanup work
//   npm run floor-extract -- review <floor.json> [--tiles N]   walls numbered over the photo, grid in plan px
//   npm run floor-extract -- edit <floor.json> <spec.json>     apply a cleanup: delete walls, add walls, hallways
//   npm run floor-extract -- shots <building>                  P1 screenshots of every floor (shots.ts)
// Photos are DLSU's (data-src/photos/, gitignored); `crop` and `extract` write to tools/floor-extract/out/
// (gitignored), as do `review` and `shots`; `floor` and `edit` write the floor file, which is committed (D21).
// The rules live in the other files of this folder (pure, tested); this file only reads, writes and prints.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { floorSourceSchema, type FloorSource } from '../../src/shared/data/floor-source.ts';
import { STYLES, classify, detectStyle, type Style, type Tuning } from './colours.ts';
import { checkCorners, parsePoint } from './corners.ts';
import { applyEdit, parseEditSpec } from './edit.ts';
import { floorFile, formatFloorFile, type Draft } from './floor-file.ts';
import type { Point, Rgb } from './image.ts';
import { cropGridSvg, overlaySvg, preview3dSvg, reviewSvg } from './preview.ts';
import { extractSegments, normalise } from './segments.ts';
import { warpPlan } from './warp.ts';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
const FLOORS = fileURLToPath(new URL('../../data-src/floors/', import.meta.url));
/** Padding around the straightened plan, px: keeps the outer wall inside the image. */
const PAD = 40;
/** The spike's numbers (STRC 4F at 4032×3024 and 2F at 2048×1536 both read well with them); the gap is per style. */
const OPTIONS = { wallMin: 45, routeMin: 60, maxThickness: 40 };
const CROP = { size: 400, scale: 2, step: 25 };
/** `review` tiles overlap by this much, px, so a wall number on a tile's edge shows whole on one of them. */
const OVERLAP = 80;

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

async function extract(
  photo: string,
  cornerArgs: readonly Point[],
  forced?: Style,
  tuning: Tuning = {},
): Promise<void> {
  const started = Date.now();
  const img = await load(photo);
  const checked = checkCorners(cornerArgs, img);
  if ('error' in checked) throw new Error(checked.error);
  const { image, width, height } = warpPlan(img, checked.corners, PAD);
  const style = forced ?? detectStyle(image);
  const { dark, route } = classify(image, style, tuning);
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
    `${basename(photo)}: plan ${String(width)}×${String(height)} px, ${style}${forced ? ' (given)' : ' (detected)'}` +
      (Object.keys(tuning).length > 0 ? `, tuned ${JSON.stringify(tuning)}` : ''),
  );
  console.log(
    `  ${String(found.walls.length)} walls, ${String(found.route.length)} route segments in ${seconds} s → ${dir}`,
  );
}

async function floor(photo: string): Promise<void> {
  const draftPath = join(outDir(photo), 'draft.json');
  if (!existsSync(draftPath)) throw new Error(`no ${draftPath}; run extract first`);
  const file = floorFile(JSON.parse(readFileSync(draftPath, 'utf8')) as Draft);
  if (!file) throw new Error(`${basename(photo)} is not named <building>_<NN>F, so its floor is unknown`);
  const dir = join(FLOORS, file.building);
  const target = join(dir, `${String(file.floor).padStart(2, '0')}.json`);
  if (existsSync(target)) throw new Error(`${target} exists and may hold cleanup; delete it first to start over`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, formatFloorFile(file));
  console.log(`${basename(photo)} → ${target}: ${String(file.walls.length)} walls, turn 0 (set fit.turn by hand)`);
  return Promise.resolve();
}

function readFloor(path: string): FloorSource {
  const parsed = floorSourceSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) throw new Error(`${path} is not a floor file: ${parsed.error.issues[0]?.message ?? ''}`);
  return parsed.data;
}

async function review(path: string, tiles: number): Promise<void> {
  const floor = readFloor(path);
  const dir = outDir(floor.extractedFrom);
  const straight = join(dir, '1-straightened.png');
  if (!existsSync(straight)) throw new Error(`no ${straight}; run extract on ${floor.extractedFrom} first`);
  const { width, height } = await sharp(straight).metadata();
  const [w, h] = [floor.plan.width + 2 * PAD, floor.plan.height + 2 * PAD];
  if (width !== w || height !== h) {
    throw new Error(
      `${straight} is ${String(width)}×${String(height)}, not ${String(w)}×${String(h)}: re-run extract with the same corners`,
    );
  }
  const full = await sharp(straight)
    .composite([{ input: Buffer.from(reviewSvg(floor, { width, height }, PAD)) }])
    .png()
    .toBuffer();
  const step = Math.ceil(width / tiles);
  for (let t = 0; t < tiles; t++) {
    const left = Math.max(0, t * step - OVERLAP);
    const file = join(dir, `review-${String(t + 1)}.png`);
    await sharp(full)
      .extract({ left, top: 0, width: Math.min(width - left, step + 2 * OVERLAP), height })
      .toFile(file);
    console.log(`  ${file}`);
  }
  console.log(
    `${path}: ${String(floor.walls.length)} walls (0–${String(floor.walls.length - 1)}), ${String(floor.hallways.length)} hallways, plan ${String(floor.plan.width)}×${String(floor.plan.height)} px`,
  );
}

function edit(path: string, specPath: string): Promise<void> {
  const floor = readFloor(path);
  const result = applyEdit(floor, parseEditSpec(JSON.parse(readFileSync(specPath, 'utf8'))));
  writeFileSync(path, formatFloorFile(result.file));
  const counts = `−${String(result.removed)}, +${String(result.added)}`;
  const { rooms, verticals } = result.file;
  const labels = `${String(rooms?.length ?? 0)} rooms, ${String(verticals?.length ?? 0)} stairs and elevators`;
  console.log(
    `${path}: ${String(floor.walls.length)} → ${String(result.file.walls.length)} walls (${counts}); ${labels}`,
  );
  if (result.unchecked) console.log('  it was checked: now checked: false, so the owner looks again in P1');
  if (result.removed > 0) console.log('  wall numbers have changed: run review again before the next spec');
  return Promise.resolve();
}

const USAGE =
  'usage: floor-extract crop <photo> <x,y>… | extract <photo> <tl> <tr> <br> <bl> [--style <style>] [--dark <ratio>]' +
  ' [--red-sat <S>] | floor <photo>' +
  ' | review <floor.json> [--tiles N] | edit <floor.json> <spec.json> | shots <building>';

function tilesFlag(args: string[]): number {
  const at = args.indexOf('--tiles');
  if (at < 0) return 4;
  const [value] = args.splice(at, 2).slice(1);
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  throw new Error(`--tiles must be a whole number from 1 to 12, not "${value ?? ''}"`);
}

/** A number flag within [min, max], removed from args; undefined when not given. */
function numberFlag(args: string[], name: string, min: number, max: number): number | undefined {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const [value] = args.splice(at, 2).slice(1);
  const n = Number(value);
  if (value !== undefined && value !== '' && n >= min && n <= max) return n;
  throw new Error(`${name} must be a number from ${String(min)} to ${String(max)}, not "${value ?? ''}"`);
}

function tuningFlags(args: string[]): Tuning {
  const darkRatio = numberFlag(args, '--dark', 0.3, 0.95);
  const redSat = numberFlag(args, '--red-sat', 20, 120);
  return { ...(darkRatio !== undefined && { darkRatio }), ...(redSat !== undefined && { redSat }) };
}

function styleFlag(args: string[]): Style | undefined {
  const at = args.indexOf('--style');
  if (at < 0) return undefined;
  const [value] = args.splice(at, 2).slice(1);
  if (value === 'green-sign' || value === 'white-map') return value;
  throw new Error(`--style must be green-sign or white-map, not "${value ?? ''}"`);
}

async function main(): Promise<void> {
  const [command, subject, ...rest] = process.argv.slice(2);
  const style = styleFlag(rest);
  const tiles = tilesFlag(rest);
  const tuning = tuningFlags(rest);
  if (command === 'crop' && subject && rest.length > 0) return crop(subject, points(rest));
  if (command === 'extract' && subject && rest.length === 4) return extract(subject, points(rest), style, tuning);
  if (command === 'floor' && subject && rest.length === 0) return floor(subject);
  if (command === 'review' && subject && rest.length === 0) return review(subject, tiles);
  if (command === 'edit' && subject && rest.length === 1 && rest[0]) return edit(subject, rest[0]);
  if (command === 'shots' && subject && rest.length === 0) return (await import('./shots.ts')).shots(subject);
  throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(`floor-extract: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
