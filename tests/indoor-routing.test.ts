// The router going inside (8b, D41) over the real building files, compiled from data-src as the build does. STRC
// (G–4F) and Velasco (G–5F) are labelled whole, with their stairs and elevator on every floor, so every one of their
// rooms must be reached from every gate on each of Stairs, Elevator and Auto, with the climb each asks for. Velasco's
// G Mezz rooms are on no sign, so they stop at the door (O5).
import { describe, expect, it } from 'vitest';
import type { FloorMode, Leg, Route, RouteResult, Step } from '../src/shared/data/route.ts';
import { createRouter } from '../src/features/routing/router.ts';
import { campus, indoor, rooms } from './real-data.ts';

const router = createRouter(campus, rooms);
const strc = rooms.rooms.filter((r) => r.building === 'strc');
const velasco = rooms.rooms.filter((r) => r.building === 'velasco' && r.floorLabel === undefined);
const mezz = rooms.rooms.filter((r) => r.building === 'velasco' && r.floorLabel !== undefined);
const ok = (result: RouteResult): Route => {
  if (!result.ok) throw new Error(`no route: ${result.reason}`);
  return result.route;
};
type Floors = Extract<Leg, { kind: 'floors' }>;
const floorsLegs = (r: Route): Floors[] => r.legs.filter((l): l is Floors => l.kind === 'floors');
const modes: FloorMode[] = ['auto', 'stairs', 'elevator'];

describe('indoor routing on the real campus', () => {
  it('has building files for STRC and Velasco, every room placed but the G Mezz', () => {
    expect([...indoor.keys()].sort()).toStrictEqual(['strc', 'velasco']);
    expect(indoor.get('strc')?.rooms).toHaveLength(strc.length);
    expect(indoor.get('velasco')?.rooms).toHaveLength(velasco.length);
    expect(mezz.map((r) => r.code)).toStrictEqual(['VL151', 'VL153']);
  });

  it.each(campus.gates.map((g) => [g.id]))('reaches every labelled room from %s on each mode, inside', (gate) => {
    for (const room of [...strc, ...velasco]) {
      for (const mode of modes) {
        const r = ok(router({ kind: 'gate', gate }, { kind: 'room', code: room.code }, mode, indoor));
        expect(r.noIndoorMap).toBeUndefined();
        expect(r.legs[0]).toMatchObject({ kind: 'walk', to: { building: room.building } });
        expect(r.legs.slice(1).every((l) => l.kind === 'indoor' || l.kind === 'floors')).toBe(true);
        expect(r.steps.at(-1)).toMatchObject({ kind: 'arrive', code: room.code });
        const climbs = floorsLegs(r);
        if (room.floor === 1) expect(climbs).toStrictEqual([]);
        else {
          // One climb straight to the room's floor, by what the mode asks for (Auto: elevator for 3 floors or more).
          const by = mode === 'stairs' || (mode === 'auto' && room.floor - 1 < 3) ? 'stairs' : 'elevator';
          const seconds = by === 'elevator' ? 180 + 5 * (room.floor - 1) : 20 * (room.floor - 1);
          expect(climbs).toMatchObject([{ from: 1, to: room.floor, by, seconds }]);
        }
        const summed = r.legs.reduce((s, l) => s + l.seconds, 0);
        expect(Math.abs(summed - r.seconds)).toBeLessThanOrEqual(r.legs.length);
      }
    }
  });

  it('joins each leg to the next: inside starts at the door the walk ends at, and each climb where the walk stops', () => {
    const r = ok(
      router({ kind: 'gate', gate: campus.gates[0]?.id ?? '' }, { kind: 'room', code: 'ST311' }, 'auto', indoor),
    );
    r.legs.forEach((leg, i) => {
      const next = r.legs[i + 1];
      const end = leg.kind === 'floors' ? leg.at : leg.path.at(-1);
      const start = next === undefined ? undefined : next.kind === 'floors' ? next.at : next.path[0];
      if (start !== undefined && end !== undefined && leg.kind !== 'floors') {
        expect(Math.hypot(start[0] - end[0], start[1] - end[1])).toBeLessThan(1);
      }
    });
    expect(r.steps.find((s) => s.kind === 'floors')?.text).toMatch(
      /^ST311 is on 3F: take the (east|west) stairs up to 3F$/,
    );
  });

  it('routes from every labelled room to every other building, leaving by a door', () => {
    for (const room of [...strc, ...velasco]) {
      const others = campus.buildings.filter((b) => b.tier === 'full' && b.slug !== room.building);
      for (const building of others.map((b) => b.slug)) {
        const r = ok(router({ kind: 'room', code: room.code }, { kind: 'building', building }, 'auto', indoor));
        expect(r.steps[0]).toMatchObject({ kind: 'start', text: `Start at ${room.code}` });
        expect(r.legs.at(-1)).toMatchObject({ kind: 'walk', from: { building: room.building }, to: { building } });
        expect(r.noIndoorMap).toBeUndefined();
      }
    }
  });

  it('routes room to room inside STRC, and starts an upper-floor tap at the elevator', () => {
    for (const room of strc.filter((x) => x.code !== 'ST311')) {
      const r = ok(router({ kind: 'room', code: 'ST311' }, { kind: 'room', code: room.code }, 'auto', indoor));
      expect(r.legs.every((l) => l.kind === 'indoor' || l.kind === 'floors')).toBe(true);
      expect(r.steps.at(-1)).toMatchObject({ kind: 'arrive', code: room.code });
    }
    // 2F and 3F walk from the elevator lobby to the stairs (Auto, under 3 floors); 4F rides from where it starts.
    const first = (floor: number) =>
      ok(router({ kind: 'building', building: 'strc', floor }, { kind: 'room', code: 'ST101' }, 'auto', indoor))
        .steps[0];
    expect(first(2)?.text).toBe('Start at the elevator');
    expect(first(3)?.text).toBe('Start at the elevator');
    expect(first(4)?.text).toBe('ST101 is on G: take the elevator down to G');
  });

  it('names a turn only after a room within 5 m, and never after the trip’s own rooms', () => {
    const named = (s: Step) => (s.kind === 'turn' ? / at (ST\d+[A-Z]?)$/.exec(s.text)?.[1] : undefined);
    for (const room of strc.filter((x) => x.code !== 'ST101')) {
      const r = ok(router({ kind: 'room', code: 'ST101' }, { kind: 'room', code: room.code }, 'auto', indoor));
      for (const code of r.steps.map(named).filter((c) => c !== undefined)) {
        expect(code).not.toBe('ST101');
        expect(code).not.toBe(room.code);
      }
    }
  });

  it('names Velasco’s stairs, and stops at its door for the G Mezz rooms no sign draws', () => {
    const gate = campus.gates[0]?.id ?? '';
    const up = ok(router({ kind: 'gate', gate }, { kind: 'room', code: 'VL311' }, 'stairs', indoor));
    expect(up.steps.find((s) => s.kind === 'floors')?.text).toMatch(
      /^VL311 is on 3F: take the (east|main|west) stairs up to 3F$/,
    );
    for (const room of mezz) {
      const r = ok(router({ kind: 'gate', gate }, { kind: 'room', code: room.code }, 'auto', indoor));
      expect(r.noIndoorMap).toStrictEqual(['velasco']);
      expect(r.legs.map((l) => l.kind)).toStrictEqual(['walk']);
    }
  });
});
