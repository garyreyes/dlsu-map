// Which buildings' floor files a trip loads (D41) has one right answer. Too few and the route silently stops at the
// door when it could have gone inside, which looks like a normal route; too many and every trip fetches files the
// router never reads. Where "you are here" goes has one too: a dot on the wrong building or floor sends the student
// the wrong way before the first step. Exact values throughout.
import { describe, expect, it } from 'vitest';
import type { From, To } from '@/shared/data/route';
import { hereOf, tripBuildings } from './trip-places';

const rooms = {
  rooms: [
    { code: 'AG1104', building: 'andrew', floor: 11 },
    { code: 'ST311', building: 'strc', floor: 3 },
    { code: 'ST305', building: 'strc', floor: 3 },
    { code: 'VL313', building: 'velasco', floor: 3 },
  ],
};

const room = (code: string) => ({ kind: 'room', code }) as const;
const toRoom = (code: string): To => ({ kind: 'room', code });
const gate: From = { kind: 'gate', gate: 'gate-2' };

describe('tripBuildings', () => {
  it('loads the From room’s building and the To room’s building', () => {
    expect(tripBuildings(room('AG1104'), toRoom('ST311'), rooms)).toEqual(['andrew', 'strc']);
  });

  it('loads only the To room’s building from a gate', () => {
    expect(tripBuildings(gate, toRoom('ST311'), rooms)).toEqual(['strc']);
  });

  it('loads nothing for a building as To, which ends at its door', () => {
    expect(tripBuildings(gate, { kind: 'building', building: 'strc' }, rooms)).toEqual([]);
    expect(tripBuildings(room('AG1104'), { kind: 'building', building: 'strc' }, rooms)).toEqual(['andrew']);
  });

  it('loads a tapped building on an upper floor, which starts at its elevator lobby', () => {
    const from: From = { kind: 'building', building: 'velasco', floor: 4 };
    expect(tripBuildings(from, toRoom('ST311'), rooms)).toEqual(['velasco', 'strc']);
  });

  it('skips a tapped building on G, which starts at its main entrance', () => {
    const from: From = { kind: 'building', building: 'velasco', floor: 1 };
    expect(tripBuildings(from, toRoom('ST311'), rooms)).toEqual(['strc']);
  });

  it('loads a shared building once', () => {
    expect(tripBuildings(room('ST305'), toRoom('ST311'), rooms)).toEqual(['strc']);
    const fromG: From = { kind: 'building', building: 'strc', floor: 1 };
    expect(tripBuildings(fromG, toRoom('ST311'), rooms)).toEqual(['strc']);
  });

  it('loads nothing for a code that isn’t in the room list', () => {
    expect(tripBuildings(room('ST999'), toRoom('XX101'), rooms)).toEqual([]);
  });
});

describe('hereOf', () => {
  // Gate 2 is walk point 1, Agno point 2: points are flat x, y pairs.
  const campus = {
    walk: { points: [0, 0, 66.5, 50.4, -12, 310] },
    gates: [
      { id: 'gate-2', point: 1 },
      { id: 'agno', point: 2 },
    ],
  };

  it('puts a room on its building and floor', () => {
    expect(hereOf(room('AG1104'), rooms, campus)).toEqual({ kind: 'floor', building: 'andrew', floor: 11 });
  });

  it('puts a tapped building on its floor', () => {
    expect(hereOf({ kind: 'building', building: 'velasco', floor: 4 }, rooms, campus)).toEqual({
      kind: 'floor',
      building: 'velasco',
      floor: 4,
    });
  });

  it('puts a gate on the ground at its point', () => {
    expect(hereOf(gate, rooms, campus)).toEqual({ kind: 'ground', at: [66.5, 50.4] });
    expect(hereOf({ kind: 'gate', gate: 'agno' }, rooms, campus)).toEqual({ kind: 'ground', at: [-12, 310] });
  });

  it('puts nothing for a room or gate that isn’t in the data', () => {
    expect(hereOf(room('ST999'), rooms, campus)).toBeNull();
    expect(hereOf({ kind: 'gate', gate: 'gate-9' }, rooms, campus)).toBeNull();
  });
});
