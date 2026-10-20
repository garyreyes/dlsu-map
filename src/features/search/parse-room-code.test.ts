// Room-code parsing has one right answer, and a wrong one sends a student to the wrong building or floor without any
// error. So every case asserts the exact result (toStrictEqual: no extra or missing fields), and one test proves
// every result kind can actually be produced. Rules: ARCHITECTURE §3.3, PRD §7, D18, D25, D26.
import { describe, expect, it } from 'vitest';
import { ROOM_PREFIXES } from '@/shared/config/room-prefixes';
import type { ParsedRoomCode, ParsedRoomCodeKind } from '@/shared/data/room-code';
import { parseRoomCode } from './parse-room-code';

const parse = (typed: string): ParsedRoomCode => parseRoomCode(typed, ROOM_PREFIXES);

describe('canonical prefixes: every building', () => {
  it.each([
    ['SM305', 'miguel', 3],
    ['EY301', 'yuchengco', 3],
    ['VL501', 'velasco', 5],
    ['ER201', 'razon', 2],
    ['SJ201', 'sj', 2],
    ['G304', 'gokongwei', 3],
    ['LS201', 'ls', 2],
    ['AG1104', 'andrew', 11],
    ['ST311', 'strc', 3],
    ['MM201', 'mutien', 2],
  ])('%s → %s, floor %i', (typed, building, floorFromNumber) => {
    expect(parse(typed)).toStrictEqual({ kind: 'code', code: typed, building, floorFromNumber });
  });
});

describe('aliases are stored canonical and remember how they were typed', () => {
  it('C311 → ST311, also written C311', () => {
    expect(parse('C311')).toStrictEqual({
      kind: 'code',
      code: 'ST311',
      building: 'strc',
      floorFromNumber: 3,
      typedAs: 'C311',
    });
  });

  it('VE204 → VL204, also written VE204', () => {
    expect(parse('VE204')).toStrictEqual({
      kind: 'code',
      code: 'VL204',
      building: 'velasco',
      floorFromNumber: 2,
      typedAs: 'VE204',
    });
  });

  it('a canonical prefix typed in lowercase has no typedAs', () => {
    expect(parse('st311')).toStrictEqual({ kind: 'code', code: 'ST311', building: 'strc', floorFromNumber: 3 });
  });
});

describe('format variants are the same code', () => {
  const c309 = { kind: 'code', code: 'ST309', building: 'strc', floorFromNumber: 3, typedAs: 'C309' };

  it.each(['C309', 'C-309', 'c309', 'C 309', '  c - 309  '])('%j', (typed) => {
    expect(parse(typed)).toStrictEqual(c309);
  });

  it('a letter suffix is kept and uppercased', () => {
    expect(parse('st315a')).toStrictEqual({ kind: 'code', code: 'ST315A', building: 'strc', floorFromNumber: 3 });
    expect(parse('C315A')).toStrictEqual({
      kind: 'code',
      code: 'ST315A',
      building: 'strc',
      floorFromNumber: 3,
      typedAs: 'C315A',
    });
  });
});

describe('combined directory entries are read as the first number (D18)', () => {
  it.each([
    ['ST404/406', 'ST404', 4, undefined],
    ['ST404 / 406', 'ST404', 4, undefined],
    ['ST404-406', 'ST404', 4, undefined],
    ['C102/104-106', 'ST102', 1, 'C102'],
  ])('%s → %s', (typed, code, floorFromNumber, typedAs) => {
    const expected = { kind: 'code', code, building: 'strc', floorFromNumber };
    expect(parse(typed)).toStrictEqual(typedAs ? { ...expected, typedAs } : expected);
  });
});

describe('combined entries as printed on the real signs', () => {
  it.each([
    ['J-602A/B', 'suggest', 'SJ602A'], // St. Joseph directory
    ['J-503/505/508', 'suggest', 'SJ503'],
    ['VH-208A&B', 'suggest', 'VL208A'], // Velasco directory
    ['VH-413/414', 'suggest', 'VL413'],
    ['ST402B-402C', 'code', 'ST402B'], // St. Miguel prints 402B-402C
  ])('%s → %s %s', (typed, kind, code) => {
    expect(parse(typed)).toMatchObject({ kind, code });
  });

  it('St. Miguel 101A-101B, typed without a prefix → 101A', () => {
    expect(parse('101A-101B')).toStrictEqual({ kind: 'no-prefix', roomNumber: '101A' });
  });
});

describe('phone keyboards', () => {
  const c309 = { kind: 'code', code: 'ST309', building: 'strc', floorFromNumber: 3, typedAs: 'C309' };

  it.each([
    ['en dash', 'C\u2013309'],
    ['minus sign', 'C\u2212309'],
    ['no-break space', 'C\u00A0309'],
    ['tab', 'C\t309'],
    ['zero-width space', 'C309\u200B'],
    ['full-width', '\uFF23\uFF13\uFF10\uFF19'],
  ])('%s', (_label, typed) => {
    expect(parse(typed)).toStrictEqual(c309);
  });

  it('en dash in a combined entry', () => {
    expect(parse('ST404\u2013406')).toMatchObject({ kind: 'code', code: 'ST404' });
  });
});

describe('floor from the number is number ÷ 100, rounded down', () => {
  it.each([
    ['AG701', 7],
    ['AG1001', 10],
    ['AG1111', 11],
    ['ST101', 1],
    ['ST199', 1],
    ['VL151', 1], // Velasco "G Mezz": only a guess; the room list's floor wins (D26)
  ])('%s → %i', (typed, floor) => {
    expect(parse(typed)).toMatchObject({ kind: 'code', floorFromNumber: floor });
  });
});

describe('prefixes printed on signs are suggested, never accepted (D25)', () => {
  it.each([
    ['VH501', 'VL501', 'velasco', 'VH'],
    ['VH-404A', 'VL404A', 'velasco', 'VH'],
    ['vh 501-503', 'VL501', 'velasco', 'VH'],
    ['J-201', 'SJ201', 'sj', 'J'],
    ['j 206b', 'SJ206B', 'sj', 'J'],
  ])('%s → did you mean %s', (typed, code, building, typedPrefix) => {
    expect(parse(typed)).toStrictEqual({ kind: 'suggest', code, building, typedPrefix });
  });
});

describe('letters no building uses', () => {
  it.each([
    ['X305', 'X'],
    ['abc-101', 'ABC'],
    ['GK304', 'GK'],
  ])('%s → unknown prefix %s', (typed, typedPrefix) => {
    expect(parse(typed)).toStrictEqual({ kind: 'unknown-prefix', typedPrefix });
  });
});

describe('digits with no prefix (St. Miguel prints none)', () => {
  it.each([
    ['305', '305'],
    ['101a', '101A'],
    ['305/307', '305'],
    ['1104', '1104'],
    [' 212A ', '212A'],
    ['-309', '309'], // a stray leading hyphen is harmless: it only lists rooms numbered 309
  ])('%j → %s', (typed, roomNumber) => {
    expect(parse(typed)).toStrictEqual({ kind: 'no-prefix', roomNumber });
  });
});

describe('anything else is not a code, so search uses names', () => {
  it.each([
    '',
    '   ',
    'Andrew',
    'AG', // a prefix alone: 3c shows the building
    'AFED-FA', // St. Miguel's canteen: a name, not a code
    'ST3', // still typing
    'ST31', // still typing
    '30',
    'ST31111', // five digits
    'ST315AB', // two letters after the number
    'C3O9', // letter O for zero
    '/406',
    'ST 311 lab',
    'ST311-lab', // words after a dash or slash are not a combined entry
    'ST311/lab',
    'ST404-garbage',
    'ST311-A', // ambiguous (311 or 311A?), so not guessed
    'ST0311', // room numbers never start with 0
    'ST011',
    '0305',
  ])('%j', (typed) => {
    expect(parse(typed)).toStrictEqual({ kind: 'not-a-code' });
  });
});

describe('every result kind is reachable', () => {
  it('produces all five kinds', () => {
    const kinds = new Set(['ST311', 'VH501', 'X305', '305', 'Andrew'].map((typed) => parse(typed).kind));
    const all: ParsedRoomCodeKind[] = ['code', 'suggest', 'unknown-prefix', 'no-prefix', 'not-a-code'];
    expect([...kinds].sort()).toStrictEqual([...all].sort());
  });
});

describe('the prefix table', () => {
  it('uses each prefix once across all buildings, suggest prefixes included', () => {
    const all = ROOM_PREFIXES.flatMap((b) => [...b.prefixes, ...('suggestPrefixes' in b ? b.suggestPrefixes : [])]);
    expect(all.length).toBe(new Set(all).size);
  });

  it('is read from the argument, not a hidden constant', () => {
    const table = [{ building: 'test-hall', prefixes: ['TH'] }] as const;
    expect(parseRoomCode('th202', table)).toStrictEqual({
      kind: 'code',
      code: 'TH202',
      building: 'test-hall',
      floorFromNumber: 2,
    });
    expect(parseRoomCode('ST311', table)).toStrictEqual({ kind: 'unknown-prefix', typedPrefix: 'ST' });
  });

  it('an accepted prefix wins over a suggest-only one, whatever the order', () => {
    const table = [
      { building: 'first-hall', prefixes: ['FH'], suggestPrefixes: ['X'] },
      { building: 'x-hall', prefixes: ['X'] },
    ] as const;
    expect(parseRoomCode('X101', table)).toStrictEqual({
      kind: 'code',
      code: 'X101',
      building: 'x-hall',
      floorFromNumber: 1,
    });
  });
});
