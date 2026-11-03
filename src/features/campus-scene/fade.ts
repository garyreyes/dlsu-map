// Which campus buildings draw faded (D60, v2-A4). Pure; Masses.tsx draws them, fadeStore.ts holds the route's list.
// Tests: fade.test.ts.
import type { Route } from '@/shared/data/route';
import type { BuildingLook } from '@/shared/settings/map-settings';

/**
 * The campus buildings drawn faded. With `look` see-through, every one of `all`; with solid, those of `routeFaded`
 * that are in `all` (D60 points 1 and 2). Never one in `keep`: the goal, the selected and the entered building
 * (D60 point 3). Nulls and undefineds in `keep` are ignored, so callers can pass what they have.
 */
export function fadedSlugs(
  look: BuildingLook,
  routeFaded: ReadonlySet<string>,
  all: readonly string[],
  keep: readonly (string | null | undefined)[],
): ReadonlySet<string> {
  const kept = new Set(keep);
  const wanted = look === 'see-through' ? all : all.filter((s) => routeFaded.has(s));
  return new Set(wanted.filter((s) => !kept.has(s)));
}

/**
 * The building the route ends in: the last leg's building, or the door an outdoor last leg walks to. Undefined for no
 * route, or a walk to a gate (no building at its end).
 */
export function goalBuilding(route: Route | null): string | undefined {
  const last = route?.legs[route.legs.length - 1];
  if (!last) return undefined;
  if (last.kind !== 'walk') return last.building;
  return last.to.kind === 'door' ? last.to.building : undefined;
}
