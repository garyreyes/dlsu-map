import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';
import { nextPhase, offlineView, type OfflineView, type SaveEvent, type SavePhase } from '../status';

/** How long "✓ Ready offline" stays after the first save (user-flows O2). */
const READY_NOTE_MS = 3000;

/** The save phase in a small store, so the service worker's callbacks can report from outside React. */
const usePhase = create<{ phase: SavePhase; report: (event: SaveEvent) => void }>((set) => ({
  phase: 'serviceWorker' in navigator ? 'checking' : 'unsupported',
  report: (event) => {
    set((s) => ({ phase: nextPhase(s.phase, event) }));
  },
}));

let started = false;

/**
 * Registers the service worker once per page (StrictMode runs effects twice). vite-plugin-pwa's helper waits for
 * the page's load event, so the precache download never competes with the first paint. Its `onOfflineReady` fires
 * only for a first save, so a copy from an earlier visit is read off the registration instead: an active worker
 * means the copy is complete, because Workbox finishes precaching before a worker can activate.
 */
function startSaving() {
  if (started || usePhase.getState().phase === 'unsupported') return;
  started = true;
  const { report } = usePhase.getState();
  registerSW({
    onOfflineReady: () => {
      report('installed');
    },
    onRegisteredSW: (_url, registration) => {
      if (!registration) {
        report('failed');
        return;
      }
      if (registration.active) {
        report('registered-saved');
        return;
      }
      report('registered-saving');
      // A first download that fails (a dropped connection, a full disk) leaves the worker redundant. A newer worker
      // replacing it does too, so that only counts as a failure when no other worker took its place.
      const worker = registration.installing ?? registration.waiting;
      worker?.addEventListener('statechange', () => {
        const replaced = Boolean(registration.installing ?? registration.waiting ?? registration.active);
        if (worker.state === 'redundant' && !replaced) report('failed');
      });
    },
    onRegisterError: () => {
      report('failed');
    },
  });
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

/**
 * What the offline line and screen should show (O1, O2). When O1 has been showing and signal comes back, the page
 * reloads to finish loading and saving: nothing useful was on screen to lose.
 */
export function useOfflineStatus(): OfflineView {
  const phase = usePhase((s) => s.phase);
  const online = useSyncExternalStore(subscribeOnline, isOnline);
  const [readyNoteDone, setReadyNoteDone] = useState(false);
  const view = offlineView(phase, online, readyNoteDone);
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

  return view;
}
