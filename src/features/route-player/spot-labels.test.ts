import { describe, expect, it } from 'vitest';
import type { ExitChoices } from './exits';
import { exitSpotLabels } from './spot-labels';

const CHOICES: ExitChoices = {
  building: 'velasco',
  doors: [
    { entrance: 4, label: 'Main entrance facing CADS' },
    { entrance: 5, label: 'Main entrance facing Agno' },
  ],
  taken: 5,
};

describe('exitSpotLabels', () => {
  it('names each door on G, without any "(quickest)" tag', () => {
    expect(exitSpotLabels(CHOICES)).toEqual([
      { building: 'velasco', floor: 1, spot: { kind: 'entrance', entrance: 4 }, label: 'Main entrance facing CADS' },
      { building: 'velasco', floor: 1, spot: { kind: 'entrance', entrance: 5 }, label: 'Main entrance facing Agno' },
    ]);
  });
});
