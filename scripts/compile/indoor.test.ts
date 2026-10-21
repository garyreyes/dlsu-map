// compileIndoor turns floor files into public/data/buildings/<slug>.json (D36). Exact meters throughout: a floor on
// the wrong volume, at the wrong height or turned round would still look like a floor.
import { describe, expect, it } from 'vitest';
import type { CampusBuilding } from '../../src/shared/data/campus.ts';
import type { FloorSource } from '../../src/shared/data/floor-source.ts';
import { compileIndoor, type FloorFile, type IndoorInputs } from './indoor.ts';

/** 40 m east–west by 10 m north–south, 4 storeys of 3.4 m. */
const box: CampusBuilding = {
  slug: 'box',
  name: 'Box Hall',
  short: 'Box',
  aliases: [],
  tier: 'full',
  prefixes: ['BX'],
  levels: 4,
  volumes: [{ outline: [0, 0, 40, 0, 40, 10, 0, 10], base: 0, top: 13.6 }],
};

/** A 20 m tower (its own outline, floors 1–4) with a 40 m podium part around its foot (floors 1–2). */
const tower: CampusBuilding = {
  ...box,
  slug: 'tower',
  prefixes: ['TW'],
  volumes: [
    { outline: [0, 0, 20, 0, 20, 10, 0, 10], base: 0, top: 13.6 },
    { outline: [0, 0, 40, 0, 40, 10, 0, 10], base: 0, top: 6.8 },
  ],
};

/** The box with a 2 m stair tower rising past its roof (17 m): OSM's levels count the main block, not the tower. */
const stairTower: CampusBuilding = {
  ...box,
  slug: 'stair-tower',
  prefixes: ['SX'],
  volumes: [...box.volumes, { outline: [0, 0, 2, 0, 2, 2, 0, 2], base: 0, top: 17 }],
};

/** The sign's frame as four walls, and one hallway down the middle. */
const OUTER = [
  [0, 0, 1, 0],
  [1, 0, 1, 1],
  [1, 1, 0, 1],
  [0, 1, 0, 0],
];

function file(building: string, floor: number, change: Partial<FloorSource> = {}, path?: string): FloorFile {
  return {
    path: path ?? `data-src/floors/${building}/${String(floor).padStart(2, '0')}.json`,
    floor: {
      building,
      floor,
      extractedFrom: `${building}_0${String(floor)}F.jpg`,
      checked: false,
      plan: { width: 400, height: 100 },
      fit: { turn: 0 },
      walls: OUTER,
      hallways: [[0, 0.5, 1, 0.5]],
      ...change,
    },
  };
}

describe('compileIndoor', () => {
  it('fits a floor onto the outline in meters, at its height', () => {
    const { buildings, errors } = compileIndoor([file('box', 3, { checked: true })], [box]);
    expect(errors).toStrictEqual([]);
    expect(buildings).toStrictEqual([
      {
        building: 'box',
        floors: [
          {
            floor: 3,
            base: 6.8,
            height: 3.4,
            checked: true,
            walls: [
              [0, 10, 40, 10],
              [40, 10, 40, 0],
              [40, 0, 0, 0],
              [0, 0, 0, 10],
            ],
            hallways: [[0, 5, 40, 5]],
          },
        ],
        graph: { points: [0, 5, 40, 5], floors: [3, 3], links: [[0, 1, 'hall']] },
        rooms: [],
        verticals: [],
        entrances: [],
      },
    ]);
  });

  it('turn 180 puts the sign the other way round', () => {
    const { buildings } = compileIndoor([file('box', 1, { fit: { turn: 180 }, walls: [[0.25, 0, 0.25, 1]] })], [box]);
    expect(buildings[0]?.floors[0]?.walls).toStrictEqual([[30, 0, 30, 10]]);
  });

  it("fits each floor onto the volume it is in: a tower floor onto the tower's outline", () => {
    const { buildings } = compileIndoor([file('tower', 1), file('tower', 3)], [tower]);
    const [podium, upper] = buildings[0]?.floors ?? [];
    expect(podium?.walls[1]).toStrictEqual([40, 10, 40, 0]);
    expect(upper?.walls[1]).toStrictEqual([20, 10, 20, 0]);
  });

  it("takes the storey height from the main block, not a small part rising past it (Connon's stair tower)", () => {
    const { buildings } = compileIndoor([file('stair-tower', 4)], [stairTower]);
    const top = buildings[0]?.floors[0];
    expect([top?.base, top?.height]).toStrictEqual([10.2, 3.4]);
  });

  it('writes one building per slug, floors lowest first, buildings by slug', () => {
    const { buildings } = compileIndoor([file('tower', 3), file('box', 2), file('box', 1)], [box, tower]);
    expect(buildings.map((b) => [b.building, b.floors.map((f) => f.floor)])).toStrictEqual([
      ['box', [1, 2]],
      ['tower', [3]],
    ]);
  });

  it('reports how far each floor sits from its outline', () => {
    const { notes } = compileIndoor([file('box', 1), file('box', 2, { walls: [[0, 0.5, 1, 0.5]] })], [box]);
    expect(notes).toStrictEqual([
      'floors: box 1 sits 0 m from its outline (90%: 0 m)',
      'floors: box 2 sits 5 m from its outline (90%: 5 m): check its corners and turn',
    ]);
  });

  it.each<[string, FloorFile, string]>([
    [
      'a file in the wrong folder',
      file('box', 1, {}, 'data-src/floors/tower/01.json'),
      'data-src/floors/tower/01.json: says building box, but sits in floors/tower/',
    ],
    [
      'a file named for another floor',
      file('box', 2, {}, 'data-src/floors/box/03.json'),
      'data-src/floors/box/03.json: says floor 2, but is named 03.json',
    ],
    [
      'an unknown building',
      file('nowhere', 1),
      'data-src/floors/nowhere/01.json: nowhere is not a building in campus.json',
    ],
    ['a floor above the top', file('box', 5), 'data-src/floors/box/05.json: box has 4 floors, not 5'],
    ['a floor with no walls', file('box', 2, { walls: [] }), 'data-src/floors/box/02.json: has no walls'],
    [
      // Checked means the owner saw it right in the preview; a gap now means the outline moved under it.
      'a checked floor far from its outline',
      file('box', 2, { checked: true, walls: [[0, 0.5, 1, 0.5]] }),
      'data-src/floors/box/02.json: checked, but sits 5 m from its outline (90%: 5 m): check its corners and turn',
    ],
  ])('fails the build on %s', (_, bad, error) => {
    const result = compileIndoor([bad, file('box', 1)], [box, tower]);
    expect(result.errors).toStrictEqual([error]);
    expect(result.buildings).toStrictEqual([]);
  });
});

describe('compileIndoor, labelled floors (8a)', () => {
  /** BX101 a quarter of the way along, its door 1 m north of the hallway; the stairs at the east end. */
  const labelled = (floor: number, change: Partial<FloorSource> = {}) =>
    file('box', floor, {
      rooms: floor === 1 ? [{ codes: ['BX101'], label: [0.25, 0.25], doors: [[0.25, 0.4]] }] : [],
      verticals: [{ id: 'east-stairs', point: [0.95, 0.5] }],
      ...change,
    });
  const inputs: IndoorInputs = {
    rooms: [{ code: 'BX101', building: 'box', floor: 1 }],
    verticals: [
      {
        path: 'data-src/floors/box/verticals.json',
        building: 'box',
        list: [{ id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4] }],
      },
    ],
    entrances: [
      { building: 'tower', kind: 'main', point: [0, 0] },
      { building: 'box', kind: 'main', point: [0, 5] },
    ],
  };

  it('fits rooms, doors and stairs onto the outline, and joins them into one graph', () => {
    const { buildings, errors } = compileIndoor([labelled(1), labelled(2)], [box], inputs);
    expect(errors).toStrictEqual([]);
    const b = buildings[0];
    const xy = (i: number | undefined) => [b?.graph.points[2 * (i ?? -1)], b?.graph.points[2 * (i ?? -1) + 1]];
    expect(b?.rooms).toHaveLength(1);
    expect(b?.rooms[0]).toMatchObject({ code: 'BX101', floor: 1, label: [10, 7.5] });
    expect(xy(b?.rooms[0]?.doors[0])).toStrictEqual([10, 6]);
    expect(b?.verticals[0]?.stops.map((s) => [s.floor, ...xy(s.point)])).toStrictEqual([
      [1, 38, 5],
      [2, 38, 5],
    ]);
    expect(b?.entrances).toStrictEqual([{ entrance: 1, point: 0 }]);
    expect(xy(0)).toStrictEqual([0, 5]);
  });

  it.each<[string, FloorFile[], Partial<IndoorInputs>, string]>([
    [
      'a door far from the hallway, in meters',
      [labelled(1, { rooms: [{ codes: ['BX101'], label: [0.25, 0.1], doors: [[0.25, 0.05]] }] }), labelled(2)],
      {},
      "data-src/floors/box/01.json: BX101's door is 4.5 m from the nearest hallway (3 m at most)",
    ],
    [
      'a verticals.json for a building with no floor files',
      [labelled(1), labelled(2)],
      {
        verticals: [...inputs.verticals, { path: 'data-src/floors/tower/verticals.json', building: 'tower', list: [] }],
      },
      'data-src/floors/tower/verticals.json: tower has no floor files',
    ],
  ])('fails the build on %s', (_, files, change, error) => {
    const result = compileIndoor(files, [box, tower], { ...inputs, ...change });
    expect(result.errors).toStrictEqual([error]);
    expect(result.buildings).toStrictEqual([]);
  });
});
