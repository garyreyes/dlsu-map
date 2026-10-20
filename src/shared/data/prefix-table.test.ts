// The prefix table decides which building a typed code belongs to. Two buildings sharing a prefix would send a student
// to one of them at random (ARCHITECTURE §3.4), so every clash must be caught and named.
import { describe, expect, it } from 'vitest';
import { prefixClashes, toPrefixTable } from './prefix-table';

const b = (slug: string, prefixes: string[], suggestPrefixes?: string[]) => ({ slug, prefixes, suggestPrefixes });

describe('toPrefixTable', () => {
  it('keeps buildings with prefixes, in order, and drops those without', () => {
    expect(toPrefixTable([b('strc', ['ST', 'C']), b('connon', []), b('velasco', ['VL', 'VE'], ['VH'])])).toStrictEqual([
      { building: 'strc', prefixes: ['ST', 'C'] },
      { building: 'velasco', prefixes: ['VL', 'VE'], suggestPrefixes: ['VH'] },
    ]);
  });
});

describe('prefixClashes', () => {
  it('finds none in a clean list', () => {
    expect(prefixClashes([b('strc', ['ST', 'C']), b('velasco', ['VL'], ['VH']), b('connon', [])])).toStrictEqual([]);
  });

  it.each([
    ['two accepted prefixes', [b('strc', ['ST']), b('andrew', ['AG', 'ST'])], 'ST: strc, andrew'],
    ['a suggest prefix and an accepted one', [b('sj', ['SJ'], ['J']), b('jhall', ['J'])], 'J: sj, jhall'],
    ['two suggest prefixes', [b('velasco', ['VL'], ['VH']), b('x', ['X'], ['VH'])], 'VH: velasco, x'],
    ['the same prefix twice in one building', [b('strc', ['ST', 'ST'])], 'ST: strc, strc'],
  ])('names %s', (_label, buildings, message) => {
    expect(prefixClashes(buildings)).toStrictEqual([message]);
  });
});
