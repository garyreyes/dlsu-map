// The router (4b) on the real campus, compiled from data-src as the build does. Distances are bounded by geometry
// rather than pinned, so an OSM refresh doesn't break them; what is pinned was checked by hand on 2026-10-21: the 8
// Taft crosswalks, and that each gate named after a building is right by it.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';
import { toPrefixTable } from '../src/shared/data/prefix-table.ts';
import type { Leg, XY } from '../src/shared/data/route.ts';
import { compileCampus, type Snapshot } from '../scripts/compile/campus.ts';
import { entranceSourcesSchema, gateSourcesSchema } from '../scripts/compile/campus-walk.ts';
import { compileRooms } from '../scripts/compile/rooms.ts';
import { createRouter } from '../src/features/routing/router.ts';
import { buildWalkGraph, cheapestWalk, crossingWaits, type WalkGraph } from '../src/features/routing/walk-graph.ts';

const text = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path: string): unknown => JSON.parse(text(path));
const { campus } = compileCampus(
  buildingSourcesSchema.parse(json('data-src/campus/buildings.json')),
  json('data-src/campus/osm/snapshot-2026-10-20.geojson') as Snapshot,
  {
    gates: gateSourcesSchema.parse(json('data-src/campus/gates.json')),
    entrances: entranceSourcesSchema.parse(json('data-src/campus/entrances.json')),
  },
);
if (campus === null) throw new Error('the real campus did not compile; see tests/compile-data.test.ts');
const lists = readdirSync(new URL('../data-src/rooms/', import.meta.url))
  .filter((f) => f.endsWith('.csv'))
  .map((f) => ({ building: f.replace(/\.csv$/, ''), file: f, text: text(`data-src/rooms/${f}`) }));
const { rooms } = compileRooms(
  lists,
  toPrefixTable(campus.buildings),
  new Map(campus.buildings.map((b) => [b.slug, b.levels])),
);
if (rooms === null) throw new Error('the real rooms did not compile; see tests/compile-rooms.test.ts');
const route = createRouter(campus, rooms);

const full = campus.buildings.filter((b) => b.tier === 'full').map((b) => b.slug);
const straight = ([ax, ay]: XY, [bx, by]: XY): number => Math.hypot(bx - ax, by - ay);
const onlyWalk = (legs: readonly Leg[] | false) => {
  if (legs === false || legs.length !== 1 || legs[0]?.kind !== 'walk') throw new Error('expected one walk leg');
  return legs[0];
};

describe('routing on the real campus', () => {
  it('waits 45 s at each of the 8 Taft Avenue crosswalks, and nowhere else', () => {
    expect([...crossingWaits(campus.walk).values()]).toStrictEqual(Array<number>(8).fill(45));
  });

  it.each(campus.gates.map((g) => [g.id]))(
    'reaches every full building from %s, no shorter than a straight line',
    (id) => {
      for (const building of full) {
        const result = route({ kind: 'gate', gate: id }, { kind: 'building', building }, 'auto');
        const walk = onlyWalk(result.ok && result.route.legs);
        expect(walk.from).toMatchObject({ kind: 'gate', gate: id });
        expect(walk.to).toMatchObject({ kind: 'door', building });
        expect(walk.path[0]).toStrictEqual(walk.from.at);
        expect(walk.path.at(-1)).toStrictEqual(walk.to.at);
        expect(walk.meters).toBeGreaterThanOrEqual(Math.floor(straight(walk.from.at, walk.to.at)));
        // Every gate and full building is on the campus side of Taft (D32), so these walks never wait.
        expect(Math.abs(walk.seconds - walk.meters / 1.3)).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each([
    ['gate-3', 'velasco'],
    ['gate-4a', 'gokongwei'],
    ['gate-4b', 'gokongwei'],
    ['gate-5a', 'andrew'],
    ['gate-5b', 'andrew'],
    ['gate-6', 'razon'],
  ])('reaches the building %s is named after within 60 m (%s)', (id, building) => {
    const result = route({ kind: 'gate', gate: id }, { kind: 'building', building }, 'auto');
    expect(onlyWalk(result.ok && result.route.legs).meters).toBeLessThanOrEqual(60);
  });

  it('finds the cheapest walk: A* agrees with a plain Dijkstra from every gate to every door', () => {
    const g = buildWalkGraph(campus.walk);
    for (const gate of campus.gates) {
      const best = dijkstra(g, campus.walk.links, campus.walk.points.length / 2, gate.point);
      for (const door of campus.entrances) {
        const walk = cheapestWalk(g, [gate.point], [door.point]);
        expect(costOf(g, walk?.points ?? [])).toBeCloseTo(best[door.point] ?? Number.NaN, 6);
      }
    }
  });

  it(`reaches all ${String(rooms.rooms.length)} rooms from Gate 1, ending on the room’s floor`, () => {
    for (const r of rooms.rooms) {
      const result = route({ kind: 'gate', gate: 'gate-1' }, { kind: 'room', code: r.code }, 'auto');
      const last = result.ok ? result.route.legs.at(-1) : undefined;
      expect(last).toMatchObject(
        r.floor === 1
          ? { kind: 'walk', to: { building: r.building } }
          : { kind: 'floors', building: r.building, to: r.floor },
      );
    }
  });

  it('takes VL501 → ST311 on Auto: Velasco elevator down 4, the walk, STRC stairs up 2', () => {
    const result = route({ kind: 'room', code: 'VL501' }, { kind: 'room', code: 'ST311' }, 'auto');
    const legs = result.ok ? result.route.legs : [];
    expect(legs[0]).toStrictEqual({
      kind: 'floors',
      building: 'velasco',
      from: 5,
      to: 1,
      by: 'elevator',
      seconds: 200,
    });
    expect(legs[1]).toMatchObject({ kind: 'walk', from: { building: 'velasco' }, to: { building: 'strc' } });
    expect(legs[2]).toStrictEqual({ kind: 'floors', building: 'strc', from: 1, to: 3, by: 'stairs', seconds: 40 });
    const walk = legs[1]?.kind === 'walk' ? legs[1] : undefined;
    const line = walk === undefined ? 0 : straight(walk.from.at, walk.to.at);
    expect(walk?.meters).toBeGreaterThanOrEqual(Math.floor(line));
    expect(walk?.meters).toBeLessThanOrEqual(3 * line);
    expect(result.ok && result.route.seconds).toBe(200 + (walk?.seconds ?? 0) + 40);
  });
});

/** The cost of a walk, summed the way the router sums it. */
function costOf(g: WalkGraph, points: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += g.link(points[i - 1] ?? -1, points[i] ?? -1)?.cost ?? Infinity;
  return total;
}

/** Plain O(n²) Dijkstra over the same link costs: slow, simple, and independent of ngraph. */
function dijkstra(g: WalkGraph, links: readonly (readonly number[])[], n: number, source: number): number[] {
  const best = Array<number>(n).fill(Infinity);
  const done = Array<boolean>(n).fill(false);
  best[source] = 0;
  for (let round = 0; round < n; round++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (!done[v] && (u === -1 || (best[v] ?? Infinity) < (best[u] ?? Infinity))) u = v;
    if (u === -1 || best[u] === Infinity) break;
    done[u] = true;
    for (const [a = -1, b = -1] of links) {
      const other = a === u ? b : b === u ? a : -1;
      const cost = other === -1 ? undefined : g.link(u, other)?.cost;
      if (cost !== undefined && (best[u] ?? Infinity) + cost < (best[other] ?? Infinity))
        best[other] = (best[u] ?? 0) + cost;
    }
  }
  return best;
}
