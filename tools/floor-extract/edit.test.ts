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
});

describe('parseEditSpec', () => {
  it('takes an empty hallways list: it removes every hallway', () => {
    expect(parseEditSpec({ hallways: [] })).toStrictEqual({ hallways: [] });
  });

  it('reads a spec with every part', () => {
    const spec = { delete: [2, 0], add: [[0, 0, 10, 0]], hallways: [[0, 5, 10, 5]] };
    expect(parseEditSpec(spec)).toStrictEqual(spec);
  });

  it.each<[string, unknown, RegExp]>([
    ['a misspelt key', { deletes: [1] }, /deletes/],
    ['the same index twice', { delete: [3, 3] }, /wall 3 is listed twice/],
    ['a negative index', { delete: [-1] }, /delete/],
    ['an odd number of values', { add: [[0, 0, 10]] }, /x, y pairs/],
    ['a single point', { add: [[0, 0]] }, /at least 2 points/],
    ['nothing to do', {}, /nothing to change/],
    ['only empty lists', { delete: [], add: [] }, /nothing to change/],
  ])('refuses %s', (_, spec, message) => {
    expect(() => parseEditSpec(spec)).toThrow(message);
  });
});
