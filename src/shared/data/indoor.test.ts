// The schema is the gate between the compiler (6b) and the floor builder (6c): if it accepted a broken file, the
// indoor view would draw garbage or crash on a phone. These cases prove it accepts the sample and rejects each kind
// of breakage.
import { describe, expect, it } from 'vitest';
import { indoorSchema } from './indoor';
import sample from './indoor.sample.json';

type Loose = Record<string, unknown>;
type Mutable = Omit<typeof sample, 'floors'> & { floors: Loose[] };

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
