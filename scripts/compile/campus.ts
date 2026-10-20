// data-src/campus (buildings.json + the OSM snapshot) → the campus.json the scene draws (2b). Pure: no I/O, so it is
// tested on a made-up campus (campus.test.ts) and on the real data (tests/compile-data.test.ts). Anything the build
// must not ship goes in `errors`; anything worth a look in the compile report goes in `notes`.
import type { BuildingSource } from '../../src/shared/data/buildings.ts';
import {
  campusSchema,
  type Campus,
  type CampusBuilding,
  type CampusPath,
  type Volume,
} from '../../src/shared/data/campus.ts';
import { prefixClashes } from '../../src/shared/data/prefix-table.ts';
import { projection, type LonLat } from '../../src/shared/geo/project.ts';
import type { Feature, Tags } from '../osm-to-geojson.ts';
import {
  boundsOf,
  centroid,
  clipLine,
  expand,
  inRect,
  pointInRing,
  ringArea,
  ringsTouch,
  round,
  type Point,
  type Rect,
} from './geometry.ts';
import { heightOf, levelsOf, unreadHeightTags } from './heights.ts';

/** The point at x = 0, y = 0: the prototype's origin, so 2c's sample and the real file line up. */
export const ORIGIN = { lon: 120.9932, lat: 14.5647 } as const;
/** "De La Salle University Manila" in OSM: the campus boundary. */
export const CAMPUS_RELATION = 'relation/11126048';
/** How far past the campus the city and paths reach (PLAN §5). */
export const MARGIN = 300;
const ATTRIBUTION = '© OpenStreetMap contributors (ODbL)';

export interface Snapshot {
  readonly snapshot: string;
  readonly features: readonly Feature[];
}
export interface CompileResult {
  /** Null whenever there are errors: nothing broken is ever written. */
  readonly campus: Campus | null;
  readonly errors: string[];
  readonly notes: string[];
}

const PATH_KINDS: Readonly<Record<string, CampusPath['kind']>> = {
  primary: 'road',
  primary_link: 'road',
  secondary: 'road',
  secondary_link: 'road',
  tertiary: 'road',
  tertiary_link: 'road',
  trunk: 'road',
  trunk_link: 'road',
  residential: 'street',
  service: 'street',
  unclassified: 'street',
  living_street: 'street',
  footway: 'foot',
  pedestrian: 'foot',
  steps: 'foot',
  path: 'foot',
  cycleway: 'foot',
};

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
const flat = (ring: readonly Point[]): number[] => ring.flatMap(([x, y]) => [round(x), round(y)]);

/** Everything compileCampus works from, projected once. */
interface Context {
  readonly toMeters: (p: LonLat) => [number, number];
  readonly byId: ReadonlyMap<string, Feature>;
  readonly errors: string[];
  readonly notes: string[];
}

/** A polygon's outer rings in meters, without the repeated closing point, and how many holes it had. */
function shape(f: Feature, ctx: Context): { outers: Point[][]; holes: number } {
  const polygons =
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon'
        ? f.geometry.coordinates
        : [];
  const open = (ring: readonly LonLat[]): Point[] => ring.slice(0, -1).map(ctx.toMeters);
  return {
    outers: polygons.flatMap((p) => (p[0] ? [open(p[0])] : [])),
    holes: polygons.reduce((n, p) => n + p.length - 1, 0),
  };
}

const isPart = (tags: Tags) => tags['building:part'] !== undefined && tags['building:part'] !== 'bridge';
const isBridge = (tags: Tags) => tags['building:part'] === 'bridge';

/** The listed buildings' features, with an error for each id the snapshot lacks. */
function listedFeatures(sources: readonly BuildingSource[], ctx: Context): Map<string, Feature[]> {
  const listed = new Map<string, Feature[]>();
  for (const b of sources) {
    const found: Feature[] = [];
    for (const id of b.osm) {
      const f = ctx.byId.get(id);
      if (f) found.push(f);
      else ctx.errors.push(`${b.slug}: ${id} is not in the snapshot`);
    }
    listed.set(b.slug, found);
  }
  return listed;
}

/**
 * The listed building a part belongs to: the one its centre is in; failing that, the one holding the most of its
 * corners (a connector or overhang reaching out of the building). Undefined if it touches none. Uses the part's
 * largest ring. Anything not clear-cut goes in the notes.
 */
function ownerOf(f: Feature, outlines: ReadonlyMap<string, Point[][]>, ctx: Context): string | undefined {
  const outer = shape(f, ctx).outers.sort((a, b) => ringArea(b) - ringArea(a))[0];
  if (!outer) return undefined;
  const c = centroid(outer);
  const holders = [...outlines].filter(([, rings]) => rings.some((r) => pointInRing(c, r))).map(([slug]) => slug);
  if (holders.length > 1)
    ctx.notes.push(`parts: ${f.id} is inside ${holders.join(', ')}; given to ${String(holders[0])}`);
  if (holders[0]) return holders[0];

  const counts = [...outlines].map(([slug, rings]) => {
    const corners = outer.filter((p) => rings.some((r) => pointInRing(p, r))).length;
    return { slug, corners };
  });
  const best = counts.reduce((a, b) => (b.corners > a.corners ? b : a), { slug: '', corners: 0 });
  if (best.corners === 0) return undefined;
  const are = best.corners === 1 ? 'is' : 'are';
  ctx.notes.push(
    `${best.slug}: took ${f.id}, whose centre is in no listed building ` +
      `(${String(best.corners)} of its ${String(outer.length)} corners ${are} in ${best.slug})`,
  );
  return best.slug;
}

/** The parts of each listed building. Parts of no listed building are left for the city. */
function assignParts(outlines: ReadonlyMap<string, Point[][]>, ctx: Context): Map<string, Feature[]> {
  const parts = new Map<string, Feature[]>();
  for (const f of ctx.byId.values()) {
    if (!isPart(f.properties.tags)) continue;
    const owner = ownerOf(f, outlines, ctx);
    if (owner) parts.set(owner, [...(parts.get(owner) ?? []), f]);
  }
  return parts;
}

/** Reports height tags heightOf could not read: an error where the campus is drawn, a note in the muted city. */
function checkHeightTags(f: Feature, ctx: Context, where: string, strict: boolean): void {
  for (const tag of unreadHeightTags(f.properties.tags)) {
    (strict ? ctx.errors : ctx.notes).push(`${where}: ${f.id} has ${tag}, which is not meters or a whole level count`);
  }
}

/** One volume per outer ring of each feature, at that feature's height. */
function volumesOf(features: readonly Feature[], ctx: Context, slug: string): Volume[] {
  return features.flatMap((f) => {
    checkHeightTags(f, ctx, slug, true);
    const h = heightOf(f.properties.tags);
    if (!h) {
      ctx.notes.push(`${slug}: ${f.id} skipped (its base is not below its top)`);
      return [];
    }
    return shape(f, ctx).outers.map((ring) => ({ outline: flat(ring), base: h.base, top: h.top }));
  });
}

function compileBuilding(b: BuildingSource, own: readonly Feature[], parts: readonly Feature[], ctx: Context) {
  const levels = own.map((f) => levelsOf(f.properties.tags)).find((n) => n !== undefined);
  if (levels === undefined && own.length > 0) ctx.errors.push(`${b.slug}: no building:levels in OSM`);
  const holes = own.reduce((n, f) => n + shape(f, ctx).holes, 0);
  if (holes > 0) ctx.notes.push(`${b.slug}: ${plural(holes, 'courtyard')} not drawn (campus.json has no holes yet)`);
  const volumes = [...volumesOf(own, ctx, b.slug), ...volumesOf(parts, ctx, b.slug)];
  if (volumes.length === 0 && own.length > 0) ctx.errors.push(`${b.slug}: nothing to draw`);
  const building: CampusBuilding = {
    slug: b.slug,
    name: b.name,
    short: b.short,
    aliases: b.aliases,
    tier: b.tier,
    prefixes: b.prefixes,
    levels: levels ?? 1,
    volumes,
  };
  return {
    ...building,
    ...(b.suggestPrefixes && { suggestPrefixes: b.suggestPrefixes }),
    ...(b.floorLabels && { floorLabels: b.floorLabels }),
  };
}

/** Boundary rings with a listed building in them; the bike-parking patches have none. */
function campusRings(outlines: ReadonlyMap<string, Point[][]>, ctx: Context): Point[][] {
  const relation = ctx.byId.get(CAMPUS_RELATION);
  if (!relation) {
    ctx.errors.push(`campus: ${CAMPUS_RELATION} is not in the snapshot`);
    return [];
  }
  const centres = [...outlines.values()].flat().map(centroid);
  const rings = shape(relation, ctx).outers;
  const kept = rings.filter((ring) => centres.some((c) => pointInRing(c, ring)));
  const dropped = rings.length - kept.length;
  if (dropped > 0) ctx.notes.push(`campus: dropped ${plural(dropped, 'boundary ring')} with no listed building in it`);
  return kept;
}

/** Skybridges joined to at least one listed building. */
function bridges(outlines: ReadonlyMap<string, Point[][]>, ctx: Context): Volume[] {
  const buildingRings = [...outlines.values()].flat();
  const touches = (ring: Point[]) => buildingRings.some((b) => ringsTouch(ring, b));
  return [...ctx.byId.values()].flatMap((f) => {
    if (!isBridge(f.properties.tags)) return [];
    const rings = shape(f, ctx).outers;
    if (!rings.some(touches)) {
      ctx.notes.push(`bridges: dropped ${f.id} (touches no listed building)`);
      return [];
    }
    return volumesOf([f], ctx, 'bridges');
  });
}

/**
 * Every other building and part whose centre is within the margin: drawn muted, never tappable. City blocks have no
 * base, so a raised one (the LRT station, a part on upper floors) is skipped rather than stood on the ground.
 */
function city(used: ReadonlySet<string>, extent: Rect, ctx: Context): Campus['city'] {
  let raised = 0;
  const blocks = [...ctx.byId.values()].flatMap((f) => {
    const tags = f.properties.tags;
    if (used.has(f.id) || isBridge(tags) || tags.building === 'roof') return [];
    if (tags.building === undefined && tags['building:part'] === undefined) return [];
    const rings = shape(f, ctx).outers.filter((ring) => inRect(centroid(ring), extent));
    if (rings.length === 0) return [];
    checkHeightTags(f, ctx, 'city', false);
    const h = heightOf(tags);
    if (!h) return [];
    if (h.base > 0) {
      raised++;
      return [];
    }
    return rings.map((ring) => ({ outline: flat(ring), top: h.top }));
  });
  if (raised > 0) {
    ctx.notes.push(
      `city: skipped ${plural(raised, 'raised block')} (the city layer has no base, so it would stand on the ground)`,
    );
  }
  return blocks;
}

/** Streets, roads, walkways and the LRT, cut at the edge of the map. */
function paths(extent: Rect, ctx: Context): CampusPath[] {
  const areas = [...ctx.byId.values()].filter(
    (f) => f.properties.tags.highway !== undefined && f.geometry.type !== 'LineString' && f.geometry.type !== 'Point',
  );
  if (areas.length > 0)
    ctx.notes.push(`paths: skipped ${plural(areas.length, 'area')} (${areas.map((f) => f.id).join(', ')})`);
  return [...ctx.byId.values()].flatMap((f) => {
    if (f.geometry.type !== 'LineString') return [];
    const tags = f.properties.tags;
    const kind = tags.railway === 'light_rail' ? 'rail' : PATH_KINDS[tags.highway ?? ''];
    if (!kind) return [];
    const name = tags.name;
    return clipLine(f.geometry.coordinates.map(ctx.toMeters), extent).map((piece) => ({
      kind,
      ...(name !== undefined && { name }),
      line: flat(piece),
    }));
  });
}

export function compileCampus(sources: readonly BuildingSource[], snapshot: Snapshot): CompileResult {
  const { toMeters } = projection(ORIGIN);
  const ctx: Context = { toMeters, byId: new Map(snapshot.features.map((f) => [f.id, f])), errors: [], notes: [] };
  ctx.errors.push(...prefixClashes(sources).map((clash) => `prefix ${clash}`));

  const listed = listedFeatures(sources, ctx);
  const outlines = new Map([...listed].map(([slug, fs]) => [slug, fs.flatMap((f) => shape(f, ctx).outers)]));
  const parts = assignParts(outlines, ctx);
  const buildings = sources.map((b) => compileBuilding(b, listed.get(b.slug) ?? [], parts.get(b.slug) ?? [], ctx));

  const rings = campusRings(outlines, ctx);
  const extent = rings.length > 0 ? expand(boundsOf(rings.flat()), MARGIN) : expand(boundsOf([[0, 0]]), MARGIN);
  const used = new Set([...listed.values(), ...parts.values()].flat().map((f) => f.id));

  const campus = {
    snapshot: snapshot.snapshot,
    attribution: ATTRIBUTION,
    origin: { ...ORIGIN },
    campus: rings.map(flat),
    buildings,
    bridges: bridges(outlines, ctx),
    city: city(used, extent, ctx),
    paths: paths(extent, ctx),
  };
  const checked = campusSchema.safeParse(campus);
  if (!checked.success) {
    ctx.errors.push(...checked.error.issues.map((i) => `campus.json ${i.path.join('.')}: ${i.message}`));
  }
  return {
    campus: ctx.errors.length === 0 && checked.success ? checked.data : null,
    errors: ctx.errors,
    notes: ctx.notes,
  };
}
