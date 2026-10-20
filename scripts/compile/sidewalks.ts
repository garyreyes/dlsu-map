// The sidewalks of the streets OSM maps only as carriageways (D31): Taft Avenue. Each side tagged `sidewalk=*` becomes
// a line offset from the centre line; walk.ts joins paths to the side they meet and crosses only at crosswalks. Pure.
// Tests: walk.test.ts ("Taft sidewalks").
import type { LonLat } from '../../src/shared/geo/project.ts';
import type { Feature, Tags } from '../osm-to-geojson.ts';
import type { Point } from './geometry.ts';

/** One lane, and how far past the kerb the middle of the sidewalk is, in meters. */
const LANE = 3.2;
const KERB = 1.5;
/** A sharp bend's corner never sits further out than this many offsets. */
const MITER_LIMIT = 3;

/** One sidewalk point at a road node: where it is, and which way it lies from the centre line. */
export interface SidewalkPoint {
  readonly key: string;
  readonly point: Point;
  readonly normal: Point;
}
export interface Sidewalks {
  /** Every centre-line node of these streets, with its sidewalk points (none where neither side has one). */
  readonly at: ReadonlyMap<string, readonly SidewalkPoint[]>;
  /** The sidewalks as lines: point keys and positions in order, and the centre-line positions they came from. */
  readonly lines: readonly {
    readonly name: string;
    readonly keys: readonly string[];
    readonly points: readonly Point[];
    readonly centre: readonly Point[];
  }[];
}

/** A run of centre-line nodes and the side its sidewalk is on, seen walking the run in order. */
interface Run {
  /** The OSM ways it is made of. */
  ids: string[];
  name: string;
  keys: string[];
  centre: Point[];
  widths: number[]; // per stretch
  side: 'left' | 'right';
}

export const nodeKey = (c: LonLat): string => `${String(c[0])},${String(c[1])}`;

/** Half the carriageway plus the kerb: from `width`, else `lanes` (2 when untagged). */
function offsetOf(tags: Tags): number {
  const width = Number(tags.width);
  if (width > 0) return width / 2 + KERB;
  const lanes = Number(tags.lanes);
  return ((lanes > 0 ? lanes : 2) * LANE) / 2 + KERB;
}

function sidesOf(tags: Tags): Run['side'][] {
  const s = tags.sidewalk;
  if (s === 'both' || s === 'yes') return ['left', 'right'];
  return s === 'left' || s === 'right' ? [s] : [];
}

const flip = (r: Run): Run => ({
  ...r,
  keys: [...r.keys].reverse(),
  centre: [...r.centre].reverse(),
  widths: [...r.widths].reverse(),
  side: r.side === 'left' ? 'right' : 'left',
});

/** `b` turned to carry on from `a`'s last node on the same side, or undefined if it doesn't. */
function continuation(a: Run, b: Run, ends: ReadonlyMap<string, ReadonlySet<string>>): Run | undefined {
  const tail = a.keys.at(-1) ?? '';
  if (ends.get(tail)?.size !== 2 || b.ids.some((id) => a.ids.includes(id))) return undefined;
  const turned = b.keys[0] === tail ? b : b.keys.at(-1) === tail ? flip(b) : undefined;
  return turned?.side === a.side && turned.name === a.name ? turned : undefined;
}

/**
 * Joins runs of different ways that carry on from each other on the same side, only where exactly two ways end at
 * a node (a plain join, not a junction). A way's two sides are never joined to each other.
 */
function chain(runs: Run[]): Run[] {
  const ends = new Map<string, Set<string>>();
  for (const r of runs)
    for (const k of [r.keys[0], r.keys.at(-1)]) if (k) ends.set(k, new Set([...(ends.get(k) ?? []), ...r.ids]));
  const out = [...runs];
  for (let i = 0; i < out.length; i++) {
    for (let j = 0; j < out.length; j++) {
      const a = out[i] as Run;
      const b = i === j ? undefined : continuation(a, out[j] as Run, ends);
      if (!b) continue;
      out[i] = {
        ...a,
        ids: [...a.ids, ...b.ids],
        keys: [...a.keys, ...b.keys.slice(1)],
        centre: [...a.centre, ...b.centre.slice(1)],
        widths: [...a.widths, ...b.widths],
      };
      out.splice(j, 1);
      i = -1; // start over: the joined run may carry on further
      break;
    }
  }
  return out;
}

const unit = ([x, y]: Point): Point => {
  const len = Math.hypot(x, y);
  return [x / len, y / len];
};
/** The side's normal of the stretch p → q. */
const normalOf = (p: Point, q: Point, side: Run['side']): Point => {
  const [dx, dy] = unit([q[0] - p[0], q[1] - p[1]]);
  return side === 'right' ? [dy, -dx] : [-dy, dx];
};

/** Each point of the run moved out to its side; corners mitred so both stretches keep their distance. */
function offsetRun(r: Run): { points: Point[]; normals: Point[] } {
  const points: Point[] = [];
  const normals: Point[] = [];
  r.centre.forEach((c, i) => {
    const before = i > 0 ? normalOf(r.centre[i - 1] as Point, c, r.side) : undefined;
    const after = i < r.centre.length - 1 ? normalOf(c, r.centre[i + 1] as Point, r.side) : undefined;
    const n1 = before ?? after;
    const n2 = after ?? before;
    if (!n1 || !n2) return; // a run always has 2 or more points
    const d = ((r.widths[i - 1] ?? r.widths[i] ?? 0) + (r.widths[i] ?? r.widths[i - 1] ?? 0)) / 2;
    const sum: Point = [n1[0] + n2[0], n1[1] + n2[1]];
    const half = Math.hypot(...sum) / 2; // cos of half the turn
    const n = unit(sum);
    const scale = d / Math.max(half, 1 / MITER_LIMIT);
    points.push([c[0] + n[0] * scale, c[1] + n[1] * scale]);
    normals.push(n);
  });
  return { points, normals };
}

/** The sidewalks of the given streets' carriageways. */
export function sidewalks(roads: readonly Feature[], toMeters: (c: LonLat) => [number, number]): Sidewalks {
  const at = new Map<string, SidewalkPoint[]>();
  const runs: Run[] = [];
  for (const f of roads) {
    if (f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    const keys = coords.map(nodeKey);
    for (const k of keys) if (!at.has(k)) at.set(k, []);
    const width = offsetOf(f.properties.tags);
    for (const side of sidesOf(f.properties.tags)) {
      runs.push({
        ids: [f.id],
        name: f.properties.tags.name ?? '',
        keys,
        centre: coords.map(toMeters),
        widths: keys.slice(1).map(() => width),
        side,
      });
    }
  }
  const lines = chain(runs).map((r, n) => {
    const { points, normals } = offsetRun(r);
    const pointKeys = r.keys.map((k, i) => {
      const key = `sidewalk:${String(n)}:${String(i)}`;
      at.get(k)?.push({ key, point: points[i] as Point, normal: normals[i] as Point });
      return key;
    });
    return { name: r.name, keys: pointKeys, points, centre: r.centre };
  });
  return { at, lines };
}
