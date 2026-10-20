// The room-code prefix table, built from the buildings in campus.json (or buildings.json in the compiler), so the
// prefixes live in one place. Search (3c) passes the result to parseRoomCode. Tests: prefix-table.test.ts.
import type { BuildingPrefixes, PrefixTable } from './room-code.ts';

interface WithPrefixes {
  readonly slug: string;
  readonly prefixes: readonly string[];
  readonly suggestPrefixes?: readonly string[] | undefined;
}

/** Buildings with room codes, in their given order. Buildings without prefixes (Connon, Henry Sy) are left out. */
export function toPrefixTable(buildings: readonly WithPrefixes[]): PrefixTable {
  return buildings.flatMap((b): BuildingPrefixes[] => {
    const [canonical, ...rest] = b.prefixes;
    if (canonical === undefined) return [];
    const entry = { building: b.slug, prefixes: [canonical, ...rest] as const };
    return [b.suggestPrefixes ? { ...entry, suggestPrefixes: b.suggestPrefixes } : entry];
  });
}

/** One message per prefix (accepted or suggested) used more than once: `'ST: strc, andrew'` (ARCHITECTURE §3.4). */
export function prefixClashes(buildings: readonly WithPrefixes[]): string[] {
  const owners = new Map<string, string[]>();
  for (const b of buildings) {
    for (const prefix of [...b.prefixes, ...(b.suggestPrefixes ?? [])]) {
      owners.set(prefix, [...(owners.get(prefix) ?? []), b.slug]);
    }
  }
  return [...owners].filter(([, slugs]) => slugs.length > 1).map(([prefix, slugs]) => `${prefix}: ${slugs.join(', ')}`);
}
