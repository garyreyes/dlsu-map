// What S2 shows for what was typed (3c): one note, one optional heading, the rows, and the one row the keyboard's Go
// key may open. Pure: no React, no fetch. Rules: user-flows §3.3, PRD §7 (strict), D18, D25, D38.
// Tests: search-results.test.ts.
import { findPrefix, normalize, parseRoomCode } from './parse-room-code.ts';
import { words, type Hit, type RoomHit, type SearchBuilding, type SearchIndex } from './search-index.ts';

export type { BuildingHit, Hit, RoomHit, SearchBuilding } from './search-index.ts';

/** A building named in a note: the full name, for "St. Joseph Hall's rooms aren't in the app yet." */
interface NoteBuilding {
  readonly slug: string;
  readonly name: string;
}

export type SearchNote =
  /** "ST350 isn't in our list." Always the canonical code, even when typed as C350. */
  | { readonly kind: 'not-in-list'; readonly code: string }
  /** "No building uses X." */
  | { readonly kind: 'unknown-prefix'; readonly prefix: string }
  /** A real prefix whose building has no room list yet (9a–9d): "Andrew Hall's rooms aren't in the app yet." */
  | { readonly kind: 'no-room-list'; readonly building: NoteBuilding }
  /** A block-tier building (D20): "Henry Sy Sr. Hall isn't in search yet." */
  | { readonly kind: 'not-searchable'; readonly building: NoteBuilding }
  /** Nothing at all: room names aren't searched in v1. */
  | { readonly kind: 'no-match'; readonly typed: string };

export interface SearchView {
  readonly note?: SearchNote;
  readonly heading?: 'did-you-mean' | 'buildings';
  readonly hits: readonly Hit[];
  /** What Go opens: only an exact room or building, never a suggestion (D38). */
  readonly exact?: Hit;
}

/** Rows shown while a code is still being typed, or as Did you mean. */
const MAX = 8;
const EMPTY: SearchView = { hits: [] };
// Prefix letters, then the first one or two digits of a room number: "ST3", "ag 11", "J-20".
const PARTIAL = /^([A-Z]+)\s*-?\s*(\d{1,2})$/;
/** Shorter typed words aren't checked for typos: "st" one typo from half the campus would be noise. */
const TYPO_MIN = 4;

const buildingHit = (building: SearchBuilding): Hit => ({ kind: 'building', building });

export function searchResults(typed: string, index: SearchIndex): SearchView {
  const text = normalize(typed);
  if (text === '') return EMPTY;
  const parsed = parseRoomCode(typed, index.table);
  switch (parsed.kind) {
    case 'code':
      return codeView(index, parsed.code, parsed.building, { typedAs: parsed.typedAs });
    case 'suggest':
      return codeView(index, parsed.code, parsed.building, { suggest: true });
    case 'no-prefix':
      return numberView(index, parsed.roomNumber);
    case 'unknown-prefix':
      return {
        note: { kind: 'unknown-prefix', prefix: parsed.typedPrefix },
        heading: 'buildings',
        hits: index.buildings.map(buildingHit),
      };
    case 'not-a-code':
      return partialView(index, text) ?? nameView(index, typed, text);
  }
}

interface CodeOptions {
  /** A sign prefix (D25): everything is Did you mean, and Go opens nothing. */
  readonly suggest?: boolean;
  readonly typedAs?: string | undefined;
}

/** A code, whole or partial, in a known building: the room, the rooms starting with it, or a rejection. */
function codeView(index: SearchIndex, code: string, slug: string, options: CodeOptions): SearchView {
  const building = index.bySlug.get(slug);
  if (!building) return { note: { kind: 'not-in-list', code }, hits: [] };
  if (!building.hasRooms) return { note: { kind: 'no-room-list', building }, hits: [buildingHit(building)] };

  const found = index.byCode.get(code);
  const first: RoomHit[] = found ? [options.typedAs ? { ...found, typedAs: options.typedAs } : found] : [];
  const longer = index.rooms.filter((r) => r !== found && r.building === building && r.code.startsWith(code));
  const hits = [...first, ...longer].slice(0, MAX);
  if (hits.length > 0) {
    if (options.suggest) return { heading: 'did-you-mean', hits };
    return first[0] ? { hits, exact: first[0] } : { hits };
  }

  const note: SearchNote = { kind: 'not-in-list', code };
  const near = index.rooms.filter((r) => r.building === building && oneTypo(r.code, code)).slice(0, MAX);
  return near.length > 0 ? { note, heading: 'did-you-mean', hits: near } : { note, hits: [] };
}

/** "ST3", "c40", "VH5": a prefix and the start of a number. Null when it isn't one, so names get a turn. */
function partialView(index: SearchIndex, text: string): SearchView | null {
  const match = PARTIAL.exec(text);
  if (!match) return /^\d+$/.test(text) ? EMPTY : null; // one or two bare digits: keep typing
  const [, prefix = '', digits = ''] = match;
  const found = findPrefix(index.table, prefix);
  if (!found) return null;
  return codeView(index, found.canonical + digits, found.building, { suggest: found.suggestOnly });
}

/** "305" with no prefix, as St. Miguel's signs print it: that number in every building. Go opens none of them. */
function numberView(index: SearchIndex, roomNumber: string): SearchView {
  const hits = index.rooms.filter((r) => r.code.slice(r.building.prefix.length) === roomNumber);
  return hits.length > 0 ? { hits } : { note: { kind: 'not-in-list', code: roomNumber }, hits: [] };
}

/** A building's name, alias or prefix. Each typed word must start a word of one name; an exact name comes first. */
function nameView(index: SearchIndex, typed: string, text: string): SearchView {
  const typedWords = words(typed);
  const whole = typedWords.join(' ');
  // A one-letter prefix (C, G) still lists its building, but isn't exact: it may be the start of a code (C311).
  const isExact = (n: SearchIndex['named'][number]) =>
    (text.length > 1 && n.prefixes.includes(text)) || n.words.some((w) => w.join(' ') === whole);
  const matches = index.named.filter(
    (n) =>
      n.prefixes.includes(text) ||
      (typedWords.length > 0 && n.words.some((w) => typedWords.every((t) => w.some((word) => word.startsWith(t))))),
  );

  const searchable = matches.filter((n) => n.building !== null);
  if (searchable.length > 0) {
    const exact = searchable.find(isExact);
    const ordered = exact ? [exact, ...searchable.filter((n) => n !== exact)] : searchable;
    const hits = ordered.flatMap((n) => (n.building ? [buildingHit(n.building)] : []));
    return exact && hits[0] ? { hits, exact: hits[0] } : { hits };
  }

  const block = matches[0];
  if (block) return { note: { kind: 'not-searchable', building: { slug: block.slug, name: block.name } }, hits: [] };

  const misspelt = misspeltBuildings(index, typedWords);
  if (misspelt.length > 0) return { heading: 'did-you-mean', hits: misspelt.map(buildingHit) };
  return { note: { kind: 'no-match', typed: typed.trim() }, hits: [] };
}

/** Names one typo per word away (velsaco → Velasco, andrw → Andrew): the same check as codes, word by word (D38). */
function misspeltBuildings(index: SearchIndex, typedWords: readonly string[]): SearchBuilding[] {
  const near = (t: string, word: string) => word.startsWith(t) || (t.length >= TYPO_MIN && oneTypo(word, t));
  return index.named.flatMap((n) =>
    n.building && typedWords.length > 0 && n.words.some((w) => typedWords.every((t) => w.some((word) => near(t, word))))
      ? [n.building]
      : [],
  );
}

/** True when b is a with one character changed, added, dropped, or two neighbours swapped (ST350 → ST305, ST310). */
export function oneTypo(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    const [i = 0, j = 0] = diff;
    return diff.length === 1 || (diff.length === 2 && j === i + 1 && a[i] === b[j] && a[j] === b[i]);
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (long.length - short.length !== 1) return false;
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}
