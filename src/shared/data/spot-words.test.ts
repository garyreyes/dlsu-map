// S4's spot chips, S5's door chips and the From chip all name a door or a stairs with these, and the steps say the
// same words (routing/directions.ts), so a student reads one name for one place.
import { describe, expect, it } from 'vitest';
import { doorWords, verticalWords } from './spot-words';

describe('verticalWords', () => {
  it('reads a building file id as the steps do', () => {
    expect(verticalWords('east-stairs')).toBe('east stairs');
    expect(verticalWords('elevator')).toBe('elevator');
    expect(verticalWords('lobby-stairs')).toBe('lobby stairs');
  });
});

describe('doorWords', () => {
  it('names a door by its kind, then where it faces', () => {
    expect(doorWords({ kind: 'main', name: 'facing Agno' })).toBe('main entrance facing Agno');
    expect(doorWords({ kind: 'side', name: 'facing SJ Walk' })).toBe('side entrance facing SJ Walk');
  });

  it('leaves the name out when the building has one door of that kind', () => {
    expect(doorWords({ kind: 'main' })).toBe('main entrance');
  });
});
