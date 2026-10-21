// The floor file is authored by tools/floor-extract and Claude's cleanup, then read by the compiler. These cases
// prove the schema takes a real-shaped file and rejects each mistake a hand edit could make.
import { describe, expect, it } from 'vitest';
import { floorSourceSchema, verticalSourcesSchema } from './floor-source';

type Loose = Record<string, unknown>;

const good = {
  building: 'strc',
  floor: 3,
  extractedFrom: 'strc_03F.jpg',
  checked: false,
  plan: { width: 3201, height: 789 },
  fit: { turn: 0 },
  walls: [
    [-0.001, 0, 1.001, 0],
    [0.3, 0, 0.3, 0.42, 0.35, 0.42],
  ],
  hallways: [[0.05, 0.5, 0.95, 0.5]],
};

const broken = (change: Loose): unknown => ({ ...structuredClone(good), ...change });

describe('floorSourceSchema', () => {
  it('accepts a floor file, walls just past the sign edge included', () => {
    expect(floorSourceSchema.parse(good)).toStrictEqual(good);
  });

  it('accepts both turns', () => {
    expect(floorSourceSchema.parse(broken({ fit: { turn: 180 } })).fit).toStrictEqual({ turn: 180 });
  });

  it.each<[string, Loose]>([
    ['no sign size', { plan: undefined }],
    ['a sign size of 0', { plan: { width: 0, height: 789 } }],
    ['a quarter turn', { fit: { turn: 90 } }],
    ['no fit', { fit: undefined }],
    ['a wall far off the sign', { walls: [[0, 0, 1.5, 0]] }],
    ['a wall with one point', { walls: [[0, 0]] }],
    ['a hallway with an odd count', { hallways: [[0, 0, 1]] }],
    ['floor 0', { floor: 0 }],
    ['a photo path, not a name', { extractedFrom: 'data-src/photos/strc_03F.jpg' }],
    ['a photo that is not an image', { extractedFrom: 'strc_03F.pdf' }],
    ['a bad slug', { building: 'STRC' }],
    ['an unknown field', { doors: [] }],
    ['a room code in lower case', { rooms: [{ codes: ['st311'], label: [0.5, 0.2], doors: [[0.5, 0.4]] }] }],
    ['a room with no code', { rooms: [{ codes: [], label: [0.5, 0.2], doors: [[0.5, 0.4]] }] }],
    ['a room with no door', { rooms: [{ codes: ['ST311'], label: [0.5, 0.2], doors: [] }] }],
    ['a label far off the sign', { rooms: [{ codes: ['ST311'], label: [1.5, 0.2], doors: [[0.5, 0.4]] }] }],
    ['a door with three numbers', { rooms: [{ codes: ['ST311'], label: [0.5, 0.2], doors: [[0.5, 0.4, 0]] }] }],
    [
      'a room on the floor twice',
      {
        rooms: [
          { codes: ['ST311'], label: [0.5, 0.2], doors: [[0.5, 0.4]] },
          { codes: ['ST313', 'ST311'], label: [0.6, 0.2], doors: [[0.6, 0.4]] },
        ],
      },
    ],
    ['a vertical id with spaces', { verticals: [{ id: 'east stairs', point: [0.1, 0.5] }] }],
    [
      'the same vertical twice',
      {
        verticals: [
          { id: 'east-stairs', point: [0.1, 0.5] },
          { id: 'east-stairs', point: [0.9, 0.5] },
        ],
      },
    ],
  ])('rejects %s', (_, change) => {
    expect(floorSourceSchema.safeParse(broken(change)).success).toBe(false);
  });
});

describe('floorSourceSchema, labelled (8a)', () => {
  const labelled = {
    ...good,
    rooms: [
      { codes: ['ST311'], label: [0.2, 0.2], doors: [[0.2, 0.45]] },
      {
        codes: ['ST404', 'ST406'],
        label: [0.6, 0.8],
        doors: [
          [0.55, 0.55],
          [0.7, 0.55],
        ],
      },
    ],
    verticals: [
      { id: 'east-stairs', point: [0.95, 0.5] },
      { id: 'elevator', point: [0.5, 0.6] },
    ],
  };

  it('accepts rooms (one entry for a combined room, two doors for a big one) and verticals', () => {
    expect(floorSourceSchema.parse(labelled)).toStrictEqual(labelled);
  });

  it('accepts a floor labelled with no rooms on it, which is not the same as not labelled yet', () => {
    expect(floorSourceSchema.parse({ ...good, rooms: [], verticals: [] }).rooms).toStrictEqual([]);
  });
});

describe('verticalSourcesSchema', () => {
  const good = [
    { id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 3, 4] },
    { id: 'elevator', kind: 'elevator', servesFloors: [1, 3, 4] },
  ];

  it('accepts stairs and an elevator that skips a floor', () => {
    expect(verticalSourcesSchema.parse(good)).toStrictEqual(good);
  });

  it.each<[string, unknown]>([
    ['one floor only', [{ id: 'east-stairs', kind: 'stairs', servesFloors: [2] }]],
    ['floors out of order', [{ id: 'east-stairs', kind: 'stairs', servesFloors: [2, 1] }]],
    ['a floor twice', [{ id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2, 2] }]],
    ['floor 0', [{ id: 'east-stairs', kind: 'stairs', servesFloors: [0, 1] }]],
    ['an escalator', [{ id: 'east-stairs', kind: 'escalator', servesFloors: [1, 2] }]],
    ['an id with capitals', [{ id: 'East', kind: 'stairs', servesFloors: [1, 2] }]],
    ['an unknown field', [{ id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2], name: 'East' }]],
    [
      'the same id twice',
      [
        { id: 'east-stairs', kind: 'stairs', servesFloors: [1, 2] },
        { id: 'east-stairs', kind: 'elevator', servesFloors: [1, 2] },
      ],
    ],
  ])('rejects %s', (_, value) => {
    expect(verticalSourcesSchema.safeParse(value).success).toBe(false);
  });
});
