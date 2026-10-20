// The schema is the gate between the compiler (2b) and the scene (2c): if it accepted a broken file, the scene would
// draw garbage or crash on a phone. These cases prove it accepts the sample and rejects each kind of breakage.
import { describe, expect, it } from 'vitest';
import { campusSchema } from './campus';
import sample from './campus.sample.json';

// Buildings are loosely typed: the JSON import's inferred type can't hold the optional fields or broken values.
type Mutate = (
  c: Record<string, unknown> & Omit<typeof sample, 'buildings'> & { buildings: Record<string, unknown>[] },
) => void;

const [strc] = sample.buildings;
if (!strc) throw new Error('the sample needs at least one building');

/** A deep copy of the sample with one change applied. */
function broken(mutate: Mutate): unknown {
  const copy = structuredClone(sample);
  mutate(copy);
  return copy;
}

describe('campusSchema', () => {
  it('accepts the sample', () => {
    expect(campusSchema.safeParse(sample).success).toBe(true);
  });

  it('keeps aliases, suggest prefixes and floor labels for search and the room card', () => {
    const parsed = campusSchema.parse(broken((c) => (c.buildings[0] = { ...strc, suggestPrefixes: ['STR'] })));
    expect(parsed.buildings[0]).toMatchObject({
      aliases: ['STRC', 'Science and Technology Research Center'],
      suggestPrefixes: ['STR'],
      floorLabels: { '1': 'G' },
    });
  });

  it.each<[string, Mutate]>([
    ['an odd number of coordinates', (c) => c.campus[0]?.push(1)],
    ['a ring with only 2 points', (c) => (c.campus = [[0, 0, 1, 1]])],
    ['a line with only 1 point', (c) => (c.paths[0] = { kind: 'street', name: 'X', line: [0, 0] })],
    ['a non-number coordinate', (c) => (c.city = [{ outline: [0, 0, 1, 0, 'x' as unknown as number, 1], top: 3 }])],
    ['a volume whose top is below its base', (c) => (c.bridges = [{ outline: [0, 0, 1, 0, 1, 1], base: 6, top: 3 }])],
    ['a full-tier building with no prefix', (c) => (c.buildings[0] = { ...strc, prefixes: [] })],
    ['an unknown tier', (c) => (c.buildings[0] = { ...strc, tier: 'campus' })],
    ['a building with no volumes', (c) => (c.buildings[0] = { ...strc, volumes: [] })],
    ['a lowercase prefix', (c) => (c.buildings[0] = { ...strc, prefixes: ['st'] })],
    ['a building with no aliases list', (c) => (c.buildings[0] = { ...strc, aliases: undefined })],
    ['an empty alias', (c) => (c.buildings[0] = { ...strc, aliases: [''] })],
    ['a lowercase suggest prefix', (c) => (c.buildings[0] = { ...strc, suggestPrefixes: ['vh'] })],
    ['a floor label keyed by a non-number', (c) => (c.buildings[0] = { ...strc, floorLabels: { G: 'G' } })],
    ['an empty floor label', (c) => (c.buildings[0] = { ...strc, floorLabels: { '1': '' } })],
    ['an unknown path kind', (c) => (c.paths[0] = { kind: 'river', line: [0, 0, 1, 1] })],
    ['a field the scene does not know', (c) => (c.extra = true)],
    ['the attribution changed', (c) => (c.attribution = 'OSM')],
    ['a snapshot that is not a date', (c) => (c.snapshot = 'October')],
    ['no buildings', (c) => (c.buildings = [])],
  ])('rejects %s', (_label, mutate) => {
    expect(campusSchema.safeParse(broken(mutate)).success).toBe(false);
  });
});
