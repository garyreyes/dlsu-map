import { describe, expect, it } from 'vitest';
import { floorSourceSchema } from '../../src/shared/data/floor-source.ts';
import { floorFile, floorOfPhoto, formatFloorFile, type Draft } from './floor-file.ts';

const draft: Draft = {
  photo: 'strc_04F.jpg',
  plan: { width: 3201, height: 789 },
  walls: [{ x0: 0.86160574, y0: -0.00063371, x1: 0.92627304, y1: -0.00063371, t: 0.0114 }],
  route: [{ x0: 0.05, y0: 0.5, x1: 0.95, y1: 0.5, t: 0.01 }],
};

describe('floorOfPhoto', () => {
  it.each<[string, { building: string; floor: number } | null]>([
    ['strc_04F.jpg', { building: 'strc', floor: 4 }],
    ['yuchengco_08F.jpg', { building: 'yuchengco', floor: 8 }],
    ['andrew_11F.JPG', { building: 'andrew', floor: 11 }],
    ['strc_directory.jpg', null],
    ['strc_00F.jpg', null],
    ['strc_4F.jpg', null],
  ])('%s', (photo, expected) => {
    expect(floorOfPhoto(photo)).toStrictEqual(expected);
  });
});

describe('floorFile', () => {
  it('keeps the draft in sign coordinates, unchecked and unturned, without wall thickness', () => {
    expect(floorFile(draft)).toStrictEqual({
      building: 'strc',
      floor: 4,
      extractedFrom: 'strc_04F.jpg',
      checked: false,
      plan: { width: 3201, height: 789 },
      fit: { turn: 0 },
      walls: [[0.8616, -0.0006, 0.9263, -0.0006]],
      hallways: [[0.05, 0.5, 0.95, 0.5]],
    });
  });

  it('writes a file the compiler accepts, even for a stray line far off the sign', () => {
    const stray = { ...draft, walls: [{ x0: -0.3, y0: 0, x1: 1.4, y1: 0, t: 0.01 }] };
    const file = floorFile(stray);
    expect(file?.walls).toStrictEqual([[-0.1, 0, 1.1, 0]]);
    expect(floorSourceSchema.safeParse(file).success).toBe(true);
  });

  it('refuses a photo whose name says no floor', () => {
    expect(floorFile({ ...draft, photo: 'strc_directory.jpg' })).toBeNull();
  });
});

describe('formatFloorFile', () => {
  it('puts each wall on one line and reads back the same', () => {
    const file = floorFile(draft);
    if (!file) throw new Error('the draft names a floor');
    const text = formatFloorFile(file);
    expect(text).toContain('\n    [0.8616, -0.0006, 0.9263, -0.0006]\n');
    expect(text).toContain('"fit": {\n    "turn": 0\n  }');
    expect(JSON.parse(text)).toStrictEqual(file);
  });
});
