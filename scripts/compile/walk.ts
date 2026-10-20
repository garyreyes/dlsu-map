// The walking network (4a): OSM footpaths, steps, small streets and crosswalks, joined wherever OSM shares a node,
// plus Taft Avenue's sidewalks, which meet only at crosswalks (D32). Main roads are left out. Pure. Tests:
// walk.test.ts. Entrances and gates are joined to it in attach.ts.
import type { Walk } from '../../src/shared/data/campus.ts';
import type { LonLat } from '../../src/shared/geo/project.ts';
import type { Feature, Tags } from '../osm-to-geojson.ts';
import { inRect, pointInRing, type Point, type Rect } from './geometry.ts';
import { nodeKey, sidewalks, type SidewalkPoint, type Sidewalks } from './sidewalks.ts';

export type WayInfo = Walk['ways'][number];
export type Link = [from: number, to: number, way: number];
export interface Network {
  /** In meters, not yet rounded. */
  readonly points: Point[];
  /** Per point: its OSM node (`lon,lat`) or a made-up key (`sidewalk:…`, `door:…`). */
  readonly keys: string[];
  readonly ways: WayInfo[];
  readonly links: Link[];
}

/** Streets walked on their sidewalks rather than their centre line (D32). */
export const SIDEWALK_STREETS: ReadonlySet<string> = new Set(['Taft Avenue']);

const KINDS: Readonly<Record<string, WayInfo['kind']>> = {
  footway: 'path',
  pedestrian: 'path',
  path: 'path',
  cycleway: 'path',
  corridor: 'path',
  steps: 'steps',
  service: 'street',
  residential: 'street',
  unclassified: 'street',
  living_street: 'street',
};

/** Carriageways: a footway or service road that happens to carry the name is walked like any other. */
const ROAD_CLASSES = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link']);
const isCrossing = (tags: Tags) => tags.footway === 'crossing';
export const isSidewalkStreet = (tags: Tags) =>
  ROAD_CLASSES.has(tags.highway ?? '') && !isCrossing(tags) && SIDEWALK_STREETS.has(tags.name ?? '');
const closed = (tags: Tags) =>
  tags.foot === 'no' || (tags.access === 'no' && !['yes', 'designated', 'permissive'].includes(tags.foot ?? ''));

/** The network being built: points, ways and links each added once. */
function builder() {
  const n: Network = { points: [], keys: [], ways: [], links: [] };
  const pointIds = new Map<string, number>();
  const wayIds = new Map<string, number>();
  const linkIds = new Set<string>();
  const point = (key: string, p: Point): number => {
    const known = pointIds.get(key);
    if (known !== undefined) return known;
    n.points.push(p);
    n.keys.push(key);
    pointIds.set(key, n.points.length - 1);
    return n.points.length - 1;
  };
  const way = (w: WayInfo): number => {
    const key = `${w.kind}|${w.name ?? ''}|${String(w.covered ?? false)}`;
    const known = wayIds.get(key);
    if (known !== undefined) return known;
    n.ways.push(w);
    wayIds.set(key, n.ways.length - 1);
    return n.ways.length - 1;
  };
  const link = (a: number, b: number, w: number) => {
    const key = a < b ? `${String(a)},${String(b)}` : `${String(b)},${String(a)}`;
    if (a === b || linkIds.has(key)) return;
    linkIds.add(key);
    n.links.push([a, b, w]);
  };
  return { network: n, point, way, link };
}
type Builder = ReturnType<typeof builder>;

/** The street a crosswalk crosses: a named road sharing one of its nodes, a sidewalk street first. */
function crossedStreet(f: Feature, roadNames: ReadonlyMap<string, string[]>): string | undefined {
  if (f.geometry.type !== 'LineString') return undefined;
  const names = f.geometry.coordinates.flatMap((c) => roadNames.get(nodeKey(c)) ?? []);
  return names.find((n) => SIDEWALK_STREETS.has(n)) ?? names[0];
}

function wayInfo(f: Feature, roadNames: ReadonlyMap<string, string[]>): WayInfo | undefined {
  const tags = f.properties.tags;
  const kind = KINDS[tags.highway ?? ''];
  if (!kind || closed(tags) || isSidewalkStreet(tags)) return undefined;
  const name = isCrossing(tags) ? crossedStreet(f, roadNames) : tags.name;
  return {
    kind: isCrossing(tags) ? 'crossing' : kind,
    ...(name !== undefined && { name }),
    ...(tags.covered === 'yes' && { covered: true as const }),
  };
}

/** The sidewalk point on the side of `toward`, the one most in its direction; undefined if none faces it. */
function facing(options: readonly SidewalkPoint[], from: Point, toward: Point): SidewalkPoint | undefined {
  const dot = (s: SidewalkPoint) => s.normal[0] * (toward[0] - from[0]) + s.normal[1] * (toward[1] - from[1]);
  const best = [...options].sort((a, b) => dot(b) - dot(a))[0];
  return best && dot(best) > 0 ? best : undefined;
}
/** The sidewalk point facing away from `from`: where a crosswalk reaching the centre line from the road lands. */
function across(options: readonly SidewalkPoint[], centre: Point, from: Point): SidewalkPoint | undefined {
  return facing(options, centre, [2 * centre[0] - from[0], 2 * centre[1] - from[1]]);
}

interface WayContext {
  readonly b: Builder;
  readonly side: Sidewalks;
  readonly roadNames: ReadonlyMap<string, string[]>;
  readonly toMeters: (c: LonLat) => [number, number];
  readonly extent: Rect;
  readonly stranded: Map<string, string[]>; // street → ways meeting it where it has no sidewalk
}

interface End {
  readonly key: string;
  readonly point: Point;
}

/** A sidewalk street's name at a centre-line node. */
const sidewalkStreetAt = (key: string, ctx: WayContext): string =>
  ctx.roadNames.get(key)?.find((n) => SIDEWALK_STREETS.has(n)) ?? '';

/** One end of a stretch: its own point, or the sidewalk it reaches if it is on a sidewalk street's centre line. */
function endpoint(c: LonLat, other: LonLat, crossing: boolean, ctx: WayContext): End | 'road' | undefined {
  const options = ctx.side.at.get(nodeKey(c));
  if (!options) return { key: nodeKey(c), point: ctx.toMeters(c) };
  if (ctx.side.at.has(nodeKey(other)) && !crossing) return 'road'; // along or straight over the carriageway
  const [p, q] = [ctx.toMeters(c), ctx.toMeters(other)];
  return facing(options, p, q) ?? (crossing ? across(options, p, q) : undefined);
}

/** A way's stretches as links. A crosswalk passing over a centre line also joins the two sidewalks it lands on. */
function addWay(f: Feature, info: WayInfo, ctx: WayContext): void {
  if (f.geometry.type !== 'LineString') return;
  const coords = f.geometry.coordinates;
  const w = ctx.b.way(info);
  const crossing = info.kind === 'crossing';
  let previousEnd: number | undefined;
  for (let i = 1; i < coords.length; i++) {
    const [c0, c1] = [coords[i - 1] as LonLat, coords[i] as LonLat];
    const inside = inRect(ctx.toMeters(c0), ctx.extent) || inRect(ctx.toMeters(c1), ctx.extent);
    const [e0, e1] = inside ? [endpoint(c0, c1, crossing, ctx), endpoint(c1, c0, crossing, ctx)] : [];
    if (inside && (e0 === undefined || e1 === undefined)) {
      const street = sidewalkStreetAt(nodeKey(e0 === undefined ? c0 : c1), ctx);
      ctx.stranded.set(street, [...new Set([...(ctx.stranded.get(street) ?? []), f.id])]);
    }
    if (typeof e0 !== 'object' || typeof e1 !== 'object') {
      previousEnd = undefined;
      continue;
    }
    const [a, b] = [ctx.b.point(e0.key, e0.point), ctx.b.point(e1.key, e1.point)];
    ctx.b.link(a, b, w);
    if (crossing && previousEnd !== undefined) ctx.b.link(previousEnd, a, w);
    previousEnd = b;
  }
}

/** The sidewalks' own stretches, and a link between both sides of a two-sided street at each crossing point. */
function addSidewalks(features: readonly Feature[], ctx: WayContext): void {
  for (const line of ctx.side.lines) {
    const w = ctx.b.way({ kind: 'sidewalk', name: line.name });
    for (let i = 1; i < line.keys.length; i++) {
      if (!inRect(line.centre[i - 1] as Point, ctx.extent) && !inRect(line.centre[i] as Point, ctx.extent)) continue;
      const a = ctx.b.point(line.keys[i - 1] as string, line.points[i - 1] as Point);
      ctx.b.link(a, ctx.b.point(line.keys[i] as string, line.points[i] as Point), w);
    }
  }
  for (const f of features) {
    if (f.geometry.type !== 'Point' || f.properties.tags.highway !== 'crossing') continue;
    const key = nodeKey(f.geometry.coordinates);
    const [s0, s1] = ctx.side.at.get(key) ?? [];
    if (!s0 || !s1 || !inRect(ctx.toMeters(f.geometry.coordinates), ctx.extent)) continue;
    if (s0.normal[0] * s1.normal[0] + s0.normal[1] * s1.normal[1] >= 0) continue; // same side
    const w = ctx.b.way({ kind: 'crossing', name: sidewalkStreetAt(key, ctx) });
    ctx.b.link(ctx.b.point(s0.key, s0.point), ctx.b.point(s1.key, s1.point), w);
  }
}

/** Whether the straight line p → q stays inside the ring (checked at 9 points along it). */
const staysInside = (p: Point, q: Point, ring: readonly Point[]) =>
  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].every((t) =>
    pointInRing([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])], ring),
  );

/**
 * A square (a `highway=pedestrian` area such as Central Plaza): walkable around its edge, and straight across between
 * every two points where a path reaches it, wherever that line stays inside.
 */
function addSquare(f: Feature, entries: ReadonlySet<string>, ctx: WayContext): void {
  if (f.geometry.type !== 'Polygon' || closed(f.properties.tags)) return;
  const ring = (f.geometry.coordinates[0] ?? []).slice(0, -1);
  const meters = ring.map(ctx.toMeters);
  if (!meters.some((p) => inRect(p, ctx.extent))) return;
  const name = f.properties.tags.name;
  const w = ctx.b.way({ kind: 'path', ...(name !== undefined && { name }) });
  const ids = ring.map((c, i) => ctx.b.point(nodeKey(c), meters[i] as Point));
  ids.forEach((id, i) => {
    ctx.b.link(id, ids[(i + 1) % ids.length] as number, w);
  });
  const open = ring.map((_, i) => i).filter((i) => entries.has(nodeKey(ring[i] as LonLat)));
  for (const [n, i] of open.entries())
    for (const j of open.slice(n + 1))
      if (staysInside(meters[i] as Point, meters[j] as Point, meters))
        ctx.b.link(ids[i] as number, ids[j] as number, w);
}

/** Every road node's street names, to name crosswalks. */
function roadNamesOf(features: readonly Feature[]): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const f of features) {
    const name = f.properties.tags.name;
    if (f.geometry.type !== 'LineString' || !f.properties.tags.highway || !name || isCrossing(f.properties.tags))
      continue;
    for (const c of f.geometry.coordinates) names.set(nodeKey(c), [...(names.get(nodeKey(c)) ?? []), name]);
  }
  return names;
}

/** The whole network within the map, before keeping only its biggest piece. */
export function buildNetwork(
  features: readonly Feature[],
  toMeters: (c: LonLat) => [number, number],
  extent: Rect,
): { network: Network; notes: string[] } {
  const roads = features.filter((f) => f.geometry.type === 'LineString' && isSidewalkStreet(f.properties.tags));
  const roadNames = roadNamesOf(features);
  const side = sidewalks(roads, toMeters);
  const ctx: WayContext = { b: builder(), side, roadNames, toMeters, extent, stranded: new Map() };
  addSidewalks(features, ctx);
  const entries = new Set<string>();
  for (const f of features) {
    const info = f.geometry.type === 'LineString' ? wayInfo(f, roadNames) : undefined;
    if (!info || f.geometry.type !== 'LineString') continue;
    addWay(f, info, ctx);
    for (const c of f.geometry.coordinates) entries.add(nodeKey(c));
  }
  for (const f of features) if (f.properties.tags.highway === 'pedestrian') addSquare(f, entries, ctx);
  const notes = [...ctx.stranded].map(([street, ids]) => {
    const stretch = ids.length === 1 ? '1 stretch meets' : `${String(ids.length)} stretches meet`;
    return `walk: ${stretch} ${street} where it has no sidewalk (${ids.join(', ')})`;
  });
  return { network: ctx.b.network, notes };
}

/** Per point, the id of the piece of the network it is in. */
export function components(n: Network): number[] {
  const parent = n.points.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    for (let j = i; parent[j] !== r;) [j, parent[j]] = [parent[j] as number, r];
    return r;
  };
  for (const [a, b] of n.links) parent[find(a)] = find(b);
  return n.points.map((_, i) => find(i));
}

/** Only the biggest piece of the network, renumbered; the dropped pieces' points, and a note on them. */
export function keepLargest(n: Network): { network: Network; dropped: Point[][]; note?: string } {
  const comp = components(n);
  const sizes = new Map<number, number>();
  for (const c of comp) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const biggest = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0];
  const kept = n.points.map((_, i) => i).filter((i) => comp[i] === biggest);
  const renumber = new Map(kept.map((old, i) => [old, i]));
  const network: Network = {
    points: kept.map((i) => n.points[i] as Point),
    keys: kept.map((i) => n.keys[i] as string),
    ways: n.ways,
    links: n.links.flatMap(([a, b, w]): Link[] => {
      const [na, nb] = [renumber.get(a), renumber.get(b)];
      return na === undefined || nb === undefined ? [] : [[na, nb, w]];
    }),
  };
  const groups = new Map<number, Point[]>();
  comp.forEach((c, i) => {
    if (c !== biggest) groups.set(c, [...(groups.get(c) ?? []), n.points[i] as Point]);
  });
  const dropped = [...groups.values()];
  if (dropped.length === 0) return { network, dropped };
  const points = n.points.length - kept.length;
  const piece = dropped.length === 1 ? '1 piece' : `${String(dropped.length)} pieces`;
  return { network, dropped, note: `walk: dropped ${piece} not joined to the rest (${String(points)} points)` };
}
