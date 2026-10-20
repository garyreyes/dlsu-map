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

/** What the service worker reported. `registered-*` say whether a finished copy existed when it registered.
 *  `failed`: this try didn't work (no signal, a full disk). `refused`: the browser won't let any try work (private
 *  modes reject registering outright). */
export type SaveEvent = 'registered-saving' | 'registered-saved' | 'installed' | 'failed' | 'refused';

/** What the screen shows: nothing, O1's full screen, or one of the lines under the search pill (O2 and its
 *  failures). */
export type OfflineView =
  'none' | 'open-once-online' | 'saving' | 'saving-paused' | 'ready-offline' | 'not-saved' | 'cannot-save';

/** The signal now, whether the app was opened with none, and whether "✓ Ready offline" has had its 3 s. */
export interface ViewInput {
  online: boolean;
  startedOffline: boolean;
  readyNoteDone: boolean;
}

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
    case 'refused':
      return 'unsupported';
  }
}

/**
 * What to show. O1 replaces the app only when it was opened with no signal and nothing could be downloaded, so it
 * can't finish loading. A worker that did download proves there was signal, so a wrong "no signal" reading at start
 * never blocks the app. Signal dropping after it opened keeps the app on screen and says saving is paused. A copy
 * that can't be made is always said out loud, so a student never walks into a dead zone thinking the app will work.
 */
export function offlineView(phase: SavePhase, { online, startedOffline, readyNoteDone }: ViewInput): OfflineView {
  switch (phase) {
    case 'unsupported':
      return 'cannot-save';
    case 'checking':
    case 'saved':
      return 'none';
    case 'saved-now':
      return readyNoteDone ? 'none' : 'ready-offline';
    case 'not-saved':
    case 'saving':
      if (!online) return startedOffline && phase === 'not-saved' ? 'open-once-online' : 'saving-paused';
      return phase === 'saving' ? 'saving' : 'not-saved';
  }
}
