import { useEffect, useState } from 'react';
import { createRouter } from '@/features/routing';
import { loadCampus, loadRooms, type LoadFailure } from '@/shared/data/load';
import type { RouteResult } from '@/shared/data/route';
import type { DevTrip } from '../dev-link';
import { placeNames, type PlaceNames } from '../steps-list';

export type DevRouteState =
  | { status: 'loading' }
  | { status: 'failed'; reason: LoadFailure }
  | { status: 'ready'; result: RouteResult; names: PlaceNames };

/** Dev only (5c): loads campus.json and rooms.json, then routes the link's trip once, on Auto. */
export function useDevRoute(trip: DevTrip): DevRouteState {
  const [state, setState] = useState<DevRouteState>({ status: 'loading' });
  const { from, to } = trip;
  useEffect(() => {
    let live = true;
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
  return state;
}
