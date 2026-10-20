// data-src/rooms/<building>.csv → the rooms.json search and the room card read (3b). Pure: no I/O. Tests: rooms.test.ts
// and tests/compile-data.test.ts. Codes go through the real parseRoomCode (3a), so C → ST is decided in one place.
import { parseRoomCode } from '../../src/features/search/parse-room-code.ts';
import type { PrefixTable } from '../../src/shared/data/room-code.ts';
import { roomsSchema, type Room, type Rooms } from '../../src/shared/data/rooms.ts';

export const HEADER = ['floor', 'code', 'name', 'floor_label', 'floor_checked', 'note'] as const;

export interface RoomList {
  /** Building slug: the file's name, `strc` for `strc.csv`. */
  readonly building: string;
  /** Shown in errors, with the line: `data-src/rooms/strc.csv:12`. */
  readonly file: string;
  readonly text: string;
}
export interface RoomsResult {
  /** Null whenever there are errors: nothing broken is ever written. */
  readonly rooms: Rooms | null;
  readonly errors: string[];
  readonly notes: string[];
}

export interface CsvRow {
  /** The file line the row starts on (1 = first line), for error messages. */
  readonly line: number;
  readonly cells: string[];
}

/**
 * RFC 4180 CSV: commas, quoted fields with commas, doubled quotes or line breaks, LF or CRLF. Rows with nothing in
 * them are skipped, but every row keeps the file line it starts on. A leading byte-order mark (Excel) is dropped.
 */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endRow = () => {
    cells.push(field);
    if (cells.some((f) => f !== '')) rows.push({ line: rowLine, cells });
    cells = [];
    field = '';
  };
  const body = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < body.length; i++) {
    const ch = body.charAt(i);
    if (ch === '\n') line++;
    if (quoted) {
      if (ch === '"' && body.charAt(i + 1) === '"') field += body.charAt(++i);
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(field);
      field = '';
    } else if (ch === '\n') {
      endRow();
      rowLine = line;
    } else field += ch;
  }
  endRow();
  return rows;
}

export type Expanded = { building: string; codes: string[] } | { error: string };

/** The first code of a printed entry, through the real parser. */
function firstCode(head: string, table: PrefixTable): { building: string; code: string } | { error: string } {
  const parsed = parseRoomCode(head, table);
  switch (parsed.kind) {
    case 'code':
      return { building: parsed.building, code: parsed.code };
    case 'suggest':
      return { error: `${parsed.typedPrefix} is only suggested (D25); type it as ${parsed.code}` };
    case 'unknown-prefix':
      return { error: `no building uses the prefix ${parsed.typedPrefix}` };
    default:
      return { error: 'not a room code' };
  }
}

/** A printed entry as rooms (D18): `C404/406` → ST404 and ST406; `C102/104-106` → 102, 104, 106; `ST315/B` → ST315B. */
export function expandCodes(printed: string, table: PrefixTable): Expanded {
  const m = /^\s*([A-Za-z]+\s*-?\s*[1-9]\d{2,3}[A-Za-z]?)((?:\s*[/&-]\s*[^/&-]*)*)$/.exec(printed);
  const first = firstCode(m?.[1] ?? printed, table);
  if ('error' in first) return first;
  const base = /^([A-Z]+?)(\d+)([A-Z]?)$/.exec(first.code);
  if (!m || !base) return { error: 'not a room code' };
  const [, prefix = '', number = ''] = base;
  const codes = [first.code];
  for (const part of (m[2] ?? '').split(/[/&-]/).slice(1)) {
    const p = part.trim().toUpperCase();
    if (/^\d+[A-Z]?$/.test(p)) {
      if (p.replace(/[A-Z]$/, '').length !== number.length || p.startsWith('0')) {
        return { error: `"${part.trim()}" is not a whole room number like ${number}` };
      }
      codes.push(prefix + p);
    } else if (/^[A-Z]$/.test(p)) codes.push(prefix + number + p);
    else return { error: `"${part.trim()}" is not a room number or letter` };
  }
  return { building: first.building, codes };
}

interface Seen {
  readonly where: string;
}
interface Context {
  readonly table: PrefixTable;
  readonly levels: ReadonlyMap<string, number>;
  readonly seen: Map<string, Seen>;
  readonly errors: string[];
}

/** The floor column as a floor of this building, or an error. */
function readFloor(value: string, building: string, ctx: Context): number | string {
  if (!/^[1-9]\d*$/.test(value)) return `floor "${value}" is not a whole number (G is 1)`;
  const floor = Number(value);
  const levels = ctx.levels.get(building) ?? 0;
  return floor <= levels ? floor : `${building} has no floor ${value}`;
}

/** One CSV row → its rooms, or one error (a bad row adds none of its rooms, and doesn't bury the other rows). */
function readRow(cells: readonly string[], where: string, list: RoomList, ctx: Context): Room[] {
  const fail = (message: string): Room[] => (ctx.errors.push(`${where}: ${message}`), []);
  if (cells.length !== HEADER.length) {
    return fail(`expected ${String(HEADER.length)} columns, found ${String(cells.length)}`);
  }
  const [floorText = '', printed = '', name = '', floorLabel = '', checkedText = ''] = cells.map((c) => c.trim());
  const checked = checkedText.toLowerCase();
  if (name === '') return fail('no name');
  if (checked !== '' && checked !== 'yes') return fail('floor_checked must be "yes" or empty');
  const floor = readFloor(floorText, list.building, ctx);
  if (typeof floor === 'string') return fail(floor);
  const expanded = expandCodes(printed, ctx.table);
  if ('error' in expanded) return fail(`"${printed}": ${expanded.error}`);
  if (expanded.building !== list.building) {
    return fail(`${expanded.codes.join(', ')} is a ${expanded.building} code, but this is ${list.building}'s list`);
  }
  for (const code of expanded.codes) {
    const byNumber = Math.floor(Number(/\d+/.exec(code)?.[0]) / 100);
    if (byNumber !== floor && checked !== 'yes') {
      return fail(
        `${code} is on floor ${String(floor)}, not ${String(byNumber)} (number ÷ 100); set floor_checked if that is right (D26)`,
      );
    }
    const earlier = ctx.seen.get(code);
    if (earlier) return fail(`${code} is also on ${earlier.where}`);
  }
  for (const code of expanded.codes) ctx.seen.set(code, { where });
  return expanded.codes.map((code) => ({
    code,
    building: list.building,
    floor,
    ...(floorLabel !== '' && { floorLabel }),
    name,
  }));
}

/** One building's list → its rooms. */
function readList(list: RoomList, ctx: Context): Room[] {
  if (!ctx.table.some((b) => b.building === list.building)) {
    ctx.errors.push(`${list.file}: ${list.building} is not a building with room codes`);
    return [];
  }
  const [header, ...rows] = parseCsv(list.text);
  if (header?.cells.map((c) => c.trim()).join(',') !== HEADER.join(',')) {
    ctx.errors.push(`${list.file}:1: header must be "${HEADER.join(',')}"`);
    return [];
  }
  return rows.flatMap((row) => readRow(row.cells, `${list.file}:${String(row.line)}`, list, ctx));
}

/** "rooms: strc 62 (floor 1: 13, floor 2: 19, …)" for each building, in list order. */
function report(lists: readonly RoomList[], rooms: readonly Room[]): string[] {
  return lists.flatMap((list) => {
    const own = rooms.filter((r) => r.building === list.building);
    if (own.length === 0) return [];
    const floors = [...new Set(own.map((r) => r.floor))].sort((a, b) => a - b);
    const perFloor = floors.map((f) => `floor ${String(f)}: ${String(own.filter((r) => r.floor === f).length)}`);
    return [`rooms: ${list.building} ${String(own.length)} (${perFloor.join(', ')})`];
  });
}

/** Prefix, then room number as a number, then letter: AG105, AG201, AG201A, AG1104. */
function byCode(a: Room, b: Room): number {
  const parts = (code: string) => /^([A-Z]+)(\d+)([A-Z]?)$/.exec(code) ?? [];
  const [, pa = '', na = '0', la = ''] = parts(a.code);
  const [, pb = '', nb = '0', lb = ''] = parts(b.code);
  return pa.localeCompare(pb) || Number(na) - Number(nb) || la.localeCompare(lb);
}

export function compileRooms(
  lists: readonly RoomList[],
  table: PrefixTable,
  levels: ReadonlyMap<string, number>,
): RoomsResult {
  const ctx: Context = { table, levels, seen: new Map(), errors: [] };
  const rooms = lists.flatMap((list) => readList(list, ctx)).sort(byCode);
  const checked = roomsSchema.safeParse({ rooms });
  if (ctx.errors.length === 0 && !checked.success) {
    ctx.errors.push(...checked.error.issues.map((i) => `rooms.json ${i.path.join('.')}: ${i.message}`));
  }
  return {
    rooms: ctx.errors.length === 0 && checked.success ? checked.data : null,
    errors: ctx.errors,
    notes: report(lists, rooms),
  };
}
