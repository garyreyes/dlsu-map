import { useEffect, useState } from 'react';
import { createRouter } from '@/features/routing';
import { loadCampus, loadRooms, type LoadFailure } from '@/shared/data/load';
import type { From, RouteResult, To } from '@/shared/data/route';
import { placeNames, type PlaceNames } from '../steps-list';

export type RouteState =
  | { status: 'loading' }
  | { status: 'failed'; reason: LoadFailure }
  | { status: 'ready'; result: RouteResult; names: PlaceNames };

const LOADING: RouteState = { status: 'loading' };

/** Loads campus.json and rooms.json (shared loads, so usually already there), then routes From → To once, on Auto. */
export function useRoute(from: From, to: To): RouteState {
  // Each answer remembers the trip it was for, so a new From or To reads as loading until its own answer arrives.
  const [answer, setAnswer] = useState<{ from: From; to: To; state: RouteState } | null>(null);
  useEffect(() => {
    let live = true;
    const setState = (state: RouteState) => {
      setAnswer({ from, to, state });
    };
    void Promise.all([loadCampus(), loadRooms()])
      .then(([campus, rooms]) => {
        if (!live) return;
        if (!campus.ok || !rooms.ok) {
          setState({ status: 'failed', reason: campus.ok ? (rooms.ok ? 'invalid' : rooms.reason) : campus.reason });
          return;
        }
        const result = createRouter(campus.data, rooms.data)(from, to, 'auto');
        setState({ status: 'ready', result, names: placeNames(campus.data) });
      })
      // A router that throws would otherwise leave "Loading the route…" up for good.
      .catch(() => {
        if (live) setState({ status: 'failed', reason: 'invalid' });
      });
    return () => {
      live = false;
    };
  }, [from, to]);
  return answer?.from === from && answer.to === to ? answer.state : LOADING;
}
