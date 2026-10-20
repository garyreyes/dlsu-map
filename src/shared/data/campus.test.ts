// The schema is the gate between the compiler (2b) and the scene (2c): if it accepted a broken file, the scene would
// draw garbage or crash on a phone. These cases prove it accepts the sample and rejects each kind of breakage.
import { describe, expect, it } from 'vitest';
import { campusSchema } from './campus';
import sample from './campus.sample.json';

// Buildings, ways, links, gates and entrances are loosely typed: the JSON import's inferred type can't hold the
// optional fields or broken values.
type Loose = Record<string, unknown>;
type Mutable = Loose &
  Omit<typeof sample, 'buildings' | 'walk' | 'gates' | 'entrances'> & {
    buildings: Loose[];
    walk: { points: number[]; ways: Loose[]; links: number[][] };
    gates: Loose[];
    entrances: Loose[];
  };
type Mutate = (c: Mutable) => void;

/** The sample's first entrance, to break one field of. */
const entrance = (c: Mutable): Loose => ({ ...c.entrances[0] });

const [strc] = sample.buildings;
if (!strc) throw new Error('the sample needs at least one building');

/** A deep copy of the sample with one change applied. */
function broken(mutate: Mutate): unknown {
  const copy = structuredClone(sample) as unknown as Mutable;
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

  it('keeps the LRT as a rail path, so the scene can draw it apart from streets', () => {
    const rail = campusSchema.parse(sample).paths.filter((p) => p.kind === 'rail');
    expect(rail).toEqual([
      { kind: 'rail', name: 'LRT Line 1', line: [221.1, -259.3, 215.7, -240.3, 208.3, -221.9, 169.2, -136] },
    ]);
  });

  it('keeps the walk network, gates and entrances that routing (4b) and Where are you (5a) read', () => {
    const parsed = campusSchema.parse(sample);
    expect(parsed.walk).toStrictEqual({
      points: [-83.8, 192.4, -70, 186, -60, 210, -40, 230],
      ways: [
        { kind: 'door' },
        { kind: 'path', name: 'SJ Walk', covered: true },
        { kind: 'crossing', name: 'Taft Avenue' },
      ],
      links: [
        [0, 1, 0],
        [1, 2, 1],
        [2, 3, 2],
      ],
    });
    expect(parsed.gates).toStrictEqual([{ id: 'gate-2', name: 'Gate 2 (North)', point: 3 }]);
    expect(parsed.entrances).toStrictEqual([{ building: 'strc', kind: 'main', point: 0, verified: false }]);
  });

  it('accepts an empty network, so the compiler can emit one before 4a fills it', () => {
    const empty = broken((c) => {
      c.walk = { points: [], ways: [], links: [] };
      c.gates = [];
      c.entrances = [];
    });
    expect(campusSchema.safeParse(empty).success).toBe(true);
  });

  it.each(['path', 'steps', 'street', 'sidewalk', 'crossing', 'door'])('accepts a %s way', (kind) => {
    expect(campusSchema.safeParse(broken((c) => (c.walk.ways[1] = { kind }))).success).toBe(true);
  });

  it.each(['main', 'side', 'back'])('accepts a %s entrance', (kind) => {
    const entrance = { building: 'strc', kind, point: 0, verified: true };
    expect(campusSchema.safeParse(broken((c) => (c.entrances = [entrance]))).success).toBe(true);
  });

  it.each<[string, Mutate]>([
    ['a link to a point that does not exist', (c) => (c.walk.links[2] = [2, 4, 2])],
    ['a link from a point to itself', (c) => (c.walk.links[2] = [2, 2, 2])],
    ['a link to a way that does not exist', (c) => (c.walk.links[2] = [2, 3, 3])],
    ['a negative point index', (c) => (c.walk.links[2] = [-1, 3, 2])],
    ['a fractional point index', (c) => (c.walk.links[2] = [2.5, 3, 2])],
    ['a link with only two numbers', (c) => (c.walk.links[2] = [2, 3])],
    ['an odd number of walk coordinates', (c) => c.walk.points.push(1)],
    ['an unknown way kind', (c) => (c.walk.ways[1] = { kind: 'road' })],
    ['an empty way name', (c) => (c.walk.ways[1] = { kind: 'path', name: '' })],
    ['a gate at a point that does not exist', (c) => (c.gates = [{ id: 'gate-2', name: 'Gate 2', point: 4 }])],
    ['two gates with the same id', (c) => c.gates.push({ id: 'gate-2', name: 'Gate 2 again', point: 2 })],
    ['a gate id that is not a slug', (c) => (c.gates = [{ id: 'Gate 2', name: 'Gate 2', point: 3 }])],
    ['an entrance at a point that does not exist', (c) => (c.entrances = [{ ...entrance(c), point: 9 }])],
    ['an entrance to a building that does not exist', (c) => (c.entrances = [{ ...entrance(c), building: 'x' }])],
    ['an unknown entrance kind', (c) => (c.entrances = [{ ...entrance(c), kind: 'front' }])],
    ['an entrance without verified', (c) => (c.entrances = [{ ...entrance(c), verified: undefined }])],
  ])('rejects %s', (_label, mutate) => {
    const result = campusSchema.safeParse(broken(mutate));
    expect(result.success).toBe(false);
    // Rejected for the broken field, not because the whole network is unknown to the schema.
    expect(result.error?.issues.map((i) => i.path[0])).not.toContain(undefined);
    expect(result.error?.issues.every((i) => ['walk', 'gates', 'entrances'].includes(String(i.path[0])))).toBe(true);
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
