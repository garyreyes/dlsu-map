import { describe, expect, it } from 'vitest';
import { buildSearchIndex, searchResults } from '@/features/search';
import { atFloor, atGate, chooseEnter, chooseHit, nextTo } from './choose';

// Search's own index and results, so the code box is tested against exactly what S2 shows (D38). A fixed slice of
// the data: STRC and Velasco with rooms (Velasco's signs print VH, D25), Andrew with none yet.
const INDEX = buildSearchIndex(
  [
    { code: 'ST404', building: 'strc', floor: 4, name: 'Biology Lab' },
    { code: 'VL305', building: 'velasco', floor: 3, name: 'Classroom' },
    { code: 'VL501', building: 'velasco', floor: 5, name: 'Classroom' },
  ],
  [
    {
      slug: 'andrew',
      name: 'Br. Andrew Gonzalez Hall',
      short: 'Andrew',
      aliases: ['Andrew'],
      tier: 'full',
      prefixes: ['AG'],
    },
    {
      slug: 'velasco',
      name: 'Velasco Hall',
      short: 'Velasco',
      aliases: ['Velasco'],
      tier: 'full',
      prefixes: ['VL', 'VE'],
      suggestPrefixes: ['VH'],
      floorLabels: { '1': 'G' },
    },
    {
      slug: 'strc',
      name: 'Science & Technology Research Center',
      short: 'STRC',
      aliases: ['STRC'],
      tier: 'full',
      prefixes: ['ST', 'C'],
      floorLabels: { '1': 'G' },
    },
  ],
);

const ST404 = { kind: 'room', code: 'ST404' } as const;
const enter = (typed: string, to: Parameters<typeof chooseEnter>[1] = null) =>
  chooseEnter(searchResults(typed, INDEX), to);
const exactOf = (typed: string) => {
  const hit = searchResults(typed, INDEX).exact;
  if (!hit) throw new Error(`${typed} has no exact hit`);
  return hit;
};

describe('the tap flow', () => {
  it('a building and a floor: that floor, G being floor 1 (PRD UC2)', () => {
    expect(atFloor('andrew', 11)).toEqual({ kind: 'building', building: 'andrew', floor: 11 });
    expect(atFloor('velasco', 1)).toEqual({ kind: 'building', building: 'velasco', floor: 1 });
  });

  it('a gate: its id', () => {
    expect(atGate('gate-4a')).toEqual({ kind: 'gate', gate: 'gate-4a' });
  });

  it("next to a building: that building's ground floor, so its main entrance", () => {
    expect(nextTo('razon')).toEqual({ kind: 'building', building: 'razon', floor: 1 });
  });
});

describe('chooseHit: tapping a result in the code box', () => {
  it("a room sets From to that room's door, by its canonical code (D23)", () => {
    expect(chooseHit(exactOf('ST404'), null)).toEqual({ kind: 'from', from: { kind: 'room', code: 'ST404' } });
  });

  it('a room typed with an alias prefix is still its canonical code', () => {
    expect(chooseHit(exactOf('C404'), null)).toEqual({ kind: 'from', from: { kind: 'room', code: 'ST404' } });
  });

  it('a building goes on to its floors, never straight to a guessed floor', () => {
    expect(chooseHit(exactOf('Velasco'), null)).toEqual({ kind: 'floors', building: 'velasco' });
  });

  it('the room you are going to: "same", never a route from it to itself', () => {
    expect(chooseHit(exactOf('ST404'), ST404)).toEqual({ kind: 'same', code: 'ST404' });
    expect(chooseHit(exactOf('C404'), ST404)).toEqual({ kind: 'same', code: 'ST404' });
  });

  it('a room in the building you are going to is not "same"', () => {
    expect(chooseHit(exactOf('ST404'), { kind: 'building', building: 'strc' })).toEqual({
      kind: 'from',
      from: { kind: 'room', code: 'ST404' },
    });
  });
});

describe("chooseEnter: the keyboard's Enter, which takes only an exact room or building (D38)", () => {
  it('an exact room', () => {
    expect(enter('st404')).toEqual({ kind: 'from', from: { kind: 'room', code: 'ST404' } });
    expect(enter('ST404', ST404)).toEqual({ kind: 'same', code: 'ST404' });
  });

  it('an exact building', () => {
    expect(enter('velasco')).toEqual({ kind: 'floors', building: 'velasco' });
  });

  it.each([
    ['a code still being typed', 'ST40'],
    ['a code not in the list', 'ST405'],
    ['a sign prefix, which is only ever suggested (D25)', 'VH501'],
    ['a building with no room list yet: never a guessed room', 'AG1104'],
    ['a bare number', '305'],
    ['nothing typed', '  '],
  ])('nothing for %s', (_, typed) => {
    expect(enter(typed)).toBeNull();
  });

  it('nothing before the rooms have loaded', () => {
    expect(chooseEnter(null, null)).toBeNull();
  });
});
