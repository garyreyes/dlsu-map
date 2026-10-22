// A floor file's walls in plan px, the units `review`'s grid and `edit`'s specs use, for placing doors (8a): every
// wall sorted, and the gaps along one wall band (a corridor wall's door gaps). Pure. Tests: plan-px.test.ts.
import type { FloorSource } from '../../src/shared/data/floor-source.ts';

export interface Across {
  readonly y: number;
  readonly from: number;
  readonly to: number;
  readonly index: number;
}

export interface Down {
  readonly x: number;
  readonly from: number;
  readonly to: number;
  readonly index: number;
}

interface Line {
  readonly index: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Each wall's ends in plan px, unrounded. */
function lines(floor: FloorSource): Line[] {
  const { width, height } = floor.plan;
  return floor.walls.map((w, index) => ({
    index,
    x0: (w[0] ?? 0) * width,
    y0: (w[1] ?? 0) * height,
    x1: (w[2] ?? 0) * width,
    y1: (w[3] ?? 0) * height,
  }));
}

const isAcross = (l: Line) => Math.abs(l.y1 - l.y0) < Math.abs(l.x1 - l.x0);

/** Walls lying across (by y, then x) and down (by x, then y), rounded to whole px. */
export function wallsInPx(floor: FloorSource): { across: Across[]; down: Down[] } {
  const all = lines(floor);
  const across = all
    .filter(isAcross)
    .map((l) => ({
      y: Math.round((l.y0 + l.y1) / 2),
      from: Math.round(Math.min(l.x0, l.x1)),
      to: Math.round(Math.max(l.x0, l.x1)),
      index: l.index,
    }))
    .sort((a, b) => a.y - b.y || a.from - b.from);
  const down = all
    .filter((l) => !isAcross(l))
    .map((l) => ({
      x: Math.round((l.x0 + l.x1) / 2),
      from: Math.round(Math.min(l.y0, l.y1)),
      to: Math.round(Math.max(l.y0, l.y1)),
      index: l.index,
    }))
    .sort((a, b) => a.x - b.x || a.from - b.from);
  return { across, down };
}

/** The gaps, [from, to] in px, between walls lying across whose middle is in y0–y1, wider than `wider` px. Column
 *  squares leave gaps of 15–40 px, which aren't doors: check each against the sign. */
export function gapsInBand(floor: FloorSource, y0: number, y1: number, wider = 10): [number, number][] {
  const spans = lines(floor)
    .filter((l) => isAcross(l) && (l.y0 + l.y1) / 2 >= y0 && (l.y0 + l.y1) / 2 <= y1)
    .map((l) => [Math.round(Math.min(l.x0, l.x1)), Math.round(Math.max(l.x0, l.x1))] as const)
    .sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let end = spans[0]?.[1] ?? 0;
  for (const [from, to] of spans.slice(1)) {
    if (from - end > wider) gaps.push([end, from]);
    end = Math.max(end, to);
  }
  return gaps;
}
