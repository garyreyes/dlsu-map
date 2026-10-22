// attach on a small hand-built network. Each rule decides where a route starts or ends: a pin snapped to the wrong
// building, or a door link through a wall, would send a student to the wrong door with nothing looking broken.
import { describe, expect, it } from 'vitest';
import { attach, type AttachInput, type EntranceInput } from './attach.ts';
import type { Point } from './geometry.ts';
import type { Network } from './walk.ts';

// Two footpaths meeting at the origin: east along y = 0 to x = 100, then a crosswalk on to x = 110; and north along
// x = 0 to y = 60. Points 0–4.
const network = (): Network => ({
  points: [
    [0, 0],
    [50, 0],
    [100, 0],
    [110, 0],
    [0, 60],
  ],
  keys: ['n0', 'n1', 'n2', 'n3', 'n4'],
  ways: [{ kind: 'path' }, { kind: 'crossing', name: 'Taft Avenue' }],
  links: [
    [0, 1, 0],
    [1, 2, 0],
    [2, 3, 1],
    [0, 4, 0],
  ],
});
const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
const entrance = (building: string, point: Point, more: Partial<EntranceInput> = {}): EntranceInput => ({
  building,
  kind: 'main',
  point,
  verified: false,
  ...more,
});
// STRC: x 20–40, y 10–20, just north of the east path. Miguel: right behind it, y 25–45. Connon: block tier.
const strcMain = entrance('strc', [30, 8]);
const miguelMain = entrance('miguel', [10, 35]);
const input = (over: Partial<AttachInput> = {}): AttachInput => ({
  network: network(),
  buildings: [
    { slug: 'strc', tier: 'full', outlines: [box(20, 10, 40, 20)] },
    { slug: 'miguel', tier: 'full', outlines: [box(20, 25, 40, 45)] },
    { slug: 'connon', tier: 'block', outlines: [box(60, 10, 80, 30)] },
  ],
  gates: [{ id: 'gate-1', name: 'Gate 1 (South)', key: 'n0', point: [0, 0] }],
  entrances: [strcMain, miguelMain],
  ...over,
});
const xy = (walk: { points: number[] }, i: number) => [walk.points[2 * i], walk.points[2 * i + 1]];
type Result = ReturnType<typeof attach>;
/** The links of kind `door` touching point i. */
const doorsAt = ({ walk }: Result, i: number) =>
  walk.links.filter(([a, b, w]) => (a === i || b === i) && walk.ways[w]?.kind === 'door');

describe('attach', () => {
  it('snaps a pin onto its building’s wall and joins it to the nearest path by a door link', () => {
    const result = attach(input());
    const { walk, entrances, errors } = result;
    expect(errors).toStrictEqual([]);
    expect(entrances[0]).toStrictEqual({ building: 'strc', kind: 'main', point: 5, verified: false });
    expect(xy(walk, 5)).toStrictEqual([30, 10]); // on the wall, not 2 m short of it
    expect(xy(walk, 6)).toStrictEqual([30, 0]); // the path, split under the door
    expect(walk.ways[2]).toStrictEqual({ kind: 'door' });
    expect(walk.links).toContainEqual([5, 6, 2]);
    // The stretch 0–50 is now 0–30 and 30–50.
    expect(walk.links).toContainEqual([0, 6, 0]);
    expect(walk.links).toContainEqual([6, 1, 0]);
    expect(walk.links).not.toContainEqual([0, 1, 0]);
    // Miguel's pin, 10 m west of its wall, lands on the wall at (20, 35) and goes west to the north path.
    expect(xy(walk, entrances[1]?.point ?? -1)).toStrictEqual([20, 35]);
    expect(doorsAt(result, entrances[1]?.point ?? -1)).toHaveLength(1);
  });

  it('keeps a gate that is already on a path at its own point, with no door link', () => {
    const result = attach(input());
    expect(result.gates).toStrictEqual([{ id: 'gate-1', name: 'Gate 1 (South)', point: 0 }]);
    expect(doorsAt(result, 0)).toStrictEqual([]);
  });

  it('joins a gate that is off the paths, as one on a building’s wall', () => {
    const gate = { id: 'gate-4a', name: 'Gate 4A', key: 'n9', point: [70, 10] as Point };
    const result = attach(input({ gates: [...input().gates, gate] }));
    expect(result.errors).toStrictEqual([]);
    const at = result.gates.find((g) => g.id === 'gate-4a')?.point ?? -1;
    expect(xy(result.walk, at)).toStrictEqual([70, 10]);
    expect(doorsAt(result, at)).toHaveLength(1);
  });

  it('joins an entrance that lands on a path by splitting it, with no door link', () => {
    const side = entrance('strc', [20, 0.3], { kind: 'side' });
    const buildings = [
      { slug: 'strc', tier: 'full' as const, outlines: [box(20, 0, 40, 20)] },
      ...input().buildings.slice(1),
    ];
    const result = attach(input({ entrances: [miguelMain, side], buildings }));
    expect(result.errors).toStrictEqual(['strc: no main entrance in data-src/campus/entrances.json']);
    const at = result.entrances.find((e) => e.kind === 'side')?.point ?? -1;
    expect(xy(result.walk, at)).toStrictEqual([20, 0]);
    expect(doorsAt(result, at)).toStrictEqual([]);
  });

  it('never joins to a crosswalk: a door opens onto the sidewalk, not the middle of the road', () => {
    const buildings = [
      ...input().buildings.slice(0, 2),
      { slug: 'connon', tier: 'block' as const, outlines: [box(100, 2, 120, 20)] },
    ];
    const result = attach(input({ entrances: [strcMain, miguelMain, entrance('connon', [105, 2])], buildings }));
    const door = result.entrances[2]?.point ?? -1;
    const [link] = doorsAt(result, door);
    expect(link && xy(result.walk, link[0] === door ? link[1] : link[0])).toStrictEqual([100, 0]);
  });

  it('lets a door link run along a wall, which is not going through the building', () => {
    // STRC's west wall is x = 20; this door is on it and its link runs down the wall to the path.
    const side = entrance('strc', [19.6, 15], { kind: 'side' });
    const { errors } = attach(input({ entrances: [strcMain, miguelMain, side] }));
    expect(errors).toStrictEqual([]);
  });

  it('fails a pin more than 15 m from its own building, naming it, and nothing else for that building', () => {
    const { errors } = attach(input({ entrances: [entrance('strc', [30, -20]), miguelMain] }));
    expect(errors).toStrictEqual(['strc main entrance: the pin is 30 m from the building (at most 15)']);
  });

  it('fails a pin for a building that is not listed', () => {
    const { errors } = attach(input({ entrances: [strcMain, miguelMain, entrance('chapel', [30, 8])] }));
    expect(errors).toStrictEqual(['chapel main entrance: chapel is not in buildings.json']);
  });

  it('fails a door link that would pass through another building', () => {
    // Miguel's south door: the nearest path is the east one, 25 m south, and STRC stands in the way.
    const { errors } = attach(input({ entrances: [strcMain, entrance('miguel', [35, 23])] }));
    expect(errors).toStrictEqual([
      'miguel main entrance: the way to the nearest path (35, 25 → 35, 0) goes through strc',
    ]);
  });

  it('fails a door more than 30 m from any path', () => {
    const buildings = [
      ...input().buildings,
      { slug: 'razon', tier: 'full' as const, outlines: [box(100, 60, 110, 70)] },
    ];
    const { errors } = attach(input({ buildings, entrances: [strcMain, miguelMain, entrance('razon', [105, 59])] }));
    expect(errors).toStrictEqual(['razon main entrance: the nearest path is 60 m away (at most 30)']);
  });

  it('fails a full building with no main entrance, and only notes a block one', () => {
    const { errors, notes } = attach(input({ entrances: [miguelMain] }));
    expect(errors).toStrictEqual(['strc: no main entrance in data-src/campus/entrances.json']);
    expect(notes).toContain('entrances: no main entrance yet for connon (block tier)');
  });

  it('fails two doors of one kind in a building unless each has its own name (D48)', () => {
    const error = 'strc: its 2 main entrances each need a different name in data-src/campus/entrances.json';
    const second = (name?: string) => entrance('strc', [19.6, 15], name === undefined ? {} : { name });
    const named = (name?: string) => (name === undefined ? strcMain : { ...strcMain, name });
    expect(attach(input({ entrances: [strcMain, miguelMain, second()] })).errors).toStrictEqual([error]);
    expect(attach(input({ entrances: [named('facing Taft'), miguelMain, second()] })).errors).toStrictEqual([error]);
    const same = [named('facing Taft'), miguelMain, second('facing Taft')];
    expect(attach(input({ entrances: same })).errors).toStrictEqual([error]);
    const both = [named('facing Taft'), miguelMain, second('facing Agno')];
    expect(attach(input({ entrances: both })).errors).toStrictEqual([]);
  });

  it('names a side entrance and keeps verified as given', () => {
    const side = entrance('strc', [19.6, 15], { kind: 'side', verified: true, name: 'to Agno' });
    const { entrances } = attach(input({ entrances: [strcMain, miguelMain, side] }));
    expect(entrances[2]).toMatchObject({ building: 'strc', kind: 'side', verified: true, name: 'to Agno' });
  });

  it('writes meters to 0.1 m', () => {
    const { walk } = attach(input({ entrances: [entrance('strc', [30.04, 8]), miguelMain] }));
    expect(xy(walk, 5)).toStrictEqual([30, 10]);
  });

  it('fails a pin nearer a path OSM left unjoined than the network, rather than joining it far away', () => {
    // A stray path just south of STRC's door, dropped because it joins nothing.
    const islands = [
      [
        [25, 6],
        [30, 6],
        [35, 6],
      ] as Point[],
    ];
    const { errors } = attach(input({ islands }));
    expect(errors).toStrictEqual([
      'strc main entrance: the nearest path (around 30, 6) is not joined to the rest of the network',
    ]);
  });

  it('fails a door link that would cross a carriageway to reach the far side', () => {
    // A carriageway along y = 5, between Connon's south wall and the path at y = 0.
    const barriers = [
      {
        name: 'Taft Avenue',
        line: [
          [0, 5],
          [120, 5],
        ] as Point[],
      },
    ];
    const { errors } = attach(input({ barriers, entrances: [miguelMain, entrance('connon', [70, 9])] }));
    expect(errors).toContain('connon main entrance: the way to the nearest path (70, 10 → 70, 0) crosses Taft Avenue');
  });

  it('fails a pin dropped well inside its building, which could snap to the wrong wall', () => {
    const { errors } = attach(input({ entrances: [entrance('strc', [30, 16]), miguelMain] }));
    expect(errors).toStrictEqual([
      'strc main entrance: the pin is inside the building, 4 m from its nearest wall; put it on the door',
    ]);
  });

  it('accepts a pin just inside the wall, as a pin dropped on a doorway is', () => {
    const { errors } = attach(input({ entrances: [entrance('strc', [30, 11]), miguelMain] }));
    expect(errors).toStrictEqual([]);
  });

  it('leaves out ways no link uses, such as those of dropped pieces', () => {
    const net = network();
    net.ways.push({ kind: 'street', name: 'Noli Street' });
    const { walk } = attach(input({ network: net }));
    expect(walk.ways).toStrictEqual([{ kind: 'path' }, { kind: 'crossing', name: 'Taft Avenue' }, { kind: 'door' }]);
    expect(walk.links.every(([, , w]) => w < walk.ways.length)).toBe(true);
  });

  it('fails when an entrance ends up apart from the gates', () => {
    const split = network();
    split.links.splice(1, 1); // cut 50–100: the gate below is on the far piece
    const gate = { id: 'gate-6', name: 'Gate 6', key: 'n3', point: [110, 0] as Point };
    const { errors } = attach(input({ network: split, gates: [gate] }));
    expect(errors).toStrictEqual(["walk: strc main entrance, miguel main entrance can't be reached from gate-6"]);
  });
});
