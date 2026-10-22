import { useCallback, useState } from 'react';
import type { CampusBuilding } from '@/shared/data/campus';
import type { From } from '@/shared/data/route';
import { useBackToClose } from './useBackToClose';

/**
 * From, Where are you (S4) and the route over the card (5a). From lives here in memory only: never in a link, Recent
 * or storage, and gone when the app closes (PRD §6, D23). Until 5b, setting From opens the all-steps list in place of
 * the route preview (D42).
 */
export function useTrip() {
  const where = useBackToClose();
  const steps = useBackToClose();
  const [from, setFrom] = useState<From | null>(null);
  // A building tapped on the map while S4 is open: a new object each time, so tapping the same one again counts.
  const [mapPick, setMapPick] = useState<{ slug: string } | null>(null);
  const { open: openWhere, closeThen: closeWhereThen, isOpen: whereOpen } = where;
  const { open: openSteps, closeThen: closeStepsThen, isOpen: stepsOpen } = steps;

  /** A room card just opened: with From empty, S4 comes up under it at once (D23). Never for a building (D42). */
  const roomOpened = useCallback(() => {
    if (from === null) openWhere();
  }, [from, openWhere]);
  const directions = useCallback(() => {
    if (from === null) openWhere();
    else openSteps();
  }, [from, openWhere, openSteps]);
  // S4's entry goes first, so Back from the route lands on the card rather than on a closed S4.
  const chooseFrom = useCallback(
    (next: From) => {
      setFrom(next);
      closeWhereThen(openSteps);
    },
    [closeWhereThen, openSteps],
  );
  const changeFrom = useCallback(() => {
    closeStepsThen(openWhere);
  }, [closeStepsThen, openWhere]);
  /** A map tap while S4 or the route is open: true when it's handled here, so the card stays as it is. */
  const mapTap = useCallback(
    (building: CampusBuilding | null) => {
      if (stepsOpen) return true;
      if (!whereOpen) return false;
      if (building?.tier === 'full') setMapPick({ slug: building.slug });
      return true;
    },
    [stepsOpen, whereOpen],
  );

  return { from, where, steps, mapPick, roomOpened, directions, chooseFrom, changeFrom, mapTap };
}
