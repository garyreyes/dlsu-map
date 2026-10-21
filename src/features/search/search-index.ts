// The search index (3c): rooms.json and campus.json's buildings, joined and arranged for lookups, built once per data
// load. Pure: no React, no fetch. searchResults (search-results.ts) reads it. Tests: search-results.test.ts.
import type { CampusBuilding } from '@/shared/data/campus';
import { toPrefixTable } from '@/shared/data/prefix-table';
import type { PrefixTable } from '@/shared/data/room-code';
import type { Room } from '@/shared/data/rooms';

type BuildingInput = Pick<
  CampusBuilding,
  'slug' | 'name' | 'short' | 'aliases' | 'tier' | 'prefixes' | 'suggestPrefixes' | 'floorLabels'
>;

/** A building search can offer: full tier only (D20). */
export interface SearchBuilding {
  readonly slug: string;
  readonly name: string;
  readonly short: string;
  /** The canonical prefix, shown as the row's code tag: `ST`. */
  readonly prefix: string;
  /** False until the building's room list is typed in (9a–9d): its codes get "rooms aren't in the app yet" (D38). */
  readonly hasRooms: boolean;
}

export interface RoomHit {
  readonly kind: 'room';
  readonly code: string;
  readonly name: string;
  readonly floor: number;
  /** As the building's signs write it: `G`, `3F`, `G Mezz`. */
  readonly floorLabel: string;
  readonly building: SearchBuilding;
  /** Set only when typed with an alias prefix, for "also written C311". */
  readonly typedAs?: string;
}

export interface BuildingHit {
  readonly kind: 'building';
  readonly building: SearchBuilding;
}

/** One row in the list: a room or a building. */
export type Hit = RoomHit | BuildingHit;

/** A building's names, for matching what was typed: lower-case words, dots dropped (`st joseph`). */
export interface NamedBuilding {
  readonly slug: string;
  readonly name: string;
  /** Null for a block-tier building: it is found only to say it isn't searchable yet. */
  readonly building: SearchBuilding | null;
  readonly words: readonly (readonly string[])[];
  /** Accepted prefixes, upper case: typing `AG` alone finds Andrew Hall. */
  readonly prefixes: readonly string[];
}

export interface SearchIndex {
  readonly table: PrefixTable;
  /** Searchable buildings, in campus.json's order. */
  readonly buildings: readonly SearchBuilding[];
  readonly bySlug: ReadonlyMap<string, SearchBuilding>;
  /** Every room in a searchable building, as a row, sorted by code. */
  readonly rooms: readonly RoomHit[];
  readonly byCode: ReadonlyMap<string, RoomHit>;
  /** Every building in campus.json's order, block tier too, for matching names. */
  readonly named: readonly NamedBuilding[];
}

/** `St. Joseph Hall` → `['st', 'joseph', 'hall']`; `Science & Technology` → `['science', 'and', 'technology']`. */
export function words(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '');
}

const floorLabel = (room: Room, labels: BuildingInput['floorLabels']) =>
  room.floorLabel ?? labels?.[String(room.floor)] ?? `${String(room.floor)}F`;

export function buildSearchIndex(rooms: readonly Room[], buildings: readonly BuildingInput[]): SearchIndex {
  const withRooms = new Set(rooms.map((r) => r.building));
  const searchable = buildings.flatMap((b): SearchBuilding[] => {
    const [prefix] = b.prefixes;
    if (b.tier !== 'full' || prefix === undefined) return [];
    return [{ slug: b.slug, name: b.name, short: b.short, prefix, hasRooms: withRooms.has(b.slug) }];
  });
  const bySlug = new Map(searchable.map((b) => [b.slug, b]));
  const sources = new Map(buildings.map((b) => [b.slug, b]));

  const hits = rooms.flatMap((r): RoomHit[] => {
    const building = bySlug.get(r.building);
    if (!building) return [];
    const labels = sources.get(r.building)?.floorLabels;
    return [{ kind: 'room', code: r.code, name: r.name, floor: r.floor, floorLabel: floorLabel(r, labels), building }];
  });
  hits.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  const named = buildings.map((b) => ({
    slug: b.slug,
    name: b.name,
    building: bySlug.get(b.slug) ?? null,
    words: [b.short, b.name, ...b.aliases].map(words),
    prefixes: b.prefixes,
  }));

  return {
    table: toPrefixTable(buildings.filter((b) => bySlug.has(b.slug))),
    buildings: searchable,
    bySlug,
    rooms: hits,
    byCode: new Map(hits.map((h) => [h.code, h])),
    named,
  };
}
