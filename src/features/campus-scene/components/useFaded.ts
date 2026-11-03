import { useMemo } from 'react';
import type { Campus } from '@/shared/data/campus';
import type { Route } from '@/shared/data/route';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { fadedSlugs, goalBuilding } from '../fade';
import { useFade } from './fadeStore';

interface Kept {
  /** The selected building. */
  selected: string | null;
  /** The building the player is inside (cut open, or loading its floor). */
  entered: string | undefined;
  route: Route | null;
}

/**
 * Which campus buildings draw faded (D60), and whether the bridges do. With the see-through setting every building
 * fades; with solid, only those the route's list names (fadeStore.ts). The selected, entered and goal buildings never
 * fade.
 */
export function useFaded(campus: Campus, { selected, entered, route }: Kept) {
  const look = useMapSettings((s) => s.settings.buildings);
  const routeFaded = useFade((s) => s.faded);
  const slugs = useMemo(() => campus.buildings.map((b) => b.slug), [campus]);
  const goal = useMemo(() => goalBuilding(route), [route]);
  const faded = useMemo(
    () => fadedSlugs(look, routeFaded, slugs, [selected, entered, goal]),
    [look, routeFaded, slugs, selected, entered, goal],
  );
  return { faded, bridgesFaded: look === 'see-through' };
}
