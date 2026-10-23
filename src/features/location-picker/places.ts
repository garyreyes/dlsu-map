// What Where are you (S4) offers to pick (user-flows §3.5): the full buildings with their floors, and the gates. Built
// once from campus.json. Pure: no React, no fetch. Tests: places.test.ts.
import type { Campus, CampusBuilding } from '@/shared/data/campus';

/** One floor chip: the floor number routing uses (G = 1) and the label on the building's signs. */
export interface FloorChip {
  readonly floor: number;
  readonly label: string;
}

/** One of a building's doors, with its index in campus.json's `entrances`: that is how a spot names it (D48). */
export interface PickerDoor {
  readonly entrance: number;
  readonly kind: 'main' | 'side' | 'back';
  /** Where it faces, when the building has more than one of a kind. */
  readonly name?: string;
}

export interface PickerBuilding {
  readonly slug: string;
  readonly name: string;
  readonly short: string;
  /** The canonical prefix, shown as the row's code tag: `AG`. */
  readonly prefix: string;
  /** Bottom first. */
  readonly floors: readonly FloorChip[];
  /** In campus.json's order. */
  readonly doors: readonly PickerDoor[];
}

export interface PickerGate {
  readonly id: string;
  /** The full name, which screen readers hear: `Gate 1 (South)`. */
  readonly name: string;
  /** What the chip shows: `Gate 1`, `Agno`. */
  readonly chip: string;
}

export interface PickerPlaces {
  /** Full tier only (D20), in campus.json's order. */
  readonly buildings: readonly PickerBuilding[];
  readonly gates: readonly PickerGate[];
}

type FloorsInput = Pick<CampusBuilding, 'levels'> & Partial<Pick<CampusBuilding, 'floorLabels'>>;
type BuildingInput = Pick<CampusBuilding, 'slug' | 'name' | 'short' | 'tier' | 'prefixes'> & FloorsInput;

/** Every storey, with the label its signs use where we've seen one (`G`), and `2F` style everywhere else. */
export function floorChips(building: FloorsInput): FloorChip[] {
  return Array.from({ length: building.levels }, (_, i) => {
    const floor = i + 1;
    return { floor, label: building.floorLabels?.[String(floor)] ?? `${String(floor)}F` };
  });
}

/** `Gate 1 (South)` → `Gate 1`, `Agno Gate` → `Agno`: short enough for a chip, still what the gate is called. */
export function gateChip(name: string): string {
  return name.replace(/\s*\(.*\)$/, '').replace(/\s+Gate$/, '');
}

export function pickerPlaces(campus: {
  readonly buildings: readonly BuildingInput[];
  readonly gates: readonly Pick<Campus['gates'][number], 'id' | 'name'>[];
  readonly entrances: readonly Pick<Campus['entrances'][number], 'building' | 'kind' | 'name'>[];
}): PickerPlaces {
  const doorsOf = (slug: string): PickerDoor[] =>
    campus.entrances.flatMap((e, entrance) =>
      e.building === slug ? [{ entrance, kind: e.kind, ...(e.name === undefined ? {} : { name: e.name }) }] : [],
    );
  return {
    buildings: campus.buildings
      .filter((b) => b.tier === 'full')
      .map((b) => ({
        slug: b.slug,
        name: b.name,
        short: b.short,
        prefix: b.prefixes[0] ?? '',
        floors: floorChips(b),
        doors: doorsOf(b.slug),
      })),
    gates: campus.gates.map((g) => ({ id: g.id, name: g.name, chip: gateChip(g.name) })),
  };
}
