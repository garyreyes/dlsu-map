// Room-code parser (3a): sorts what a student typed into one of five results. Pure: no React, no fetch, and it never
// checks rooms.json (3c does). Rules: ARCHITECTURE §3.3, D18, D25, D26. Tests: parse-room-code.test.ts.
import type { ParseRoomCode, PrefixTable } from '@/shared/data/room-code';

// The rest of a combined directory entry, as printed on the signs: "/406", "-406", "/104-106" (another number) or
// "/B", "&B" (another letter: "J-602A/B", "VH-208A&B"). It is ignored: the first number wins (D18).
const MORE = String.raw`\s*(?:[/-]\s*\d{3,4}[A-Z]?|[/&]\s*[A-Z])`;
// Letters, an optional hyphen, 3–4 digits not starting with 0, an optional letter, then any combined-entry tail.
// Anything else ("ST311-lab", "ST311-A") is not a code, so search falls back to names instead of guessing.
const CODE = new RegExp(String.raw`^([A-Z]*)\s*-?\s*([1-9]\d{2,3})([A-Z]?)(?:${MORE})*$`);

/** Phone keyboards: full-width letters and digits (NFKC), smart dashes, and invisible zero-width characters. */
function normalize(typed: string): string {
  return typed
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim()
    .toUpperCase();
}

interface PrefixMatch {
  readonly building: string;
  readonly canonical: string;
  readonly suggestOnly: boolean;
}

/** An accepted prefix anywhere in the table wins over a suggest-only one (D25). */
function findPrefix(table: PrefixTable, prefix: string): PrefixMatch | undefined {
  const accepted = table.find((b) => b.prefixes.includes(prefix));
  if (accepted) return { building: accepted.building, canonical: accepted.prefixes[0], suggestOnly: false };
  const suggested = table.find((b) => b.suggestPrefixes?.includes(prefix));
  if (suggested) return { building: suggested.building, canonical: suggested.prefixes[0], suggestOnly: true };
  return undefined;
}

export const parseRoomCode: ParseRoomCode = (typed, table) => {
  const match = CODE.exec(normalize(typed));
  if (!match) return { kind: 'not-a-code' };

  const [, prefix = '', digits = '', letter = ''] = match;
  const roomNumber = digits + letter;
  if (prefix === '') return { kind: 'no-prefix', roomNumber };

  const found = findPrefix(table, prefix);
  if (!found) return { kind: 'unknown-prefix', typedPrefix: prefix };

  const { building, canonical } = found;
  const code = canonical + roomNumber;
  if (found.suggestOnly) return { kind: 'suggest', code, building, typedPrefix: prefix };

  const result = { kind: 'code', code, building, floorFromNumber: Math.floor(Number(digits) / 100) } as const;
  return prefix === canonical ? result : { ...result, typedAs: prefix + roomNumber };
};
