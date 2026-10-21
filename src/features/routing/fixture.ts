// Small hand-drawn campuses for the routing tests. Points are written as x, y in meters (x east, y north), so each
// test reads as a little map. Only the tests import this.
import type { Walk } from '@/shared/data/campus';
import type { XY } from '@/shared/data/route';
import type { RouterCampus, RouterRooms } from './router';

type Way = Walk['ways'][number];
/** One link of the network: from, to, its way's kind and name. */
export type Seg = readonly [from: XY, to: XY, kind: Way['kind'], name?: string];

interface Door {
  readonly building: string;
  readonly at: XY;
  readonly kind?: 'main' | 'side' | 'back';
  readonly name?: string;
}

interface Building {
  readonly slug: string;
  readonly tier?: 'full' | 'block';
  readonly levels?: number;
}

interface Places {
  readonly gates?: readonly { readonly id: string; readonly at: XY }[];
  readonly doors?: readonly Door[];
  /** Defaults to every building that has a door, full tier, 5 floors. */
  readonly buildings?: readonly Building[];
}

/** Each segment gets its own way, so names and kinds never leak between links. */
export function walkOf(segs: readonly Seg[]): { walk: Walk; point: (at: XY) => number } {
  const points: number[] = [];
  const index = new Map<string, number>();
  const point = ([x, y]: XY): number => {
    const key = `${String(x)},${String(y)}`;
    let i = index.get(key);
    if (i === undefined) {
      i = points.length / 2;
      points.push(x, y);
      index.set(key, i);
    }
    return i;
  };
  const ways: Way[] = [];
  const links: [number, number, number][] = [];
  for (const [a, b, kind, name] of segs) {
    ways.push(name === undefined ? { kind } : { kind, name });
    links.push([point(a), point(b), ways.length - 1]);
  }
  return { walk: { points, ways, links }, point };
}

export function fixtureCampus(segs: readonly Seg[], places: Places): RouterCampus {
  const { walk, point } = walkOf(segs);
  const gates = (places.gates ?? []).map((g) => ({ id: g.id, name: `Gate ${g.id}`, point: point(g.at) }));
  const entrances = (places.doors ?? []).map((d) => ({
    building: d.building,
    kind: d.kind ?? 'main',
    point: point(d.at),
    verified: false,
    ...(d.name === undefined ? {} : { name: d.name }),
  }));
  const slugs = [...new Set(entrances.map((e) => e.building))];
  const buildings = (places.buildings ?? slugs.map((slug): Building => ({ slug }))).map((b) => ({
    slug: b.slug,
    tier: b.tier ?? 'full',
    levels: b.levels ?? 5,
  }));
  return { walk, gates, entrances, buildings };
}

export function fixtureRooms(...rooms: readonly [code: string, building: string, floor: number][]): RouterRooms {
  return { rooms: rooms.map(([code, building, floor]) => ({ code, building, floor })) };
}
