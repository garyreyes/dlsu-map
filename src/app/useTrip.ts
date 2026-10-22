import { useCallback, useState } from 'react';
import type { CampusBuilding } from '@/shared/data/campus';
import type { From } from '@/shared/data/route';
import { useBackToClose } from './useBackToClose';

/**
 * From, Where are you (S4), the route preview (S5, 5b), the step player (S6, 5d) with its all-steps list (S8), and
 * Arrived (S9), over the card. Each is a history entry on the one before, so the phone's Back walks back one screen.
 * From lives here in memory only: never in a link, Recent or storage, and gone when the app closes (PRD §6, D23).
 */
export function useTrip() {
  const where = useBackToClose();
  const preview = useBackToClose();
  const player = useBackToClose();
  const allSteps = useBackToClose();
  const arrived = useBackToClose();
  const [from, setFrom] = useState<From | null>(null);
  // A building tapped on the map while S4 is open: a new object each time, so tapping the same one again counts.
  const [mapPick, setMapPick] = useState<{ slug: string } | null>(null);
  const { open: openWhere, closeThen: closeWhereThen, isOpen: whereOpen } = where;
  const { open: openPreview, closeThen: closePreviewThen, isOpen: previewOpen } = preview;
  const { open: openPlayer, closeThen: closePlayerThen, isOpen: playerOpen } = player;
  const { open: openArrived, closeThen: closeArrivedThen } = arrived;
  const { closeThen: closeAllStepsThen } = allSteps;

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
  /** Start: the player, or straight to Arrived when the route has no steps (From is already on the room's floor). */
  const start = useCallback(
    (steps: number) => {
      if (steps === 0) openArrived();
      else openPlayer();
    },
    [openArrived, openPlayer],
  );
  /** ⋯ Change where I am: S4, which leads back to the preview to confirm, never straight into a new route. */
  const changeFromPlayer = useCallback(() => {
    closePlayerThen(changeFrom);
  }, [closePlayerThen, changeFrom]);
  /** Find next room and Done: every screen of the trip closes, top first, then `then` runs. From stays. */
  const endTrip = useCallback(
    (then: () => void) => {
      closeArrivedThen(() => {
        closeAllStepsThen(() => {
          closePlayerThen(() => {
            closePreviewThen(then);
          });
        });
      });
    },
    [closeArrivedThen, closeAllStepsThen, closePlayerThen, closePreviewThen],
  );
  /** A map tap while S4, the preview or the player are open: true when it's handled here, so the card stays as it is. */
  const mapTap = useCallback(
    (building: CampusBuilding | null) => {
      if (previewOpen || playerOpen) return true;
      if (!whereOpen) return false;
      if (building?.tier === 'full') setMapPick({ slug: building.slug });
      return true;
    },
    [previewOpen, playerOpen, whereOpen],
  );

  return {
    from,
    where,
    preview,
    player,
    allSteps,
    arrived,
    mapPick,
    roomOpened,
    directions,
    chooseFrom,
    changeFrom,
    changeFromPlayer,
    start,
    endTrip,
    setFrom,
    mapTap,
  };
}
