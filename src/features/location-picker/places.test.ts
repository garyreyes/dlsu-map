import { describe, expect, it } from 'vitest';
import { floorChips, gateChip, pickerPlaces } from './places';

describe('floorChips', () => {
  it("uses the building's own labels, and 2F upward elsewhere", () => {
    expect(floorChips({ levels: 5, floorLabels: { '1': 'G' } })).toEqual([
      { floor: 1, label: 'G' },
      { floor: 2, label: '2F' },
      { floor: 3, label: '3F' },
      { floor: 4, label: '4F' },
      { floor: 5, label: '5F' },
    ]);
  });

  it('labels floor 1 as 1F when the signs have no G', () => {
    expect(floorChips({ levels: 2 })).toEqual([
      { floor: 1, label: '1F' },
      { floor: 2, label: '2F' },
    ]);
  });

  it("gives Andrew's 20 floors, bottom first", () => {
    const chips = floorChips({ levels: 20 });
    expect(chips).toHaveLength(20);
    expect(chips[0]).toEqual({ floor: 1, label: '1F' });
    expect(chips[19]).toEqual({ floor: 20, label: '20F' });
  });
});

describe('gateChip', () => {
  it.each([
    ['Gate 1 (South)', 'Gate 1'],
    ['Gate 4A (Gokongwei)', 'Gate 4A'],
    ['Agno Gate', 'Agno'],
    ['Gate 6', 'Gate 6'],
  ])('%s → %s', (name, chip) => {
    expect(gateChip(name)).toBe(chip);
  });
});

describe('pickerPlaces', () => {
  // A fixed slice of campus.json: two full buildings around a block one, and two gates.
  const block = (slug: string, short: string, tier: 'full' | 'block', prefixes: string[], levels: number) => ({
    slug,
    name: `${short} Hall`,
    short,
    tier,
    prefixes,
    levels,
  });
  const places = pickerPlaces({
    buildings: [
      { ...block('velasco', 'Velasco', 'full', ['VL', 'VE'], 5), floorLabels: { '1': 'G' } },
      block('connon', 'Connon', 'block', [], 4),
      block('andrew', 'Andrew', 'full', ['AG'], 20),
    ],
    gates: [
      { id: 'gate-1', name: 'Gate 1 (South)' },
      { id: 'agno', name: 'Agno Gate' },
    ],
  });

  it("lists only the full buildings, in campus.json's order, each with its canonical prefix", () => {
    expect(places.buildings.map((b) => [b.slug, b.name, b.short, b.prefix])).toEqual([
      ['velasco', 'Velasco Hall', 'Velasco', 'VL'],
      ['andrew', 'Andrew Hall', 'Andrew', 'AG'],
    ]);
  });

  it("gives each building its floors from levels and the signs' labels", () => {
    expect(places.buildings[0]?.floors.map((f) => f.label)).toEqual(['G', '2F', '3F', '4F', '5F']);
    expect(places.buildings[1]?.floors).toHaveLength(20);
  });

  it('gives each gate its chip label and keeps its full name', () => {
    expect(places.gates).toEqual([
      { id: 'gate-1', name: 'Gate 1 (South)', chip: 'Gate 1' },
      { id: 'agno', name: 'Agno Gate', chip: 'Agno' },
    ]);
  });
});
