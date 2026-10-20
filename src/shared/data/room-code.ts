// The room-code meeting point between the lanes (docs/SPLIT.md): Lane B's parser (3a) returns ParsedRoomCode, and
// Lane A's search and room card (3c, 3d) show one message per kind. Rules: ARCHITECTURE §3.3, D18, D25, D26.

/** One building's room-code prefixes, from `campus.json` via `toPrefixTable` (`prefix-table.ts`). */
export interface BuildingPrefixes {
  /** Building slug, e.g. `'strc'`. */
  readonly building: string;
  /** Accepted prefixes, canonical first: `['ST', 'C']` stores and shows `C311` as `ST311`. */
  readonly prefixes: readonly [string, ...string[]];
  /** Prefixes printed on signs that are only suggested, never accepted (D25): `['VH']` for Velasco. */
  readonly suggestPrefixes?: readonly string[];
}

export type PrefixTable = readonly BuildingPrefixes[];

/** What the student typed, sorted into one of five results. The parser never checks `rooms.json`. */
export type ParsedRoomCode =
  /** A code in a known building: `ST311`, `c-311`, `AG1104`, `ST404/406` (read as `ST404`). */
  | {
      readonly kind: 'code';
      /** Canonical code: canonical prefix + number + optional capital letter, e.g. `'ST315A'`. */
      readonly code: string;
      readonly building: string;
      /** Number ÷ 100, rounded down. Only a guess: the room's floor in `rooms.json` wins (mezzanines, D26). */
      readonly floorFromNumber: number;
      /** Set only when typed with an alias prefix, as `'C311'`, so the list can say "also written C311". */
      readonly typedAs?: string;
    }
  /** A prefix from a sign that isn't ours (D25): `VH501` → "Did you mean VL501 (Velasco)?" */
  | { readonly kind: 'suggest'; readonly code: string; readonly building: string; readonly typedPrefix: string }
  /** Letters no building uses: `X305` → "No building uses X." plus the building list. */
  | { readonly kind: 'unknown-prefix'; readonly typedPrefix: string }
  /** Digits with no prefix, as St. Miguel's directory prints them: `305` or `305A`. */
  | { readonly kind: 'no-prefix'; readonly roomNumber: string }
  /** Anything else (`Andrew`, `AFED-FA`, empty): search by name instead. */
  | { readonly kind: 'not-a-code' };

export type ParsedRoomCodeKind = ParsedRoomCode['kind'];

/** The parser's signature (3a, `src/features/search/parse-room-code.ts`). Pure: no React, no fetch. */
export type ParseRoomCode = (typed: string, table: PrefixTable) => ParsedRoomCode;
