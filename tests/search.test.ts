// Search (3c) on the real room lists and prefix table, compiled from data-src as the build does. The rules are tested on
// a fixture in src/features/search/; this file holds what depends on the owner's real prefixes.
import { describe, expect, it } from 'vitest';
import { buildSearchIndex } from '../src/features/search/search-index.ts';
import { searchResults } from '../src/features/search/search-results.ts';
import { campus, rooms } from './real-data.ts';

const index = buildSearchIndex(rooms.rooms, campus.buildings);
const codes = (typed: string) => searchResults(typed, index).hits.map((h) => (h.kind === 'room' ? h.code : h.kind));

describe('search on the real rooms', () => {
  // D51: students say "V205" for Velasco, so V is an accepted alias like VE, not a Did you mean like VH.
  it.each(['V205', 'v205', 'V-205', 'v 205'])('%s opens VL205, also written V205', (typed) => {
    const view = searchResults(typed, index);
    expect(view.exact?.kind === 'room' && view.exact.code).toBe('VL205');
    expect(view.exact?.kind === 'room' && view.exact.typedAs).toBe('V205');
    expect(view.heading).toBeUndefined();
  });

  it('lists the same rooms for V2 as for VL2', () => {
    expect(codes('V2')).toStrictEqual(codes('VL2'));
    expect(codes('V2').length).toBeGreaterThan(0);
    expect(codes('V2').every((c) => c.startsWith('VL2'))).toBe(true);
  });

  it('still only suggests for VH205 (D25)', () => {
    const view = searchResults('VH205', index);
    expect(view.heading).toBe('did-you-mean');
    expect(view.exact).toBeUndefined();
    expect(codes('VH205')).toStrictEqual(['VL205']);
  });
});
