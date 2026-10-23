// The exit choice in Route options (8c-2): which doors a student can leave From's building by, and which one the
// route took. A wrong list offers a door of another building; a wrong "taken" names the wrong door. Exact values.
import { describe, expect, it } from 'vitest';
import type { Entrance } from '@/shared/data/campus';
import type { From, Leg, Route, WalkEnd } from '@/shared/data/route';
import { exitChoices, takenLine } from './exits';

const door = (building: string, kind: Entrance['kind'], point: number, name?: string): Entrance => ({
  building,
  kind,
  point,
  verified: true,
  ...(name === undefined ? {} : { name }),
});

// A small list for the last case: STRC has a main and a side door.
const small: Entrance[] = [door('andrew', 'main', 1), door('strc', 'main', 2), door('strc', 'side', 3)];
// Real-shaped: Velasco at 4 and 5, St Joseph at 9 to 11, Miguel at 6 (campus.json order).
const real: Entrance[] = [
  door('a', 'main', 0),
  door('b', 'main', 1),
  door('c', 'main', 2),
  door('d', 'main', 3),
  door('velasco', 'main', 4, 'facing CADS'),
  door('velasco', 'main', 5, 'facing Agno'),
  door('miguel', 'main', 6),
  door('e', 'main', 7),
  door('f', 'main', 8),
  door('st-joseph', 'side', 9, 'facing Miguel'),
  door('st-joseph', 'main', 10),
  door('st-joseph', 'side', 11, 'facing SJ Walk'),
];

const at = [0, 0] as const;
const gateEnd: WalkEnd = { kind: 'gate', gate: 'gate-1', name: 'Gate 1', at };
const doorEnd = (building: string, entrance?: number): WalkEnd => ({
  kind: 'door',
  building,
  door: 'main',
  ...(entrance === undefined ? {} : { entrance }),
  verified: true,
  at,
});
const walk = (from: WalkEnd, to: WalkEnd): Leg => ({ kind: 'walk', from, to, path: [at, at], meters: 10, seconds: 8 });
const routeOf = (legs: Leg[]): Route => ({ legs, steps: [], meters: 10, seconds: 8 });
const floors: Leg = { kind: 'floors', building: 'velasco', from: 3, to: 1, by: 'stairs', seconds: 30 };

const room: From = { kind: 'room', code: 'V301' };
const building: From = { kind: 'building', building: 'velasco', floor: 3 };

describe('exitChoices', () => {
  it('lists the two Velasco doors and the one taken, for a room From', () => {
    const route = routeOf([floors, walk(doorEnd('velasco', 5), doorEnd('strc', 1))]);
    expect(exitChoices(route, room, real)).toEqual({
      building: 'velasco',
      doors: [
        { entrance: 4, label: 'Main entrance facing CADS' },
        { entrance: 5, label: 'Main entrance facing Agno' },
      ],
      taken: 5,
    });
  });

  it('works for a building From too', () => {
    const route = routeOf([floors, walk(doorEnd('velasco', 4), doorEnd('strc', 1))]);
    expect(exitChoices(route, building, real)?.taken).toBe(4);
  });

  it('lists all three St Joseph doors in campus order', () => {
    const route = routeOf([walk(doorEnd('st-joseph', 10), doorEnd('strc', 1))]);
    expect(exitChoices(route, { kind: 'room', code: 'SJ201' }, real)).toEqual({
      building: 'st-joseph',
      doors: [
        { entrance: 9, label: 'Side entrance facing Miguel' },
        { entrance: 10, label: 'Main entrance' },
        { entrance: 11, label: 'Side entrance facing SJ Walk' },
      ],
      taken: 10,
    });
  });

  it('leaves taken unknown when the door has no index', () => {
    const route = routeOf([walk(doorEnd('velasco'), doorEnd('strc', 1))]);
    expect(exitChoices(route, room, real)?.taken).toBeUndefined();
  });

  it('is null for a gate From', () => {
    const route = routeOf([walk(gateEnd, doorEnd('velasco', 5))]);
    expect(exitChoices(route, { kind: 'gate', gate: 'gate-1' }, real)).toBeNull();
  });

  it('is null when From stands at an entrance', () => {
    const route = routeOf([walk(doorEnd('velasco', 5), doorEnd('strc', 1))]);
    const at5: From = { kind: 'building', building: 'velasco', floor: 1, spot: { kind: 'entrance', entrance: 5 } };
    expect(exitChoices(route, at5, real)).toBeNull();
  });

  it('keeps the choice for a stairs spot', () => {
    const route = routeOf([walk(doorEnd('velasco', 5), doorEnd('strc', 1))]);
    const stairs: From = { ...building, spot: { kind: 'vertical', id: 'east-stairs' } };
    expect(exitChoices(route, stairs, real)?.taken).toBe(5);
  });

  it('is null when the route has no walk leg', () => {
    expect(exitChoices(routeOf([floors]), room, real)).toBeNull();
  });

  it('is null when the walk does not start at a door', () => {
    const route = routeOf([walk(gateEnd, doorEnd('velasco', 5))]);
    expect(exitChoices(route, room, real)).toBeNull();
  });

  it('is null when the building has one door', () => {
    const route = routeOf([walk(doorEnd('miguel', 6), doorEnd('strc', 1))]);
    expect(exitChoices(route, room, real)).toBeNull();
  });

  it('is null when the building has no doors in the data', () => {
    const route = routeOf([walk(doorEnd('nowhere', 0), doorEnd('strc', 1))]);
    expect(exitChoices(route, room, real)).toBeNull();
  });

  it('counts only the first walk leg', () => {
    const route = routeOf([walk(doorEnd('velasco', 4), doorEnd('strc', 1)), walk(doorEnd('miguel', 6), gateEnd)]);
    expect(exitChoices(route, room, real)?.building).toBe('velasco');
  });

  it('uses the entrances it is given, not another list', () => {
    const route = routeOf([walk(doorEnd('strc', 1), doorEnd('andrew', 0))]);
    expect(exitChoices(route, room, small)?.doors).toEqual([
      { entrance: 1, label: 'Main entrance' },
      { entrance: 2, label: 'Side entrance' },
    ]);
  });
});

describe('takenLine', () => {
  const choices = {
    building: 'velasco',
    doors: [
      { entrance: 4, label: 'Main entrance facing CADS' },
      { entrance: 5, label: 'Main entrance facing Agno' },
    ],
    taken: 5,
  };

  it('names the door the quickest route took', () => {
    expect(takenLine(choices, undefined)).toBe('Quickest is the main entrance facing Agno.');
  });

  it('is null when a door is chosen', () => {
    expect(takenLine(choices, 4)).toBeNull();
  });

  it('is null when the taken door is unknown or not listed', () => {
    expect(takenLine({ ...choices, taken: undefined }, undefined)).toBeNull();
    expect(takenLine({ ...choices, taken: 99 }, undefined)).toBeNull();
  });
});
