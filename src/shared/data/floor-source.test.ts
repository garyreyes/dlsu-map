// The floor file is authored by tools/floor-extract and Claude's cleanup, then read by the compiler. These cases
// prove the schema takes a real-shaped file and rejects each mistake a hand edit could make.
import { describe, expect, it } from 'vitest';
import { floorSourceSchema } from './floor-source';

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
    ['an unknown field', { rooms: [] }],
  ])('rejects %s', (_, change) => {
    expect(floorSourceSchema.safeParse(broken(change)).success).toBe(false);
  });
});
