import { useCallback, useState } from 'react';
import type { CampusBuilding } from '@/shared/data/campus';
import type { From } from '@/shared/data/route';
import { useBackToClose } from './useBackToClose';

/**
 * From, Where are you (S4), the route preview (S5, 5b) and its steps, over the card. From lives here in memory only:
 * never in a link, Recent or storage, and gone when the app closes (PRD §6, D23). Until the step player (5d), Start
 * opens the all-steps list (D43).
 */
export function useTrip() {
  const where = useBackToClose();
  const preview = useBackToClose();
  const steps = useBackToClose();
  const [from, setFrom] = useState<From | null>(null);
  // A building tapped on the map while S4 is open: a new object each time, so tapping the same one again counts.
  const [mapPick, setMapPick] = useState<{ slug: string } | null>(null);
  const { open: openWhere, closeThen: closeWhereThen, isOpen: whereOpen } = where;
  const { open: openPreview, closeThen: closePreviewThen, isOpen: previewOpen } = preview;
  const { open: openSteps, isOpen: stepsOpen } = steps;

  /** A room card just opened: S4 comes up under it at once with From empty (D23), else the route preview, so the next
   *  room is one tap from Start (user-flows §3.1). Never for a building (D42). */
  const roomOpened = useCallback(() => {
    if (from === null) openWhere();
    else openPreview();
  }, [from, openWhere, openPreview]);
  /** Directions on either card does the same: S4 with From empty, else the preview. */
  const directions = roomOpened;
  // S4's entry goes first, so Back from the preview lands on the card rather than on a closed S4.
  const chooseFrom = useCallback(
    (next: From) => {
      setFrom(next);
      closeWhereThen(openPreview);
    },
    [closeWhereThen, openPreview],
  );
  /** The preview's From chip: back to S4, which opens the preview again once From is set. */
  const changeFrom = useCallback(() => {
    closePreviewThen(openWhere);
  }, [closePreviewThen, openWhere]);
  /** A map tap while S4, the preview or the steps are open: true when it's handled here, so the card stays as it is. */
  const mapTap = useCallback(
    (building: CampusBuilding | null) => {
      if (previewOpen || stepsOpen) return true;
      if (!whereOpen) return false;
      if (building?.tier === 'full') setMapPick({ slug: building.slug });
      return true;
    },
    [previewOpen, stepsOpen, whereOpen],
  );

  return {
    from,
    where,
    preview,
    steps,
    mapPick,
    roomOpened,
    directions,
    chooseFrom,
    changeFrom,
    start: openSteps,
    mapTap,
  };
}
