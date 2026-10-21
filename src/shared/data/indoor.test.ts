// The schema is the gate between the compiler (6b) and the floor builder (6c): if it accepted a broken file, the
// indoor view would draw garbage or crash on a phone. These cases prove it accepts the sample and rejects each kind
// of breakage.
import { describe, expect, it } from 'vitest';
import { indoorSchema } from './indoor';
import sample from './indoor.sample.json';

type Loose = Record<string, unknown>;
type Mutable = Omit<typeof sample, 'floors' | 'graph' | 'rooms' | 'verticals' | 'entrances'> & {
  floors: Loose[];
  graph: { points: unknown[]; floors: unknown[]; links: unknown[][] };
  rooms: Loose[];
  verticals: { stops: Loose[] }[];
  entrances: Loose[];
};

/** A deep copy of the sample with one change applied. */
function broken(mutate: (b: Mutable) => void): unknown {
  const copy = structuredClone(sample) as unknown as Mutable;
  mutate(copy);
  return copy;
}

const floor = (b: Mutable): Loose => b.floors[0] ?? {};

describe('indoorSchema', () => {
  it('accepts the sample', () => {
    expect(indoorSchema.safeParse(sample).success).toBe(true);
  });

  it('keeps each floor in meters with its height, for raising walls', () => {
    const [first, third] = indoorSchema.parse(sample).floors;
    expect(first).toMatchObject({ floor: 1, base: 0, height: 3.4, checked: false });
    expect(first?.walls[0]).toStrictEqual([-144.4, 175.4, -87.5, 199.8]);
    expect(third).toMatchObject({ floor: 3, base: 6.8, checked: true });
  });

  it.each<[string, (b: Mutable) => void]>([
    ['no floors', (b) => (b.floors = [])],
    ['floors out of order', (b) => b.floors.reverse()],
    ['the same floor twice', (b) => b.floors.push({ ...floor(b) })],
    ['floor 0', (b) => (floor(b).floor = 0)],
    ['a fractional floor', (b) => (floor(b).floor = 1.5)],
    ['a negative base', (b) => (floor(b).base = -1)],
    ['a zero height', (b) => (floor(b).height = 0)],
    ['a wall with one point', (b) => (floor(b).walls = [[1, 2]])],
    ['a wall with an odd count', (b) => (floor(b).walls = [[1, 2, 3]])],
    ['a hallway with a string', (b) => (floor(b).hallways = [[1, 2, '3', 4]])],
    ['checked missing', (b) => delete floor(b).checked],
    ['an unknown field', (b) => (floor(b).rooms = [])],
    ['a bad slug', (b) => (b.building = 'STRC')],
  ])('rejects %s', (_, mutate) => {
    expect(indoorSchema.safeParse(broken(mutate)).success).toBe(false);
  });
});

describe('indoorSchema, the indoor graph (8a)', () => {
  it('lines the graph up with its rooms, stairs and entrance', () => {
    const b = indoorSchema.parse(sample);
    expect(b.graph.points.length / 2).toBe(b.graph.floors.length);
    expect(b.rooms.map((r) => [r.code, r.floor, r.doors])).toStrictEqual([
      ['ST102', 1, [3]],
      ['ST311', 3, [8]],
    ]);
    expect(b.verticals[0]?.stops).toStrictEqual([
      { floor: 1, point: 1 },
      { floor: 3, point: 6 },
    ]);
    expect(b.graph.links).toContainEqual([1, 6, 'stairs']);
    expect(b.entrances).toStrictEqual([{ entrance: 0, point: 9 }]);
  });

  it.each<[string, (b: Mutable) => void]>([
    ['no graph', (b) => delete (b as Partial<Mutable>).graph],
    ['a floor missing for a point', (b) => b.graph.floors.pop()],
    ['a link to a point that is not there', (b) => b.graph.links.push([0, 99, 'hall'])],
    ['a link from a point to itself', (b) => b.graph.links.push([2, 2, 'hall'])],
    ['the same link twice, either way round', (b) => b.graph.links.push([2, 0, 'hall'])],
    ['an unknown kind of link', (b) => b.graph.links.push([0, 1, 'escalator'])],
    ['a room whose door is not a point', (b) => ((b.rooms[0] ?? {}).doors = [99])],
    ['a room whose door is on another floor', (b) => ((b.rooms[0] ?? {}).doors = [8])],
    ['a room with no door', (b) => ((b.rooms[0] ?? {}).doors = [])],
    ['the same room twice', (b) => b.rooms.push({ ...b.rooms[0] })],
    ['a stop on another floor than its point', (b) => ((b.verticals[0]?.stops[1] ?? {}).floor = 2)],
    [
      'a stop on a floor the vertical does not serve',
      (b) => (b.verticals[0] ?? { stops: [] }).stops.push({ floor: 5, point: 0 }),
    ],
    ['an entrance whose point is not there', (b) => ((b.entrances[0] ?? {}).point = 99)],
    ['stairs that stay on one floor', (b) => b.graph.links.push([0, 3, 'stairs'])],
    ['a hall link between floors', (b) => b.graph.links.push([0, 5, 'hall'])],
    ['stops out of order', (b) => (b.verticals[0] ?? { stops: [] }).stops.reverse()],
    ['the same vertical twice', (b) => b.verticals.push({ ...b.verticals[0], stops: [] })],
    ['a room on a floor that is not in the file', (b) => ((b.rooms[0] ?? {}).floor = 2)],
    ['a point on a floor that is not in the file', (b) => (b.graph.floors[0] = 2)],
  ])('rejects %s', (_, mutate) => {
    expect(indoorSchema.safeParse(broken(mutate)).success).toBe(false);
  });
});
