// The all-steps list (S8), which is also the text-only mode (S11): a route's steps grouped by place, each with its
// icon and two lines. Pure: no React, no fetch.
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import type { From, Route, Step, To, Turn } from '@/shared/data/route';

/** Which icon a step gets. Turns use their own names; floors steps say which way they go. */
export type StepIconKey =
  'start' | Turn | 'cross' | 'enter' | 'arrive' | 'stairs-up' | 'stairs-down' | 'elevator-up' | 'elevator-down';

export interface StepRow {
  /** The step's index in `Route.steps`, so a tap can make it the current step. */
  readonly index: number;
  readonly icon: StepIconKey;
  /** The step's text, without "(approximate)" when the subtitle says it. */
  readonly title: string;
  /** "45 m", "45 m · approximate", "approximate". Left out when there's nothing to say. */
  readonly subtitle?: string;
}

export interface StepGroup {
  /** "In Andrew", "Outside · 63 m". */
  readonly label: string;
  readonly rows: readonly StepRow[];
}

/** How the list names buildings, floors and gates. Unknown ones fall back to their id. */
export interface PlaceNames {
  short(building: string): string;
  floor(building: string, floor: number): string;
  gate(id: string): string;
}

type NamedBuilding = Pick<CampusBuilding, 'slug' | 'short'> & Partial<Pick<CampusBuilding, 'floorLabels'>>;

export function placeNames(campus: {
  readonly buildings: readonly NamedBuilding[];
  readonly gates: readonly Pick<Campus['gates'][number], 'id' | 'name'>[];
}): PlaceNames {
  const buildings = new Map(campus.buildings.map((b) => [b.slug, b]));
  const gates = new Map(campus.gates.map((g) => [g.id, g.name]));
  return {
    short: (slug) => buildings.get(slug)?.short ?? slug,
    floor: (slug, floor) => buildings.get(slug)?.floorLabels?.[String(floor)] ?? `${String(floor)}F`,
    gate: (id) => gates.get(id) ?? id,
  };
}

const APPROXIMATE = ' (approximate)';

/** The steps under their places. Consecutive steps in the same place share one group. */
export function stepGroups(route: Route, names: Pick<PlaceNames, 'short'>): StepGroup[] {
  const groups: { key: string; meters: number; rows: StepRow[] }[] = [];
  route.steps.forEach((step, index) => {
    const leg = route.legs[step.leg];
    const key = leg?.kind === 'floors' || leg?.kind === 'indoor' ? leg.building : 'outside';
    const meters = leg?.kind === 'walk' ? leg.meters : 0;
    const last = groups.at(-1);
    const group = last?.key === key ? last : { key, meters: 0, rows: [] };
    if (group !== last) groups.push(group);
    // A walk leg adds its meters once, at its first step.
    if (route.steps[index - 1]?.leg !== step.leg) group.meters += meters;
    group.rows.push(rowOf(step, index, route));
  });
  return groups.map(({ key, meters, rows }) => ({
    label: key === 'outside' ? `Outside · ${String(meters)} m` : `In ${names.short(key)}`,
    rows,
  }));
}

function rowOf(step: Step, index: number, route: Route): StepRow {
  const approximate = 'approximate' in step && step.approximate === true;
  const title = approximate && step.text.endsWith(APPROXIMATE) ? step.text.slice(0, -APPROXIMATE.length) : step.text;
  const parts = [
    ...('meters' in step && step.meters !== undefined && step.meters > 0 ? [`${String(step.meters)} m`] : []),
    ...(approximate ? ['approximate'] : []),
  ];
  const row = { index, icon: iconOf(step, route), title };
  return parts.length === 0 ? row : { ...row, subtitle: parts.join(' · ') };
}

function iconOf(step: Step, route: Route): StepIconKey {
  switch (step.kind) {
    case 'turn':
      return step.turn;
    case 'floors': {
      const leg = route.legs[step.leg];
      const down = leg?.kind === 'floors' && leg.to < leg.from;
      return `${step.by}-${down ? 'down' : 'up'}`;
    }
    default:
      return step.kind;
  }
}

/** "About 5 min · 63 m walk". Rounded to the nearest minute, never under 1. */
export function totalsLine(route: Pick<Route, 'meters' | 'seconds'>): string {
  const minutes = Math.max(1, Math.round(route.seconds / 60));
  const time = `About ${String(minutes)} min`;
  return route.meters > 0 ? `${time} · ${String(route.meters)} m walk` : time;
}

/** "AG1104 → ST311", "Gate 2 (North) → STRC", "Andrew 5F → ST311". */
export function tripLine(from: From, to: To, names: PlaceNames): string {
  return `${fromName(from, names)} → ${toName(to, names)}`;
}

/** How From reads: "AG1104", "Gate 2 (North)", "Andrew 5F". */
export function fromName(from: From, names: PlaceNames): string {
  switch (from.kind) {
    case 'gate':
      return names.gate(from.gate);
    case 'building':
      return `${names.short(from.building)} ${names.floor(from.building, from.floor)}`;
    case 'room':
      return from.code;
  }
}

/** How To reads: "ST311", "STRC". */
export const toName = (to: To, names: Pick<PlaceNames, 'short'>): string =>
  to.kind === 'room' ? to.code : names.short(to.building);

/** What the list says when the route has no steps: From is already on the room's floor, or in the building. */
export function emptyRouteLine(to: To, names: Pick<PlaceNames, 'short'>): string {
  return to.kind === 'room' ? `${to.code} is on this floor.` : `You’re already in ${names.short(to.building)}.`;
}
