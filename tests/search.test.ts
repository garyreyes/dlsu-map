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

  // D53: the one-letter shortcuts students type open the room, like V. MM stays Mutien-Marie.
  it.each([
    ['J204', 'SJ204'],
    ['j-204', 'SJ204'],
    ['M204', 'SM204'],
    ['m 204', 'SM204'],
  ])('%s opens %s, also written as typed', (typed, code) => {
    const view = searchResults(typed, index);
    expect(view.exact?.kind === 'room' && view.exact.code).toBe(code);
    expect(view.exact?.kind === 'room' && view.exact.typedAs).toBe(typed.replace(/[\s-]/g, '').toUpperCase());
    expect(view.heading).toBeUndefined();
  });

  it.each([
    ['A1104', 'andrew'],
    ['Y305', 'yuchengco'],
  ])('%s is %s, whose rooms aren’t in the app yet', (typed, slug) => {
    const view = searchResults(typed, index);
    expect(view.note?.kind === 'no-room-list' && view.note.building.slug).toBe(slug);
  });

  it('lists the same rooms for J2 as for SJ2, and for M2 as for SM2', () => {
    expect(codes('J2')).toStrictEqual(codes('SJ2'));
    expect(codes('M2')).toStrictEqual(codes('SM2'));
    expect(codes('J2').length).toBeGreaterThan(0);
  });

  it('still only suggests for VH205 (D25)', () => {
    const view = searchResults('VH205', index);
    expect(view.heading).toBe('did-you-mean');
    expect(view.exact).toBeUndefined();
    expect(codes('VH205')).toStrictEqual(['VL205']);
  });
});
