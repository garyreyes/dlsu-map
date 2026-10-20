// Offline status (user-flows §4, O1 and O2): how far saving the app onto this phone has got, and what that means
// on screen. Pure, so every state can be tested without a service worker; components/useOfflineStatus.ts feeds it.

/** How far saving the app for offline use has got on this phone. */
export type SavePhase =
  /** The browser can't run a service worker (some private modes), so nothing can be saved. */
  | 'unsupported'
  /** The registration hasn't answered yet. */
  | 'checking'
  /** No copy, and none being made: registering or the first download failed. The next open tries again. */
  | 'not-saved'
  /** The first copy is downloading. */
  | 'saving'
  /** The first copy finished during this visit. */
  | 'saved-now'
  /** A copy was already complete when the app opened. */
  | 'saved';

/** What the service worker reported. `registered-*` say whether a finished copy existed when it registered. */
export type SaveEvent = 'registered-saving' | 'registered-saved' | 'installed' | 'failed';

/** What the screen shows: nothing, O1's full screen, or O2's line under the search pill. */
export type OfflineView = 'none' | 'open-once-online' | 'saving' | 'ready-offline';

const hasCopy = (phase: SavePhase) => phase === 'saved' || phase === 'saved-now';

/** The phase after an event. Events can arrive in either order: the first install may finish before the
 *  registration call reports back, and an update installing over a saved copy is never a first save. */
export function nextPhase(phase: SavePhase, event: SaveEvent): SavePhase {
  if (phase === 'unsupported' || hasCopy(phase)) return phase;
  switch (event) {
    case 'registered-saved':
      return 'saved';
    case 'registered-saving':
      return 'saving';
    case 'installed':
      return 'saved-now';
    case 'failed':
      return 'not-saved';
  }
}

/**
 * What to show. `readyNoteDone`: the 3 s of "✓ Ready offline" are over. O1 appears only when there is no copy and
 * no signal, because then the app can't finish loading and a closed tab can't come back.
 */
export function offlineView(phase: SavePhase, online: boolean, readyNoteDone: boolean): OfflineView {
  switch (phase) {
    case 'unsupported':
    case 'checking':
    case 'saved':
      return 'none';
    case 'saved-now':
      return readyNoteDone ? 'none' : 'ready-offline';
    case 'not-saved':
      return online ? 'none' : 'open-once-online';
    case 'saving':
      return online ? 'saving' : 'open-once-online';
  }
}
