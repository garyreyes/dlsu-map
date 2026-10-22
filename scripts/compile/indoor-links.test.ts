// linkBuilding: one building's labelled floors (already in meters) → rooms, stairs, elevators and entrances on the
// indoor graph, and the build checks of ARCHITECTURE §3.4 (8a). Exact messages: each one is what a later session reads
// to fix a floor file.
import { describe, expect, it } from 'vitest';
import type { VerticalSource } from '../../src/shared/data/floor-source.ts';
import { linkBuilding, type LabelledFloor, type LinkInput } from './indoor-links.ts';

const path = (n: number) => `data-src/floors/box/0${String(n)}.json`;
const VERTICALS = 'data-src/floors/box/verticals.json';

/** A 40 m hallway along y = 5 on each floor given. */
const hallFloor = (n: number, change: Partial<LabelledFloor> = {}): LabelledFloor => ({
  path: path(n),
  floor: n,
  hallways: [
    [
      [0, 5],
      [40, 5],
    ],
  ],
  ...change,
});

const ROOMS = [
  { code: 'BX101', floor: 1 },
  { code: 'BX103', floor: 1 },
  { code: 'BX201', floor: 2 },
];

const stairs: VerticalSource = { id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4] };

function input(change: Partial<LinkInput> = {}): LinkInput {
  return {
    slug: 'box',
    levels: 4,
    floors: [
      hallFloor(1, {
        rooms: [{ codes: ['BX101', 'BX103'], label: [10, 8], doors: [[10, 6]] }],
        verticals: [{ id: 'east-stairs', point: [39, 6] }],
      }),
      hallFloor(2, {
        rooms: [{ codes: ['BX201'], label: [20, 2], doors: [[20, 4]] }],
        verticals: [{ id: 'east-stairs', point: [39, 6] }],
      }),
    ],
    verticals: { path: VERTICALS, list: [stairs] },
    rooms: ROOMS,
    entrances: [{ index: 3, kind: 'main', point: [0, 7] }],
    ...change,
  };
}

const at = (points: readonly number[], i: number | undefined) => [points[2 * (i ?? -1)], points[2 * (i ?? -1) + 1]];

describe('linkBuilding', () => {
  it('puts each code of a room on its door, and links floors by their stairs', () => {
    const out = linkBuilding(input());
    expect(out.errors).toStrictEqual([]);
    expect(out.rooms.map((r) => [r.code, r.floor, r.label, r.doors.map((d) => at(out.graph.points, d))])).toStrictEqual(
      [
        ['BX101', 1, [10, 8], [[10, 6]]],
        ['BX103', 1, [10, 8], [[10, 6]]],
        ['BX201', 2, [20, 2], [[20, 4]]],
      ],
    );
    const [east] = out.verticals;
    expect(east?.stops.map((s) => s.floor)).toStrictEqual([1, 2]);
    expect(out.graph.links).toContainEqual([east?.stops[0]?.point, east?.stops[1]?.point, 'stairs']);
    // Only the links between floors are stairs: walking from the hallway to the stair is a hall link on its floor.
    expect(out.graph.links.filter(([, , kind]) => kind === 'stairs')).toHaveLength(1);
    expect(out.entrances).toHaveLength(1);
    expect(out.entrances[0]?.entrance).toBe(3);
    expect(at(out.graph.points, out.entrances[0]?.point)).toStrictEqual([0, 7]);
  });

  it('links an elevator straight past a floor it skips', () => {
    const elevator: VerticalSource = { id: 'lift', kind: 'elevator', servesFloors: [1, 3] };
    const lift = [{ id: 'lift', point: [30, 5] as const }];
    const out = linkBuilding(
      input({
        floors: [
          hallFloor(1, { rooms: [], verticals: lift }),
          hallFloor(2, { rooms: [], verticals: [] }),
          hallFloor(3, { rooms: [], verticals: lift }),
        ],
        verticals: { path: VERTICALS, list: [elevator] },
        rooms: [],
      }),
    );
    expect(out.errors).toStrictEqual([]);
    const stops = out.verticals[0]?.stops ?? [];
    expect(stops.map((s) => s.floor)).toStrictEqual([1, 3]);
    expect(out.graph.links).toContainEqual([stops[0]?.point, stops[1]?.point, 'elevator']);
  });

  it('asks nothing of a room with its own floor label, such as a mezzanine no sign draws', () => {
    const mezz = { code: 'BX151', floor: 1, floorLabel: 'G Mezz' };
    expect(linkBuilding(input({ rooms: [...ROOMS, mezz] })).errors).toStrictEqual([]);
    const placed = hallFloor(1, {
      rooms: [
        { codes: ['BX101', 'BX103'], label: [10, 8], doors: [[10, 6]] },
        { codes: ['BX151'], label: [30, 8], doors: [[30, 6]] },
      ],
    });
    const out = linkBuilding(input({ floors: [placed], rooms: [...ROOMS, mezz] }));
    expect(out.errors).toStrictEqual([]);
    expect(out.rooms.map((r) => r.code)).toStrictEqual(['BX101', 'BX103', 'BX151']);
  });

  it('asks nothing of a floor that is not labelled yet', () => {
    const out = linkBuilding(input({ floors: [hallFloor(1), hallFloor(2)] }));
    expect(out.errors).toStrictEqual([]);
    expect(out.rooms).toStrictEqual([]);
    expect(out.verticals).toStrictEqual([{ ...stairs, stops: [] }]);
  });

  it.each<[string, Partial<LinkInput>, string]>([
    [
      'a room on another floor',
      { floors: [hallFloor(1, { rooms: [{ codes: ['BX101', 'BX103', 'BX201'], label: [10, 8], doors: [[10, 6]] }] })] },
      `${path(1)}: BX201 is on floor 2's room list, not floor 1's`,
    ],
    [
      'a room not on the list',
      { floors: [hallFloor(1, { rooms: [{ codes: ['BX101', 'BX103', 'BX999'], label: [10, 8], doors: [[10, 6]] }] })] },
      `${path(1)}: BX999 is not on box's room list`,
    ],
    [
      'a room left out of a labelled floor',
      { floors: [hallFloor(1, { rooms: [{ codes: ['BX101'], label: [10, 8], doors: [[10, 6]] }] })] },
      `${path(1)}: BX103 is on floor 1's room list but not placed`,
    ],
    [
      'a door far from the hallway',
      { floors: [hallFloor(1, { rooms: [{ codes: ['BX101', 'BX103'], label: [10, 8], doors: [[10, 9]] }] })] },
      `${path(1)}: BX101's door is 4 m from the nearest hallway (3 m at most)`,
    ],
    [
      'a vertical that is not in verticals.json',
      {
        floors: [hallFloor(1, { verticals: [{ id: 'west-stairs', point: [1, 5] }] })],
        verticals: { path: VERTICALS, list: [] },
      },
      `${path(1)}: west-stairs is not in ${VERTICALS}`,
    ],
    [
      'a vertical on a floor it does not serve',
      {
        floors: [hallFloor(1, { verticals: [{ id: 'lift', point: [30, 5] }] })],
        verticals: { path: VERTICALS, list: [{ id: 'lift', kind: 'elevator', servesFloors: [2, 3] }] },
      },
      `${path(1)}: lift does not stop at floor 1 (${VERTICALS})`,
    ],
    [
      'a vertical left out of a labelled floor',
      { floors: [hallFloor(1, { verticals: [] }), hallFloor(2)] },
      `${path(1)}: east-stairs stops at floor 1 but is not placed`,
    ],
    [
      'a vertical past the top floor',
      { verticals: { path: VERTICALS, list: [{ ...stairs, servesFloors: [1, 2, 5] }] } },
      `${VERTICALS}: east-stairs serves floor 5, but box has 4 floors`,
    ],
    [
      'a vertical far from the hallway',
      { floors: [hallFloor(1, { verticals: [{ id: 'east-stairs', point: [39, 9.5] }] }), hallFloor(2)] },
      `${path(1)}: east-stairs is 4.5 m from the nearest hallway (3 m at most)`,
    ],
    [
      'an entrance far from the G hallway',
      { entrances: [{ index: 3, kind: 'main', point: [0, 12] }] },
      `box's main entrance is 7 m from G's nearest hallway (5 m at most)`,
    ],
    [
      'an entrance on a G floor with no hallway',
      { floors: [hallFloor(1, { hallways: [] })] },
      `box's main entrance is on a G floor with no hallway`,
    ],
    [
      'no main entrance to check rooms from',
      { entrances: [{ index: 3, kind: 'side', point: [0, 7] }] },
      'box: no main entrance in campus.json, so no room can be checked for reach',
    ],
    [
      'a room that cannot be reached from the main entrance',
      {
        floors: [
          hallFloor(1, { rooms: [{ codes: ['BX101', 'BX103'], label: [10, 8], doors: [[10, 6]] }] }),
          hallFloor(2, { rooms: [{ codes: ['BX201'], label: [20, 2], doors: [[20, 4]] }] }),
        ],
      },
      `box: can't reach BX201 from the main entrance`,
    ],
  ])('fails the build on %s', (_, change, message) => {
    const out = linkBuilding(input(change));
    expect(out.errors).toContain(message);
    expect(out.errors).toHaveLength(1);
  });

  it('only notes that reach is unchecked while G has no floor file', () => {
    const out = linkBuilding(
      input({
        floors: [
          hallFloor(2, {
            rooms: [{ codes: ['BX201'], label: [20, 2], doors: [[20, 4]] }],
            verticals: [{ id: 'east-stairs', point: [39, 6] }],
          }),
        ],
      }),
    );
    expect(out.errors).toStrictEqual([]);
    expect(out.entrances).toStrictEqual([]);
    expect(out.notes).toContain('box: rooms not checked for reach, since G has no floor file yet');
  });

  it('notes a floor whose hallways are in pieces, for cleanup', () => {
    const pieces = hallFloor(1, {
      hallways: [
        [
          [0, 5],
          [18, 5],
        ],
        [
          [22, 5],
          [40, 5],
        ],
      ],
    });
    expect(linkBuilding(input({ floors: [pieces] })).notes).toContain('box floor 1: hallways in 2 pieces');
  });
});
