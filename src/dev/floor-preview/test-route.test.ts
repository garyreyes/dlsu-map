import { describe, expect, it } from 'vitest';
import { ELEVATOR_PER_FLOOR, ELEVATOR_WAIT, STAIRS_PER_FLOOR, WALK_SPEED } from '@/shared/config/routing';
import type { Indoor } from '@/shared/data/indoor';
import { testRoute } from './test-route';

type Graph = Indoor['graph'];

/**
 * Floor 1: an entrance (0) on a hallway 0–1–2 along y = 0, and a long way round 0–3–2 via (50, 40). Point 4 is a
 * door 3 m off point 2. Floor 2: point 5 above point 1, a hallway on to 6, and door 7 off it. Stairs and an
 * elevator join 1 and 5.
 */
const graph: Graph = {
  points: [0, 0, 50, 0, 100, 0, 50, 40, 100, 3, 50, 0, 60, 0, 60, 4],
  floors: [1, 1, 1, 1, 1, 2, 2, 2],
  links: [
    [0, 1, 'hall'],
    [1, 2, 'hall'],
    [0, 3, 'hall'],
    [3, 2, 'hall'],
    [2, 4, 'door'],
    [1, 5, 'stairs'],
    [5, 6, 'hall'],
    [6, 7, 'door'],
  ],
};

describe('testRoute', () => {
  it('walks the shorter way, from the start to the door', () => {
    const route = testRoute(graph, 0, [4]);
    expect(route?.points).toStrictEqual([0, 1, 2, 4]);
    expect(route?.seconds).toBeCloseTo(103 / WALK_SPEED, 6);
  });

  it('ends at the nearest of the room’s doors', () => {
    // Door 4 is 103 m away; door 7, up the stairs, is 50 + 10 + 4 m plus a floor.
    expect(testRoute(graph, 0, [4, 7])?.points).toStrictEqual([0, 1, 5, 6, 7]);
    expect(testRoute(graph, 0, [7, 4])?.points).toStrictEqual([0, 1, 5, 6, 7]);
  });

  it('charges the stairs by the floors they cross, and an elevator its wait as well', () => {
    const walk = 64 / WALK_SPEED;
    expect(testRoute(graph, 0, [7])?.seconds).toBeCloseTo(walk + STAIRS_PER_FLOOR, 6);
    const lift: Graph = { ...graph, links: graph.links.map((l) => (l[2] === 'stairs' ? [1, 5, 'elevator'] : l)) };
    expect(testRoute(lift, 0, [7])?.seconds).toBeCloseTo(walk + ELEVATOR_WAIT + ELEVATOR_PER_FLOOR, 6);
  });

  it('charges an elevator’s wait once per ride, as the compiler links its stops floor to floor', () => {
    // Floor 3 above floor 2's point 5: a riser 1–5 and another 5–8, as indoor-links.ts writes them.
    const tower: Graph = {
      points: [...graph.points, 50, 0, 50, 3],
      floors: [...graph.floors, 3, 3],
      links: [
        [0, 1, 'hall'],
        [1, 5, 'elevator'],
        [5, 8, 'elevator'],
        [8, 9, 'door'],
      ],
    };
    const route = testRoute(tower, 0, [9]);
    expect(route?.points).toStrictEqual([0, 1, 5, 8, 9]);
    expect(route?.seconds).toBeCloseTo(53 / WALK_SPEED + ELEVATOR_WAIT + 2 * ELEVATOR_PER_FLOOR, 6);
  });

  it('takes the stairs over a faster-looking elevator ride when the wait makes it slower', () => {
    const both: Graph = {
      ...graph,
      points: [...graph.points, 0, 0, 0, 0],
      floors: [...graph.floors, 1, 2],
      links: [...graph.links, [0, 8, 'hall'], [8, 9, 'elevator'], [9, 6, 'hall']],
    };
    expect(testRoute(both, 0, [7])?.points).toStrictEqual([0, 1, 5, 6, 7]);
  });

  it('is just the start when the start is the door', () => {
    expect(testRoute(graph, 4, [4])).toStrictEqual({ points: [4], seconds: 0 });
  });

  it('is null when nothing joins them, or there are no doors', () => {
    const cut: Graph = { ...graph, links: graph.links.filter((l) => l[2] !== 'stairs') };
    expect(testRoute(cut, 0, [7])).toBeNull();
    expect(testRoute(graph, 0, [])).toBeNull();
  });
});
