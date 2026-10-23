// Which floor the band and its chip show for a step inside a building (O5). A wrong answer sends a student to the
// wrong floor while the step text says another. Exact values throughout.
import { describe, expect, it } from 'vitest';
import { bandFloorOf, floorLabelOf } from './trip-band';

const step = { kind: 'floor', building: 'strc', floor: 1, goal: 3 } as const;

describe('bandFloorOf', () => {
  it('is the step’s floor while its cut floor is drawn', () => {
    expect(bandFloorOf(step, true, false)).toBe(1);
    expect(bandFloorOf(step, true, true)).toBe(1);
  });

  it('is the step’s floor while the floor file is still loading online (no cut yet, not saving)', () => {
    expect(bandFloorOf(step, false, false)).toBe(1);
  });

  it('is the step’s floor for an untraced floor in a loaded building (no cut, not saving)', () => {
    const untraced = { floor: 2, goal: 5 };
    expect(bandFloorOf(untraced, false, false)).toBe(2);
  });

  it('is the goal floor when the building’s indoor map is still saving or its file failed (offline)', () => {
    expect(bandFloorOf(step, false, true)).toBe(3);
  });

  it('is the step’s floor when the step has no goal', () => {
    const noGoal = { kind: 'floor', building: 'strc', floor: 2 } as const;
    expect(bandFloorOf(noGoal, false, true)).toBe(2);
  });
});

describe('floorLabelOf', () => {
  const strc = { floorLabels: { '1': 'G' } };

  it('uses the building’s own label', () => {
    expect(floorLabelOf(strc, 1)).toBe('G');
  });

  it('falls back to the floor number and F', () => {
    expect(floorLabelOf(strc, 3)).toBe('3F');
    expect(floorLabelOf(undefined, 3)).toBe('3F');
  });
});
