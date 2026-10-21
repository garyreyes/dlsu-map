import { describe, expect, it } from 'vitest';
import type { FloorSource } from '../../src/shared/data/floor-source.ts';
import { applyEdit, parseEditSpec } from './edit.ts';

/** A 2000 × 500 px sign: plan px ÷ 2000 across, ÷ 500 down. */
const floor: FloorSource = {
  building: 'strc',
  floor: 2,
  extractedFrom: 'strc_02F.jpg',
  checked: false,
  plan: { width: 2000, height: 500 },
  fit: { turn: 180 },
  walls: [
    [0, 0, 0.5, 0],
    [0.5, 0, 1, 0],
    [0, 1, 1, 1],
    [0.25, 0, 0.25, 1],
  ],
  hallways: [[0, 0.5, 1, 0.5]],
};

describe('applyEdit', () => {
  it('deletes walls by their index in the file, keeping the others in order', () => {
    const { file, removed } = applyEdit(floor, { delete: [3, 1] });
    expect(file.walls).toStrictEqual([
      [0, 0, 0.5, 0],
      [0, 1, 1, 1],
    ]);
    expect(removed).toBe(2);
  });

  it('adds walls given in plan px, as 0–1 fractions of the sign, after the kept ones', () => {
    const { file, added } = applyEdit(floor, { delete: [0, 1, 2, 3], add: [[500, 0, 500, 250, 1000, 250]] });
    expect(file.walls).toStrictEqual([[0.25, 0, 0.25, 0.5, 0.5, 0.5]]);
    expect(added).toBe(1);
  });

  it('rounds to four decimals, like the first floor file', () => {
    const { file } = applyEdit(floor, { add: [[1, 1, 2001, 1]] });
    expect(file.walls.at(-1)).toStrictEqual([0.0005, 0.002, 1.0005, 0.002]);
  });

  it('replaces every hallway when given, and leaves them alone when not', () => {
    expect(applyEdit(floor, { hallways: [[0, 100, 2000, 100]] }).file.hallways).toStrictEqual([[0, 0.2, 1, 0.2]]);
    expect(applyEdit(floor, { delete: [0] }).file.hallways).toStrictEqual(floor.hallways);
  });

  it('unchecks a checked floor, since the owner checked the old walls', () => {
    const edited = applyEdit({ ...floor, checked: true }, { delete: [0] });
    expect(edited.file.checked).toBe(false);
    expect(edited.unchecked).toBe(true);
    expect(applyEdit(floor, { delete: [0] }).unchecked).toBe(false);
  });

  it('leaves the input file as it was', () => {
    const before = structuredClone(floor);
    applyEdit(floor, { delete: [0], add: [[0, 0, 10, 0]], hallways: [] });
    expect(floor).toStrictEqual(before);
  });

  it('refuses a wall index the file does not have', () => {
    expect(() => applyEdit(floor, { delete: [4] })).toThrow('no wall 4: strc 2F has walls 0–3');
  });

  it('refuses a line past the sign rather than squeezing it in', () => {
    expect(() => applyEdit(floor, { add: [[0, 0, 2400, 0]] })).toThrow(/walls\.4\.2/);
  });

  it('places rooms given in plan px: label and doors as 0–1 fractions of the sign', () => {
    const rooms = [
      {
        codes: ['ST204', 'ST206'],
        label: [500, 250] as [number, number],
        doors: [[500, 400] as [number, number], [1001, 400] as [number, number]],
      },
    ];
    expect(applyEdit(floor, { rooms }).file.rooms).toStrictEqual([
      {
        codes: ['ST204', 'ST206'],
        label: [0.25, 0.5],
        doors: [
          [0.25, 0.8],
          [0.5005, 0.8],
        ],
      },
    ]);
  });

  it('places stairs and elevators given in plan px', () => {
    const { file } = applyEdit(floor, { verticals: [{ id: 'east-stairs', point: [2000, 0] }] });
    expect(file.verticals).toStrictEqual([{ id: 'east-stairs', point: [1, 0] }]);
  });

  it('replaces every room and vertical when given, and leaves them alone when not', () => {
    const labelled: FloorSource = {
      ...floor,
      rooms: [{ codes: ['ST201'], label: [0.1, 0.1], doors: [[0.1, 0.5]] }],
      verticals: [{ id: 'lift', point: [0.9, 0.9] }],
    };
    const walls = applyEdit(labelled, { delete: [0] }).file;
    expect(walls.rooms).toStrictEqual(labelled.rooms);
    expect(walls.verticals).toStrictEqual(labelled.verticals);
    const relabelled = applyEdit(labelled, { rooms: [{ codes: ['ST202'], label: [0, 0], doors: [[0, 250]] }] }).file;
    expect(relabelled.rooms).toStrictEqual([{ codes: ['ST202'], label: [0, 0], doors: [[0, 0.5]] }]);
    expect(relabelled.verticals).toStrictEqual(labelled.verticals);
  });

  it('unchecks a checked floor when only its labels change', () => {
    const edited = applyEdit({ ...floor, checked: true }, { verticals: [{ id: 'lift', point: [0, 0] }] });
    expect(edited.file.checked).toBe(false);
    expect(edited.unchecked).toBe(true);
  });

  it.each<[string, Parameters<typeof applyEdit>[1], RegExp]>([
    // A code in the right shape but not on the floor (`C204`) is the compiler's to catch, against the room list.
    [
      'a printed code with a dash',
      { rooms: [{ codes: ['C-112'], label: [0, 0], doors: [[0, 0]] }] },
      /rooms\.0\.codes\.0/,
    ],
    [
      'the same code in two rooms',
      {
        rooms: [
          { codes: ['ST201'], label: [0, 0], doors: [[0, 0]] },
          { codes: ['ST201'], label: [9, 9], doors: [[9, 9]] },
        ],
      },
      /each room code once per floor/,
    ],
    [
      'a door past the sign',
      { rooms: [{ codes: ['ST201'], label: [0, 0], doors: [[0, 600]] }] },
      /rooms\.0\.doors\.0\.1/,
    ],
    [
      'the same vertical twice',
      {
        verticals: [
          { id: 'lift', point: [0, 0] },
          { id: 'lift', point: [9, 9] },
        ],
      },
      /each vertical once per floor/,
    ],
  ])('refuses %s', (_, spec, message) => {
    expect(() => applyEdit(floor, spec)).toThrow(message);
  });
});

describe('parseEditSpec', () => {
  it('takes an empty hallways list: it removes every hallway', () => {
    expect(parseEditSpec({ hallways: [] })).toStrictEqual({ hallways: [] });
  });

  it('reads a spec with every part', () => {
    const spec = { delete: [2, 0], add: [[0, 0, 10, 0]], hallways: [[0, 5, 10, 5]] };
    expect(parseEditSpec(spec)).toStrictEqual(spec);
  });

  it('reads a spec with only rooms or only verticals', () => {
    const rooms = { rooms: [{ codes: ['ST201'], label: [10, 20], doors: [[10, 40]] }] };
    expect(parseEditSpec(rooms)).toStrictEqual(rooms);
    const verticals = { verticals: [{ id: 'east-stairs', point: [10, 20] }] };
    expect(parseEditSpec(verticals)).toStrictEqual(verticals);
  });

  it.each<[string, unknown, RegExp]>([
    ['a misspelt key', { deletes: [1] }, /deletes/],
    ['the same index twice', { delete: [3, 3] }, /wall 3 is listed twice/],
    ['a negative index', { delete: [-1] }, /delete/],
    ['an odd number of values', { add: [[0, 0, 10]] }, /x, y pairs/],
    ['a single point', { add: [[0, 0]] }, /at least 2 points/],
    ['nothing to do', {}, /nothing to change/],
    ['only empty lists', { delete: [], add: [] }, /nothing to change/],
    ['a room with no door', { rooms: [{ codes: ['ST201'], label: [0, 0], doors: [] }] }, /rooms\.0\.doors/],
    ['a room with no code', { rooms: [{ codes: [], label: [0, 0], doors: [[0, 0]] }] }, /rooms\.0\.codes/],
    ['a label that is not one point', { rooms: [{ codes: ['ST201'], label: [0, 0, 1], doors: [[0, 0]] }] }, /label/],
    ['a misspelt room key', { rooms: [{ code: ['ST201'], label: [0, 0], doors: [[0, 0]] }] }, /code/],
    ['a vertical id with capitals', { verticals: [{ id: 'East', point: [0, 0] }] }, /verticals\.0\.id/],
  ])('refuses %s', (_, spec, message) => {
    expect(() => parseEditSpec(spec)).toThrow(message);
  });
});
