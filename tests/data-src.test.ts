// Checks the authored data in data-src/ before it reaches the compiler (scripts/compile-data.ts, ARCHITECTURE §3.4).
// A building pointing at the wrong or a missing OSM element would silently draw the wrong footprint.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildingSourcesSchema } from '../src/shared/data/buildings.ts';

const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const buildings = buildingSourcesSchema.parse(read('data-src/campus/buildings.json'));
// Pinned on purpose: committing a new snapshot means bumping this line, so a refresh is always a deliberate change.
const snapshot = read('data-src/campus/osm/snapshot-2026-10-20.geojson') as {
  features: { id: string; geometry: { type: string }; properties: { tags: Record<string, string> } }[];
};
const features = new Map(snapshot.features.map((f) => [f.id, f]));

describe('data-src/campus/buildings.json', () => {
  it('lists the 10 full-tier buildings of v1 (D15, D20) and the 6 block-tier ones', () => {
    const slugs = (tier: string) => buildings.filter((b) => b.tier === tier).map((b) => b.slug);
    expect(slugs('full').sort()).toStrictEqual(
      ['andrew', 'gokongwei', 'velasco', 'miguel', 'yuchengco', 'sj', 'ls', 'razon', 'mutien', 'strc'].sort(),
    );
    expect(slugs('block').sort()).toStrictEqual(
      ['connon', 'henry-sy', 'william', 'faculty-center', 'st-john', 'bloemen'].sort(),
    );
  });

  it('points every building at an outline in the snapshot that OSM tags as a building', () => {
    for (const b of buildings) {
      for (const id of b.osm) {
        const f = features.get(id);
        expect(f, `${b.slug} → ${id}`).toBeDefined();
        expect(['Polygon', 'MultiPolygon'], `${b.slug} → ${id}`).toContain(f?.geometry.type);
        expect(f?.properties.tags.building, `${b.slug} → ${id}`).toBeDefined();
      }
    }
  });

  it('uses each room prefix once across all buildings, suggest prefixes included (D25)', () => {
    const all = buildings.flatMap((b) => [...b.prefixes, ...(b.suggestPrefixes ?? [])]);
    expect(all.length).toBe(new Set(all).size);
  });

  it('rejects a full-tier building without a prefix', () => {
    const [first] = buildings;
    expect(buildingSourcesSchema.safeParse([{ ...first, tier: 'full', prefixes: [] }]).success).toBe(false);
  });
});
