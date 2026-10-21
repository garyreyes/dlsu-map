// Changing floors inside one building (D34): stairs 20 s a floor, elevator 3 min + 5 s a floor, Auto = elevator for
// 3 floors or more. Every outcome is asserted by its exact value, and each one (stairs, elevator, none, noElevator)
// is reached by at least one case.
import { describe, expect, it } from 'vitest';
import { floorsLeg } from './floors';

describe('floorsLeg', () => {
  it.each([
    ['auto, 1 floor up', 1, 2, 'auto', true, 'stairs', 20],
    ['auto, 2 floors up', 1, 3, 'auto', true, 'stairs', 40],
    ['auto, 3 floors up', 1, 4, 'auto', true, 'elevator', 195],
    ['auto, 3 floors down', 4, 1, 'auto', true, 'elevator', 195],
    ['auto, 10 floors down', 11, 1, 'auto', true, 'elevator', 230],
    ['stairs, 10 floors down', 11, 1, 'stairs', true, 'stairs', 200],
    ['elevator, 1 floor up', 1, 2, 'elevator', true, 'elevator', 185],
    ['auto, 4 floors, no elevator', 1, 5, 'auto', false, 'stairs', 80],
  ] as const)('%s: %s', (_label, from, to, mode, hasElevator, by, seconds) => {
    expect(floorsLeg('strc', from, to, mode, hasElevator)).toStrictEqual({
      kind: 'floors',
      building: 'strc',
      from,
      to,
      by,
      seconds,
    });
  });

  it('uses the stairs and says so when Elevator was asked for and there is none', () => {
    expect(floorsLeg('ls', 1, 3, 'elevator', false)).toStrictEqual({
      kind: 'floors',
      building: 'ls',
      from: 1,
      to: 3,
      by: 'stairs',
      seconds: 40,
      noElevator: true,
    });
  });

  it('is no leg at all on the same floor', () => {
    expect(floorsLeg('strc', 3, 3, 'elevator', true)).toBeNull();
  });
});
