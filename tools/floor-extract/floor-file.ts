// A draft (what `extract` writes) → a first floor file for data-src/floors/ (D36). Cleanup starts from it, so it only
// renames and trims: the walls and route are the draft's, in the same sign coordinates. Tests: floor-file.test.ts.
import type { FloorSource } from '../../src/shared/data/floor-source.ts';
import type { Segment } from './image.ts';

/** The parts of draft.json a floor file needs. */
export interface Draft {
  readonly photo: string;
  readonly plan: { readonly width: number; readonly height: number };
  readonly walls: readonly Segment[];
  readonly route: readonly Segment[];
}

/** `strc_03F.jpg` → strc, floor 3. Photo names follow data-src/photos/: `<slug>_<NN>F.<ext>`. */
export function floorOfPhoto(photo: string): { building: string; floor: number } | null {
  const match = /^([a-z0-9-]+)_(\d{2})F\.[a-z]+$/i.exec(photo);
  if (!match?.[1] || !match[2]) return null;
  const floor = Number(match[2]);
  return floor >= 1 ? { building: match[1].toLowerCase(), floor } : null;
}

/** Four decimals is 0.1 mm on a 100 m building; kept inside the schema's 0.1 margin past the sign's edge. */
const tidy = (n: number) => Math.round(Math.min(1.1, Math.max(-0.1, n)) * 10_000) / 10_000 + 0;
const line = (s: Segment): number[] => [s.x0, s.y0, s.x1, s.y1].map(tidy);

/** The first floor file for a draft: unchecked, turn 0 until Claude sets it. */
export function floorFile(draft: Draft): FloorSource | null {
  const where = floorOfPhoto(draft.photo);
  if (!where) return null;
  return {
    ...where,
    extractedFrom: draft.photo,
    checked: false,
    plan: { width: draft.plan.width, height: draft.plan.height },
    fit: { turn: 0 },
    walls: draft.walls.map(line),
    hallways: draft.route.map(line),
  };
}

/** The file's text: two-space JSON with each line of numbers on one line, so a cleanup diff shows one wall per line. */
export const formatFloorFile = (file: FloorSource): string =>
  `${JSON.stringify(file, null, 2).replace(/\[\s+(-?[\d.]+(?:,\s+-?[\d.]+)*)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s+/).join(', ')}]`)}\n`;
