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

// The campus of `indoor-router.test.ts` and `trip-choices.test.ts`.
//
// Outside: gate g1 at 0,0. Alpha's main door M at 0,100 (100 m path north), its side door S at 100,100 (141 m path on
// the diagonal). Beta's main door at -100,0 (100 m path west); beta has no building file. Entrances 0, 1 and 2.
//
// Alpha inside, every floor the same hallway along y = 110 from x = 0 to 100, west stairs at 0,115 and the elevator
// at 100,115, each 5 m off the hallway's ends:
//   G   M and S join the hallway 10 m north of them. AL101's door at 50,115.
//   2F  AL201's door at 0,105, AL207's at 20,115, AL205's at 50,105.
//   3F  AL301's door at 50,105.
//   4F  AL401's door at 60,105.
//   5F  not traced: AL502 is in the room list only.
export const alphaCampus = fixtureCampus(
  [
    [[0, 0], [0, 100], 'path'],
    [[0, 0], [100, 100], 'path'],
    [[0, 0], [-100, 0], 'path'],
  ],
  {
    gates: [{ id: 'g1', at: [0, 0] }],
    doors: [
      { building: 'alpha', at: [0, 100] },
      { building: 'alpha', at: [100, 100], kind: 'side' },
      { building: 'beta', at: [-100, 0] },
    ],
    buildings: [{ slug: 'alpha', floorLabels: { '1': 'G' } }, { slug: 'beta' }],
  },
);
export const alphaRooms = fixtureRooms(
  ['AL101', 'alpha', 1],
  ['AL201', 'alpha', 2],
  ['AL205', 'alpha', 2],
  ['AL207', 'alpha', 2],
  ['AL301', 'alpha', 3],
  ['AL401', 'alpha', 4],
  ['AL502', 'alpha', 5],
  ['BE101', 'beta', 1],
);

const alphaFloor = (f: number, extra: IndoorSpec['points']): IndoorSpec['points'] => ({
  [`ws${String(f)}`]: [f, 0, 115],
  [`h${String(f)}a`]: [f, 0, 110],
  [`h${String(f)}b`]: [f, 100, 110],
  [`el${String(f)}`]: [f, 100, 115],
  ...extra,
});
export const alphaSpec: IndoorSpec = {
  building: 'alpha',
  points: {
    ...alphaFloor(1, { M: [1, 0, 100], S: [1, 100, 100], h1m: [1, 50, 110], d101: [1, 50, 115] }),
    ...alphaFloor(2, {
      h2w: [2, 20, 110],
      h2m: [2, 50, 110],
      d201: [2, 0, 105],
      d207: [2, 20, 115],
      d205: [2, 50, 105],
    }),
    ...alphaFloor(3, { h3m: [3, 50, 110], d301: [3, 50, 105] }),
    ...alphaFloor(4, { h4m: [4, 60, 110], d401: [4, 60, 105] }),
  },
  links: [
    ['M', 'h1a', 'entrance'],
    ['S', 'h1b', 'entrance'],
    ['h1a', 'h1m', 'hall'],
    ['h1m', 'h1b', 'hall'],
    ['h1m', 'd101', 'door'],
    ['h2a', 'h2w', 'hall'],
    ['h2w', 'h2m', 'hall'],
    ['h2m', 'h2b', 'hall'],
    ['h2a', 'd201', 'door'],
    ['h2w', 'd207', 'door'],
    ['h2m', 'd205', 'door'],
    ['h3a', 'h3m', 'hall'],
    ['h3m', 'h3b', 'hall'],
    ['h3m', 'd301', 'door'],
    ['h4a', 'h4m', 'hall'],
    ['h4m', 'h4b', 'hall'],
    ['h4m', 'd401', 'door'],
    ...[1, 2, 3, 4].flatMap((f): IndoorSpec['links'] => [
      [`ws${String(f)}`, `h${String(f)}a`, 'hall'],
      [`h${String(f)}b`, `el${String(f)}`, 'hall'],
    ]),
    ['ws1', 'ws2', 'stairs'],
    ['ws2', 'ws3', 'stairs'],
    ['ws3', 'ws4', 'stairs'],
    ['el1', 'el2', 'elevator'],
    ['el2', 'el3', 'elevator'],
    ['el3', 'el4', 'elevator'],
  ],
  rooms: {
    AL101: ['d101'],
    AL201: ['d201'],
    AL205: ['d205'],
    AL207: ['d207'],
    AL301: ['d301'],
    AL401: ['d401'],
  },
  verticals: [
    { id: 'west-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4], stops: ['ws1', 'ws2', 'ws3', 'ws4'] },
    { id: 'elevator', kind: 'elevator', servesFloors: [1, 2, 3, 4], stops: ['el1', 'el2', 'el3', 'el4'] },
  ],
  entrances: { 0: 'M', 1: 'S' },
};
