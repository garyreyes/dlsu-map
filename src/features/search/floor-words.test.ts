// The card's floor words are the answer most students came for (PRD §5), so each case names the exact text.
import { describe, expect, it } from 'vitest';
import { floorWords } from './floor-words';

describe('floorWords', () => {
  it('G is the ground floor', () => {
    expect(floorWords(1, 'G')).toBe('Ground floor (G)');
  });

  it.each([
    [1, '1F', '1st floor (1F)'],
    [2, '2F', '2nd floor (2F)'],
    [3, '3F', '3rd floor (3F)'],
    [4, '4F', '4th floor (4F)'],
    [11, '11F', '11th floor (11F)'],
    [12, '12F', '12th floor (12F)'],
    [13, '13F', '13th floor (13F)'],
    [20, '20F', '20th floor (20F)'],
    [21, '21F', '21st floor (21F)'],
    [22, '22F', '22nd floor (22F)'],
    [23, '23F', '23rd floor (23F)'],
  ])('floor %s labelled %s → %s', (floor, label, expected) => {
    expect(floorWords(floor, label)).toBe(expected);
  });

  it('a label the signs print some other way stays as printed, with no words made up for it', () => {
    expect(floorWords(1, 'G Mezz')).toBe('G Mezz');
  });

  it('a label that names a different number than the floor is shown as printed', () => {
    expect(floorWords(2, '3F')).toBe('3F');
  });
});
