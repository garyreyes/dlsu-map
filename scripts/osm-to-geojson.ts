// OSM elements (the main API's JSON) to GeoJSON features, for the pinned snapshot (D4, D27). Pure: no I/O.
// Keeps only what the map uses, reports what it can't convert, and never guesses. Tests: osm-to-geojson.test.ts.

export type Tags = Readonly<Record<string, string>>;
export interface OsmNode {
  readonly type: 'node';
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly tags?: Tags;
}
export interface OsmWay {
  readonly type: 'way';
  readonly id: number;
  readonly nodes: readonly number[];
  readonly tags?: Tags;
}
export interface OsmMember {
  readonly type: 'node' | 'way' | 'relation';
  readonly ref: number;
  readonly role: string;
}
export interface OsmRelation {
  readonly type: 'relation';
  readonly id: number;
  readonly members: readonly OsmMember[];
  readonly tags?: Tags;
}
export type OsmElement = OsmNode | OsmWay | OsmRelation;

export type Position = [lon: number, lat: number];
export type Geometry =
  | { readonly type: 'Point'; readonly coordinates: Position }
  | { readonly type: 'LineString'; readonly coordinates: Position[] }
  | { readonly type: 'Polygon'; readonly coordinates: Position[][] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: Position[][][] };
export interface Feature {
  readonly type: 'Feature';
  /** `way/22480439` */
  readonly id: string;
  readonly properties: { readonly tags: Tags };
  readonly geometry: Geometry;
}
export interface Conversion {
  readonly features: Feature[];
  /** Kept elements that couldn't be converted, with the reason. The script prints them. */
  readonly warnings: string[];
}

export function osmToGeoJson(elements: readonly OsmElement[]): Conversion {
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  for (const e of elements) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
  }
  const features: Feature[] = [];
  const warnings: string[] = [];
  for (const e of elements) {
    try {
      const geometry = geometryOf(e, nodes, ways, warnings);
      if (geometry)
        features.push({
          type: 'Feature',
          id: `${e.type}/${String(e.id)}`,
          properties: { tags: e.tags ?? {} },
          geometry,
        });
    } catch (error) {
      if (!(error instanceof Skip)) throw error;
      warnings.push(error.message);
    }
  }
  return { features, warnings };
}

/**
 * Kept relations with member ways missing. An area request (`/map?bbox=`) leaves out the members that don't touch
 * the area (the campus boundary lost 2 of its 9 on 2026-10-20), so the script fetches these in full.
 */
export function incompleteRelations(elements: readonly OsmElement[]): number[] {
  const wayIds = new Set(elements.flatMap((e) => (e.type === 'way' ? [e.id] : [])));
  return elements.flatMap((e) =>
    e.type === 'relation' &&
    isKeptRelation(e.tags ?? {}) &&
    e.members.some((m) => m.type === 'way' && !wayIds.has(m.ref))
      ? [e.id]
      : [],
  );
}

/** A kept element that can't be converted: reported, never guessed at. */
class Skip extends Error {}

// What the map keeps (ARCHITECTURE §3.1): buildings and their parts, the campus, streets and paths, the LRT line,
// and gates, entrances, elevators and crossings.
const isSet = (value: string | undefined) => value !== undefined && value !== 'no';
const isArea = (t: Tags) => isSet(t.building) || isSet(t['building:part']) || t.amenity === 'university';

function wayKind(t: Tags): 'polygon' | 'line' | null {
  if (isArea(t)) return 'polygon';
  if (t.highway !== undefined) return t.area === 'yes' ? 'polygon' : 'line';
  if (t.railway === 'light_rail') return 'line';
  return null;
}
const isKeptNode = (t: Tags) =>
  t.barrier === 'gate' || isSet(t.entrance) || t.highway === 'elevator' || t.highway === 'crossing';
// type=building relations only group outlines and parts that are already their own ways. A highway multipolygon is
// always an area (a plaza), as a highway way with area=yes is.
const isKeptRelation = (t: Tags) => t.type === 'multipolygon' && (isArea(t) || t.highway !== undefined);

function geometryOf(
  e: OsmElement,
  nodes: ReadonlyMap<number, OsmNode>,
  ways: ReadonlyMap<number, OsmWay>,
  warnings: string[],
): Geometry | null {
  const tags = e.tags ?? {};
  if (e.type === 'node') return isKeptNode(tags) ? { type: 'Point', coordinates: [e.lon, e.lat] } : null;
  if (e.type === 'way') {
    const kind = wayKind(tags);
    if (!kind) return null;
    const line = positionsOf(e.nodes, nodes, `way/${String(e.id)}`);
    if (kind === 'line') return { type: 'LineString', coordinates: line };
    if (!isClosedRing(e.nodes)) throw new Skip(`way/${String(e.id)}: outline is not closed`);
    return { type: 'Polygon', coordinates: [wind(line, 'ccw', `way/${String(e.id)}`)] };
  }
  return isKeptRelation(tags) ? multipolygon(e, nodes, ways, warnings) : null;
}

const isClosedRing = (ids: readonly number[]) => ids.length >= 4 && ids[0] === ids.at(-1);

function positionsOf(ids: readonly number[], nodes: ReadonlyMap<number, OsmNode>, owner: string): Position[] {
  return ids.map((id) => {
    const n = nodes.get(id);
    if (!n) throw new Skip(`${owner}: node/${String(id)} is missing`);
    return [n.lon, n.lat];
  });
}

function multipolygon(
  rel: OsmRelation,
  nodes: ReadonlyMap<number, OsmNode>,
  ways: ReadonlyMap<number, OsmWay>,
  warnings: string[],
): Geometry {
  const owner = `relation/${String(rel.id)}`;
  const { outer, inner } = memberPaths(rel, ways, owner);
  const polygons = closeRings(outer, owner, 'outer').map((r) => [wind(positionsOf(r, nodes, owner), 'ccw', owner)]);
  for (const ring of closeRings(inner, owner, 'inner')) {
    const hole = wind(positionsOf(ring, nodes, owner), 'cw', owner);
    // The innermost outline holding every point of the hole, so member order can't change the result.
    const homes = polygons.filter(([shell]) => shell && hole.every((p) => contains(shell, p)));
    const home = homes.sort((a, b) => Math.abs(signedArea(a[0] ?? [])) - Math.abs(signedArea(b[0] ?? [])))[0];
    if (home) home.push(hole);
    else warnings.push(`${owner}: an inner ring lies outside every outer ring, dropped`);
  }
  const [only, ...rest] = polygons;
  if (!only) throw new Skip(`${owner}: no outer ring`);
  return rest.length === 0 ? { type: 'Polygon', coordinates: only } : { type: 'MultiPolygon', coordinates: polygons };
}

/** The node lists of a multipolygon's outer and inner ways. A missing, repeated or oddly-roled member is reported. */
function memberPaths(rel: OsmRelation, ways: ReadonlyMap<number, OsmWay>, owner: string) {
  const outer: number[][] = [];
  const inner: number[][] = [];
  const seen = new Set<number>();
  for (const m of rel.members) {
    if (m.type !== 'way') continue;
    const w = ways.get(m.ref);
    if (!w) throw new Skip(`${owner}: member way/${String(m.ref)} is missing`);
    if (seen.has(m.ref)) throw new Skip(`${owner}: member way/${String(m.ref)} is listed twice`);
    if (!['outer', 'inner', ''].includes(m.role)) throw new Skip(`${owner}: member role "${m.role}" is not a ring`);
    seen.add(m.ref);
    (m.role === 'inner' ? inner : outer).push([...w.nodes]);
  }
  return { outer, inner };
}

/** Joins open ways end to end (reversing where needed) into closed rings of node ids. */
function closeRings(paths: number[][], owner: string, role: string): number[][] {
  const pool = paths.map((p) => [...p]);
  const rings: number[][] = [];
  for (let ring = pool.shift(); ring; ring = pool.shift()) {
    while (ring[0] !== ring.at(-1)) {
      const end = ring.at(-1);
      const i = pool.findIndex((p) => p[0] === end || p.at(-1) === end);
      const [next] = i < 0 ? [] : pool.splice(i, 1);
      if (!next) throw new Skip(`${owner}: an ${role} ring does not close`);
      ring.push(...(next[0] === end ? next : next.reverse()).slice(1));
    }
    if (!isClosedRing(ring)) throw new Skip(`${owner}: an ${role} ring has fewer than 3 points`);
    // A node visited twice means two loops joined at one point (a figure 8): which split is meant is a guess.
    if (new Set(ring).size !== ring.length - 1) throw new Skip(`${owner}: an ${role} ring touches itself`);
    rings.push(ring);
  }
  return rings;
}

/**
 * Shoelace formula: positive = counterclockwise. Measured from the ring's first point so a 5 m ring at longitude
 * 121° keeps its precision.
 */
function signedArea(ring: Position[]): number {
  const [x0, y0] = ring[0] ?? [0, 0];
  let sum = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    const [x1, y1] = ring[i] ?? [0, 0];
    const [x2, y2] = ring[i + 1] ?? [0, 0];
    sum += (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  }
  return sum / 2;
}

/** RFC 7946: outer rings counterclockwise, holes clockwise. A ring with no area is reported, not drawn. */
function wind(ring: Position[], direction: 'ccw' | 'cw', owner: string): Position[] {
  const area = signedArea(ring);
  if (area === 0) throw new Skip(`${owner}: a ring has no area`);
  return area > 0 === (direction === 'ccw') ? ring : [...ring].reverse();
}

/** Ray casting: is the point inside the closed ring? */
function contains(ring: Position[], [x, y]: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
