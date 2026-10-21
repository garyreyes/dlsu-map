// Small hand-drawn campuses for the routing tests. Points are written as x, y in meters (x east, y north), so each
// test reads as a little map. Only the tests import this.
import type { Walk } from '@/shared/data/campus';
import { indoorSchema, type Indoor } from '@/shared/data/indoor';
import type { XY } from '@/shared/data/route';
import type { RouterCampus, RouterRooms } from './router';

type Way = Walk['ways'][number];
/** One link of the network: from, to, its way's kind, name and whether it's covered. */
export type Seg = readonly [from: XY, to: XY, kind: Way['kind'], name?: string, covered?: true];

interface Door {
  readonly building: string;
  readonly at: XY;
  readonly kind?: 'main' | 'side' | 'back';
  readonly name?: string;
  readonly verified?: true;
}

interface Building {
  readonly slug: string;
  readonly tier?: 'full' | 'block';
  readonly levels?: number;
  /** Defaults to the slug with a capital: `alpha` → `Alpha`. */
  readonly short?: string;
  readonly floorLabels?: Readonly<Record<string, string>>;
  /** Defaults to a 1 m square far from everything, so it's never a landmark by accident. */
  readonly outline?: readonly number[];
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
  for (const [a, b, kind, name, covered] of segs) {
    ways.push({ kind, ...(name === undefined ? {} : { name }), ...(covered === undefined ? {} : { covered }) });
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
    verified: d.verified ?? false,
    ...(d.name === undefined ? {} : { name: d.name }),
  }));
  const slugs = [...new Set(entrances.map((e) => e.building))];
  const buildings = (places.buildings ?? slugs.map((slug): Building => ({ slug }))).map((b) => ({
    slug: b.slug,
    name: `${b.slug} Hall`,
    short: b.short ?? b.slug.charAt(0).toUpperCase() + b.slug.slice(1),
    tier: b.tier ?? 'full',
    levels: b.levels ?? 5,
    ...(b.floorLabels === undefined ? {} : { floorLabels: b.floorLabels }),
    volumes: [{ outline: [...(b.outline ?? [9000, 9000, 9001, 9000, 9001, 9001, 9000, 9001])], base: 0, top: 10 }],
  }));
  return { walk, gates, entrances, buildings };
}

export function fixtureRooms(...rooms: readonly [code: string, building: string, floor: number][]): RouterRooms {
  return { rooms: rooms.map(([code, building, floor]) => ({ code, building, floor })) };
}

type IndoorLinkKind = Indoor['graph']['links'][number][2];

/** A hand-drawn building file: named points (floor, x, y), links between them by name, rooms by their door points,
 *  verticals by their stops, and entrances by their index in the campus's `entrances`. */
export interface IndoorSpec {
  readonly building: string;
  readonly points: Readonly<Record<string, readonly [floor: number, x: number, y: number]>>;
  readonly links: readonly (readonly [a: string, b: string, kind: IndoorLinkKind])[];
  readonly rooms?: Readonly<Record<string, readonly string[]>>;
  readonly verticals?: readonly {
    readonly id: string;
    readonly kind: 'stairs' | 'elevator';
    readonly servesFloors: readonly number[];
    readonly stops: readonly string[];
  }[];
  readonly entrances?: Readonly<Record<number, string>>;
}

/** The building file for a spec, checked against its schema, and the point index of each name. */
export function fixtureIndoor(spec: IndoorSpec): { file: Indoor; point: (name: string) => number } {
  const names = Object.keys(spec.points);
  const point = (name: string): number => {
    const i = names.indexOf(name);
    if (i < 0) throw new Error(`no point ${name}`);
    return i;
  };
  const at = (name: string) => spec.points[name] ?? [0, 0, 0];
  const floorOf = (name: string): number => at(name)[0];
  const floors = [...new Set(names.map(floorOf))].sort((a, b) => a - b);
  const file = indoorSchema.parse({
    building: spec.building,
    floors: floors.map((floor) => ({
      floor,
      base: 3 * (floor - 1),
      height: 3,
      checked: true,
      walls: [],
      hallways: [],
    })),
    graph: {
      points: names.flatMap((n) => [at(n)[1], at(n)[2]]),
      floors: names.map(floorOf),
      links: spec.links.map(([a, b, kind]) => [point(a), point(b), kind]),
    },
    rooms: Object.entries(spec.rooms ?? {}).map(([code, doors]) => ({
      code,
      floor: floorOf(doors[0] ?? ''),
      label: [at(doors[0] ?? '')[1], at(doors[0] ?? '')[2]],
      doors: doors.map(point),
    })),
    verticals: (spec.verticals ?? []).map((v) => ({
      id: v.id,
      kind: v.kind,
      servesFloors: [...v.servesFloors],
      stops: v.stops.map((s) => ({ floor: floorOf(s), point: point(s) })),
    })),
    entrances: Object.entries(spec.entrances ?? {}).map(([entrance, p]) => ({
      entrance: Number(entrance),
      point: point(p),
    })),
  });
  return { file, point };
}
