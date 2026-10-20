// Room lists → rooms.json. A wrong expansion or floor sends a student to the wrong room without any error, so each
// rule asserts the exact rooms produced, and each kind of bad row must fail the build (ARCHITECTURE §3.4, D18, D26).
import { describe, expect, it } from 'vitest';
import { compileRooms, expandCodes, parseCsv, type RoomList } from './rooms.ts';

const TABLE = [
  { building: 'strc', prefixes: ['ST', 'C'] },
  { building: 'velasco', prefixes: ['VL', 'VE'], suggestPrefixes: ['VH'] },
] as const;
const LEVELS = new Map([
  ['strc', 4],
  ['velasco', 5],
]);
const HEADER = 'floor,code,name,floor_label,floor_checked,note';
const list = (building: string, ...rows: string[]): RoomList => ({
  building,
  file: `data-src/rooms/${building}.csv`,
  text: [HEADER, ...rows].join('\n'),
});
const compile = (...lists: RoomList[]) => compileRooms(lists, TABLE, LEVELS);

describe('parseCsv', () => {
  it('reads plain rows, quoted commas, doubled quotes, CRLF and a trailing newline', () => {
    expect(parseCsv('a,b,c\r\n1,"x, y","say ""hi"""\n2,,\n')).toStrictEqual([
      { line: 1, cells: ['a', 'b', 'c'] },
      { line: 2, cells: ['1', 'x, y', 'say "hi"'] },
      { line: 3, cells: ['2', '', ''] },
    ]);
  });

  it('gives each row the file line it starts on, past blank lines and quoted line breaks', () => {
    expect(parseCsv('h\n\n"two\nlines"\n,,\nlast').map((r) => r.line)).toStrictEqual([1, 3, 6]);
  });

  it('drops the byte-order mark Excel puts at the start of a UTF-8 CSV', () => {
    expect(parseCsv('\uFEFFfloor,code')).toStrictEqual([{ line: 1, cells: ['floor', 'code'] }]);
  });
});

describe('expandCodes (D18: every number is its own room)', () => {
  it.each([
    ['C404/406', ['ST404', 'ST406']],
    ['C-211/213', ['ST211', 'ST213']],
    ['C102/104-106', ['ST102', 'ST104', 'ST106']],
    ['C315A', ['ST315A']],
    ['C107B', ['ST107B']],
    ['C-309', ['ST309']],
    ['c 311', ['ST311']],
    ['ST315/B', ['ST315', 'ST315B']],
    ['VL501', ['VL501']],
  ])('%s → %j', (printed, codes) => {
    expect(expandCodes(printed, TABLE)).toStrictEqual({
      building: printed.startsWith('V') ? 'velasco' : 'strc',
      codes,
    });
  });

  it.each([
    ['VH501', 'VH is only suggested (D25); type it as VL501'],
    ['X101', 'no building uses the prefix X'],
    ['Lobby', 'not a room code'],
    ['C404/06', '"06" is not a whole room number like 404'],
    ['C404/lab', '"lab" is not a room number or letter'],
  ])('rejects %s: %s', (printed, error) => {
    expect(expandCodes(printed, TABLE)).toStrictEqual({ error });
  });
});

describe('compileRooms', () => {
  it('gives each room its canonical code, building, floor and name, sorted by code', () => {
    const { rooms, errors } = compile(
      list('strc', '4,C404/406,Biology Lab,,,', '1,C-112,ECE Office,,,', '3,C315A,CMD Lab,,,'),
    );
    expect(errors).toStrictEqual([]);
    expect(rooms?.rooms).toStrictEqual([
      { code: 'ST112', building: 'strc', floor: 1, name: 'ECE Office' },
      { code: 'ST315A', building: 'strc', floor: 3, name: 'CMD Lab' },
      { code: 'ST404', building: 'strc', floor: 4, name: 'Biology Lab' },
      { code: 'ST406', building: 'strc', floor: 4, name: 'Biology Lab' },
    ]);
  });

  it('keeps a mezzanine label and lets a checked room sit off number ÷ 100 (D26)', () => {
    const { rooms, errors } = compile(
      list('velasco', "1,VL151,Dean's Office,G Mezz,,", '2,VL151A,Odd Room,,yes,checked on site'),
    );
    expect(errors).toStrictEqual([]);
    expect(rooms?.rooms).toStrictEqual([
      { code: 'VL151', building: 'velasco', floor: 1, floorLabel: 'G Mezz', name: "Dean's Office" },
      { code: 'VL151A', building: 'velasco', floor: 2, name: 'Odd Room' },
    ]);
  });

  it('counts rooms per floor for the compile report', () => {
    const { notes } = compile(list('strc', '1,C101,A,,,', '1,C102/104,B,,,', '4,C401,C,,,'));
    expect(notes).toStrictEqual(['rooms: strc 4 (floor 1: 3, floor 4: 1)']);
  });

  it('sorts by prefix, then room number, then letter (AG201 before AG1104)', () => {
    const table = [{ building: 'andrew', prefixes: ['AG'] }] as const;
    const andrew = {
      ...list('andrew', '11,AG1104,A,,,', '2,AG201,B,,,', '2,AG201A,C,,,', '1,AG105,D,,,'),
      building: 'andrew',
    };
    const { rooms } = compileRooms([andrew], table, new Map([['andrew', 20]]));
    expect(rooms?.rooms.map((r) => r.code)).toStrictEqual(['AG105', 'AG201', 'AG201A', 'AG1104']);
  });

  it('reads a header with spaces and floor_checked in any case', () => {
    const text = 'floor, code, name, floor_label, floor_checked, note\n2,VL151A,Odd Room,,Yes,';
    const { errors } = compileRooms([{ building: 'velasco', file: 'v.csv', text }], TABLE, LEVELS);
    expect(errors).toStrictEqual([]);
  });
});

describe('compileRooms errors (the build fails on each)', () => {
  const at = (line: number) => `data-src/rooms/strc.csv:${String(line)}`;

  it.each([
    ['a code on two rows', ['4,C404/406,Biology Lab,,,', '4,C406,Other,,,'], `${at(3)}: ST406 is also on ${at(2)}`],
    [
      'a floor that does not match number ÷ 100',
      ['3,C404,Lab,,,'],
      `${at(2)}: ST404 is on floor 3, not 4 (number ÷ 100); set floor_checked if that is right (D26)`,
    ],
    ['a floor the building does not have', ['5,C501,Lab,,,'], `${at(2)}: strc has no floor 5`],
    ['a floor that is not a whole number', ['G,C101,Lab,,,'], `${at(2)}: floor "G" is not a whole number (G is 1)`],
    ['another building’s prefix', ['4,VL401,Lab,,,'], `${at(2)}: VL401 is a velasco code, but this is strc's list`],
    ['a code that is not a code', ['1,Lobby,Lobby,,,'], `${at(2)}: "Lobby": not a room code`],
    ['an empty name', ['1,C101,,,,'], `${at(2)}: no name`],
    ['a short row', ['1,C101'], `${at(2)}: expected 6 columns, found 2`],
    ['floor_checked other than yes', ['1,C101,Lab,,maybe,'], `${at(2)}: floor_checked must be "yes" or empty`],
  ])('%s', (_label, rows, error) => {
    const { errors, rooms } = compile(list('strc', ...rows));
    expect(errors).toStrictEqual([error]);
    expect(rooms).toBeNull();
  });

  it('points at the real file line after a blank line', () => {
    const { errors } = compile(list('strc', '1,C101,Lab,,,', '', '1,C101,Again,,,'));
    expect(errors).toStrictEqual([`${at(4)}: ST101 is also on ${at(2)}`]);
  });

  it('gives a combined entry on the wrong floor one error, not one per room', () => {
    const { errors } = compile(list('strc', '3,C404/406,Lab,,,'));
    expect(errors).toStrictEqual([
      `${at(2)}: ST404 is on floor 3, not 4 (number ÷ 100); set floor_checked if that is right (D26)`,
    ]);
  });

  it('names a list whose header is wrong', () => {
    const { errors } = compileRooms(
      [{ building: 'strc', file: 'x.csv', text: 'floor,code,name\n1,C101,Lab' }],
      TABLE,
      LEVELS,
    );
    expect(errors).toStrictEqual([`x.csv:1: header must be "${HEADER}"`]);
  });

  it('names a list for a building with no room codes', () => {
    const { errors } = compileRooms([{ building: 'connon', file: 'c.csv', text: HEADER }], TABLE, LEVELS);
    expect(errors).toStrictEqual(['c.csv: connon is not a building with room codes']);
  });

  it('catches the same code in two buildings’ lists', () => {
    const { errors } = compile(list('strc', '1,C101,Lab,,,'), { ...list('strc', '1,ST101,Lab,,,'), file: 'other.csv' });
    expect(errors).toStrictEqual([`other.csv:2: ST101 is also on ${at(2)}`]);
  });
});
