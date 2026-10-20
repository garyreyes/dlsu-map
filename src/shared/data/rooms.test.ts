// The schema is the gate between the compiler (3b) and search and the room card (3c, 3d). A room with a wrong code or
// floor sends a student to the wrong place without any error, so each kind of broken entry must be rejected.
import { describe, expect, it } from 'vitest';
import { roomsSchema } from './rooms';
import sample from './rooms.sample.json';

type Room = Record<string, unknown>;
type Mutate = (r: { rooms: Room[] }) => void;
const [first] = sample.rooms;
if (!first) throw new Error('the sample needs at least one room');

/** A deep copy of the sample with one change applied. */
function broken(mutate: Mutate): unknown {
  const copy = structuredClone(sample) as { rooms: Room[] };
  mutate(copy);
  return copy;
}

describe('roomsSchema', () => {
  it('accepts the sample', () => {
    expect(roomsSchema.safeParse(sample).success).toBe(true);
  });

  it('keeps a mezzanine label (D26) and leaves it off rooms on an ordinary floor', () => {
    const { rooms } = roomsSchema.parse(sample);
    expect(rooms.find((r) => r.code === 'VL151')).toStrictEqual({
      code: 'VL151',
      building: 'velasco',
      floor: 1,
      floorLabel: 'G Mezz',
      name: "Dean's Office",
    });
    expect(rooms.find((r) => r.code === 'ST404')).not.toHaveProperty('floorLabel');
  });

  it.each<[string, Mutate]>([
    ['the same code twice', (r) => r.rooms.push({ ...first })],
    ['a lowercase code', (r) => (r.rooms[0] = { ...first, code: 'st102' })],
    ['a code with a dash', (r) => (r.rooms[0] = { ...first, code: 'ST-102' })],
    ['a combined entry', (r) => (r.rooms[0] = { ...first, code: 'ST404/406' })],
    ['a room number starting with 0', (r) => (r.rooms[0] = { ...first, code: 'ST012' })],
    ['floor 0', (r) => (r.rooms[0] = { ...first, floor: 0 })],
    ['a fractional floor', (r) => (r.rooms[0] = { ...first, floor: 1.5 })],
    ['an empty name', (r) => (r.rooms[0] = { ...first, name: '' })],
    ['an empty floor label', (r) => (r.rooms[0] = { ...first, floorLabel: '' })],
    ['a building that is not a slug', (r) => (r.rooms[0] = { ...first, building: 'STRC' })],
    ['a field search does not know', (r) => (r.rooms[0] = { ...first, extra: true })],
    ['no rooms', (r) => (r.rooms = [])],
  ])('rejects %s', (_label, mutate) => {
    expect(roomsSchema.safeParse(broken(mutate)).success).toBe(false);
  });
});
