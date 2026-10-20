// data-src/campus/gates.json and entrances.json + the OSM snapshot → campus.json's walk network, gates and entrances
// (4a). Builds the network (walk.ts), keeps its biggest piece, then joins gates and entrances to it (attach.ts).
// Pure. Called by compileCampus; tested in walk.test.ts, attach.test.ts and on the real data in
// tests/compile-data.test.ts.
import { z } from 'zod';
import type { Campus } from '../../src/shared/data/campus.ts';
import type { LonLat } from '../../src/shared/geo/project.ts';
import type { Feature } from '../osm-to-geojson.ts';
import { attach, type AttachInput } from './attach.ts';
import { pointInRing, round, type Point, type Rect } from './geometry.ts';
import { nodeKey } from './sidewalks.ts';
import { buildNetwork, isSidewalkStreet, keepLargest } from './walk.ts';

const slug = z.string().regex(/^[a-z0-9-]+$/);

/** data-src/campus/gates.json: the gates students name, each picked by its OSM node. */
export const gateSourcesSchema = z
  .array(z.strictObject({ id: slug, name: z.string().min(1), osm: z.string().regex(/^node\/\d+$/) }))
  .refine((gates) => new Set(gates.map((g) => g.id)).size === gates.length, 'gate ids must be unique');

/** data-src/campus/entrances.json: pins dropped on openstreetmap.org (D30), `verified` once checked on site (11a). */
export const entranceSourcesSchema = z.array(
  z.strictObject({
    building: slug,
    kind: z.enum(['main', 'side', 'back']),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    verified: z.boolean().default(false),
    name: z.string().min(1).optional(),
  }),
);

export interface WalkSources {
  readonly gates: z.infer<typeof gateSourcesSchema>;
  readonly entrances: z.infer<typeof entranceSourcesSchema>;
}
export interface WalkContext {
  readonly features: readonly Feature[];
  readonly byId: ReadonlyMap<string, Feature>;
  readonly toMeters: (c: LonLat) => [number, number];
  readonly extent: Rect;
  /** The campus boundary, to point out pieces of the network dropped inside it. */
  readonly rings: readonly Point[][];
  readonly buildings: AttachInput['buildings'];
  readonly errors: string[];
  readonly notes: string[];
}

/** The gates in the snapshot, with an error for each one that isn't a node there. */
function gateInputs(src: WalkSources, ctx: WalkContext): AttachInput['gates'] {
  return src.gates.flatMap((g) => {
    const f = ctx.byId.get(g.osm);
    if (f?.geometry.type !== 'Point') {
      ctx.errors.push(`gates: ${g.id}: ${g.osm} is not a node in the snapshot`);
      return [];
    }
    const c = f.geometry.coordinates;
    return [{ id: g.id, name: g.name, key: nodeKey(c), point: ctx.toMeters(c) }];
  });
}

/** A note for each dropped piece inside the campus: likely a path OSM left unjoined, worth a look. */
function droppedOnCampus(pieces: readonly Point[][], ctx: WalkContext): void {
  for (const piece of pieces) {
    if (!piece.some((p) => ctx.rings.some((r) => pointInRing(p, r)))) continue;
    const [x, y] = [0, 1].map((i) => round(piece.reduce((s, p) => s + (p[i] ?? 0), 0) / piece.length));
    ctx.notes.push(
      `walk: dropped a ${String(piece.length)}-point piece inside the campus, around ${String(x)}, ${String(y)}`,
    );
  }
}

export function compileWalk(src: WalkSources, ctx: WalkContext): Pick<Campus, 'walk' | 'gates' | 'entrances'> {
  const built = buildNetwork(ctx.features, ctx.toMeters, ctx.extent);
  ctx.notes.push(...built.notes);
  const kept = keepLargest(built.network);
  if (kept.note) ctx.notes.push(kept.note);
  droppedOnCampus(kept.dropped, ctx);
  const barriers = ctx.features.flatMap((f) =>
    f.geometry.type === 'LineString' && isSidewalkStreet(f.properties.tags)
      ? [{ name: f.properties.tags.name ?? '', line: f.geometry.coordinates.map(ctx.toMeters) }]
      : [],
  );
  const result = attach({
    network: kept.network,
    islands: kept.dropped,
    barriers,
    buildings: ctx.buildings,
    gates: gateInputs(src, ctx),
    entrances: src.entrances.map((e) => ({
      building: e.building,
      kind: e.kind,
      point: ctx.toMeters([e.lon, e.lat]),
      verified: e.verified,
      ...(e.name !== undefined && { name: e.name }),
    })),
  });
  ctx.errors.push(...result.errors);
  ctx.notes.push(...result.notes);
  return { walk: result.walk, gates: result.gates, entrances: result.entrances };
}
