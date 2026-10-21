// Recent (3c, user-flows §3.2, D38): the last 5 destinations tapped in search, rooms and buildings, newest first.
// Saved on this phone only. Only To ever goes in: From is never a destination, so it can never be stored (PRD §6).
// Pure: the localStorage read and write live in components/useRecent.ts. Tests: recent.test.ts.
import { z } from '@/shared/data/zod';
import type { Hit, SearchIndex } from './search-index';

export type RecentEntry =
  { readonly kind: 'room'; readonly code: string } | { readonly kind: 'building'; readonly slug: string };

export const RECENT_MAX = 5;

const entrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('room'), code: z.string().min(1) }),
  z.strictObject({ kind: z.literal('building'), slug: z.string().min(1) }),
]);

const key = (e: RecentEntry) => (e.kind === 'room' ? `room:${e.code}` : `building:${e.slug}`);

/** The entry first, any earlier copy of it removed, 5 at most. Returns a new list. */
export function addRecent(list: readonly RecentEntry[], entry: RecentEntry): RecentEntry[] {
  return [entry, ...list.filter((e) => key(e) !== key(entry))].slice(0, RECENT_MAX);
}

/** What was saved, as entries: anything unreadable is dropped, never thrown. */
export function parseRecent(saved: string | null): RecentEntry[] {
  if (saved === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    return [];
  }
  const list = z.array(z.unknown()).safeParse(data);
  if (!list.success) return [];
  const entries = list.data.flatMap((item) => {
    const parsed = entrySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  return entries.reduceRight<RecentEntry[]>((kept, e) => addRecent(kept, e), []);
}

/** Entries as rows. A room or building no longer in the data (or no longer searchable) is left out. */
export function resolveRecent(list: readonly RecentEntry[], index: SearchIndex): Hit[] {
  return list.flatMap((e): Hit[] => {
    if (e.kind === 'room') {
      const room = index.byCode.get(e.code);
      return room ? [room] : [];
    }
    const building = index.bySlug.get(e.slug);
    return building ? [{ kind: 'building', building }] : [];
  });
}

/** The entry a tapped row saves: always the canonical code, so "also written C311" never comes back. */
export function recentEntry(hit: Hit): RecentEntry {
  return hit.kind === 'room' ? { kind: 'room', code: hit.code } : { kind: 'building', slug: hit.building.slug };
}
