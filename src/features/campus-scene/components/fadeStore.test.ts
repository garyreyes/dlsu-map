// The route's fade list re-renders the whole campus view on a change, so the same list set again must change nothing.
import { beforeEach, describe, expect, it } from 'vitest';
import { useFade } from './fadeStore';

describe('useFade', () => {
  beforeEach(() => {
    useFade.getState().set([]);
  });

  it('holds the slugs it was given', () => {
    useFade.getState().set(['velasco', 'andrew']);
    expect([...useFade.getState().faded].sort()).toStrictEqual(['andrew', 'velasco']);
  });

  it('keeps the same set when the same slugs come again, in any order', () => {
    useFade.getState().set(['velasco', 'andrew']);
    const before = useFade.getState().faded;
    useFade.getState().set(['andrew', 'velasco', 'andrew']);
    expect(useFade.getState().faded).toBe(before);
  });

  it('gives a new set when the slugs change', () => {
    useFade.getState().set(['velasco']);
    const before = useFade.getState().faded;
    useFade.getState().set(['andrew']);
    expect(useFade.getState().faded).not.toBe(before);
    expect([...useFade.getState().faded]).toStrictEqual(['andrew']);
  });
});
