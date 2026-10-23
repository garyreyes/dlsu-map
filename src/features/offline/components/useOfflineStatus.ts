import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';
import { hasSavedCopy, nextPhase, offlineView, type OfflineView, type SaveEvent, type SavePhase } from '../status';

/** How long "✓ Ready offline" stays after the first save (user-flows O2). */
const READY_NOTE_MS = 3000;
/** The worker vite-plugin-pwa generates, at the scope its helper registers it with. */
const SW_URL = `${import.meta.env.BASE_URL}sw.js`;
/** Read once, when the app first loads: O1 is only for an app opened with no signal. */
const STARTED_OFFLINE = !navigator.onLine;

/** The save phase in a small store, so the service worker's callbacks can report from outside React. */
const usePhase = create<{ phase: SavePhase; report: (event: SaveEvent) => void }>((set) => ({
  phase: 'serviceWorker' in navigator ? 'checking' : 'unsupported',
  report: (event) => {
    set((s) => ({ phase: nextPhase(s.phase, event) }));
  },
}));
const report = (event: SaveEvent) => {
  usePhase.getState().report(event);
};

/**
 * Follows a registration to a finished copy or a failure. An active worker means the copy is complete, because
 * Workbox precaches before a worker can activate. A first download that fails (a dropped connection, a full disk)
 * leaves the worker redundant; a newer worker replacing it does too, so that only counts when nothing replaced it.
 */
function track(registration: ServiceWorkerRegistration | undefined) {
  if (!registration) {
    report('failed');
    return;
  }
  if (registration.active) {
    report('registered-saved');
    return;
  }
  report('registered-saving');
  const worker = registration.installing ?? registration.waiting;
  worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' || worker.state === 'activated') report('installed');
    const others = [registration.installing, registration.waiting, registration.active];
    const replaced = others.some((other) => other !== null && other !== worker);
    if (worker.state === 'redundant' && !replaced) report('failed');
  });
}

/** A browser that won't register at all (Firefox's private mode) rejects with SecurityError: no try can work. Any
 *  other rejection (sw.js didn't download) is one failed try. */
const reportRejection = (error: unknown) => {
  report(error instanceof DOMException && error.name === 'SecurityError' ? 'refused' : 'failed');
};

/** Whether a newer version has downloaded and is waiting (O4), in a store so the worker's callback can set it. */
const useWaiting = create<{ waiting: boolean }>(() => ({ waiting: false }));
/** The page's registration, kept for the reload below. Set when registering. */
let registration: ServiceWorkerRegistration | undefined;

/** The quiet check for a newer version runs at most this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;
let lastCheck = Date.now();

/** When the student comes back to the app, looks for a newer version, at most once an hour. Offline or failed
 *  checks are ignored: the next visit tries again. */
function checkOnReturn(registration: ServiceWorkerRegistration) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (Date.now() - lastCheck < UPDATE_CHECK_MS) return;
    lastCheck = Date.now();
    registration.update().catch(() => undefined);
  });
}

let started = false;

/**
 * Registers the service worker once per page (StrictMode runs effects twice). vite-plugin-pwa's helper waits for
 * the page's load event, so the precache download never competes with the first paint.
 */
function startSaving() {
  if (started || usePhase.getState().phase === 'unsupported') return;
  started = true;
  registerSW({
    onOfflineReady: () => {
      report('installed');
    },
    onNeedRefresh: () => {
      useWaiting.setState({ waiting: true });
    },
    onRegisteredSW: (_url, registered) => {
      registration = registered;
      track(registered);
      if (registered) checkOnReturn(registered);
    },
    onRegisterError: reportRejection,
  });
}

/** Whether a newer version is waiting, and the reload that applies it (O4). */
export function useUpdate(): { waiting: boolean; reload: () => void } {
  const waiting = useWaiting((s) => s.waiting);
  return { waiting, reload: applyUpdate };
}

/**
 * Tells the waiting worker to take over and reloads once it has. The helper's own `updateSW(true)` reloads only for a
 * tab that had a controller when it registered (a first visit kept open has none), so the reload is done here. The
 * helper's own listener may reload too; two reloads in a row are harmless.
 */
function applyUpdate() {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload();
    },
    { once: true },
  );
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

/** Whether a finished copy is on this phone (the ⓘ sheet's "Works offline" line). */
export function useSavedOffline(): boolean {
  return hasSavedCopy(usePhase((s) => s.phase));
}

/** Tries the first save again, as "Saving paused" promises. Registering again restarts a failed install. */
function retrySaving() {
  navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL }).then(track, reportRejection);
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};
const isOnline = () => navigator.onLine;

/** Whether the phone says it has signal. Not proof of internet, but `false` is reliable. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline);
}

/**
 * What the offline line and screen should show (O1, O2 and their failures). When O1 has been showing and signal
 * comes back, the page reloads to finish loading and saving: nothing useful was on screen to lose. When a save
 * failed after the app opened, signal coming back tries it again in place.
 */
export function useOfflineStatus(): OfflineView {
  const phase = usePhase((s) => s.phase);
  const online = useOnline();
  const [readyNoteDone, setReadyNoteDone] = useState(false);
  const view = offlineView(phase, { online, startedOffline: STARTED_OFFLINE, readyNoteDone });
  const showedOpenOnce = useRef(false);

  useEffect(startSaving, []);

  useEffect(() => {
    if (phase !== 'saved-now') return;
    const timer = setTimeout(() => {
      setReadyNoteDone(true);
    }, READY_NOTE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (view === 'open-once-online') showedOpenOnce.current = true;
    else if (showedOpenOnce.current && online) {
      showedOpenOnce.current = false;
      window.location.reload();
    }
  }, [view, online]);

  // Only on signal coming back, never in a loop: a save that fails with signal (a full disk) waits for the next open.
  const wasOnline = useRef(online);
  useEffect(() => {
    const cameBack = online && !wasOnline.current;
    wasOnline.current = online;
    if (cameBack && usePhase.getState().phase === 'not-saved' && !STARTED_OFFLINE) retrySaving();
  }, [online]);

  return view;
}
