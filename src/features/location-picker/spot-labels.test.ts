import { describe, expect, it } from 'vitest';
import { spotLabelsOf } from './spot-labels';

describe('spotLabelsOf', () => {
  it('names each choice on its building and floor, first letter capitalised', () => {
    const choices = [
      { spot: { kind: 'entrance', entrance: 5 }, label: 'main entrance facing Agno' },
      { spot: { kind: 'vertical', id: 'east-stairs' }, label: 'east stairs' },
    ] as const;
    expect(spotLabelsOf('velasco', 1, choices)).toEqual([
      { building: 'velasco', floor: 1, spot: { kind: 'entrance', entrance: 5 }, label: 'Main entrance facing Agno' },
      { building: 'velasco', floor: 1, spot: { kind: 'vertical', id: 'east-stairs' }, label: 'East stairs' },
    ]);
  });

  it('is empty while the choices are still loading or there are none', () => {
    expect(spotLabelsOf('velasco', 2, null)).toEqual([]);
    expect(spotLabelsOf('velasco', 2, [])).toEqual([]);
  });

  it('is empty when only one spot is offered, since there is nothing to tell apart', () => {
    expect(spotLabelsOf('velasco', 2, [{ spot: { kind: 'vertical', id: 'elevator' }, label: 'elevator' }])).toEqual([]);
  });
});
