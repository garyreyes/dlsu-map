import { useEffect, useMemo, useState } from 'react';
import { createRouter } from '@/features/routing';
import type { Campus } from '@/shared/data/campus';
import { loadCampus, loadIndoor, loadRooms, type LoadFailure, type LoadResult } from '@/shared/data/load';
import type { FloorMode, From, IndoorFiles, RouteResult, Router, To } from '@/shared/data/route';
import type { Rooms } from '@/shared/data/rooms';
import { placeNames, type PlaceNames } from '../steps-list';
import { hereOf, tripBuildings, type Here } from '../trip-places';

export type RouteState =
  | { status: 'loading' }
  | { status: 'failed'; reason: LoadFailure }
  | {
      status: 'ready';
      result: RouteResult;
      names: PlaceNames;
      /** Where the student is, for the map. The same object for every mode of one trip, so a new one means a new
       *  trip. Null when From's room or gate isn't in the data. */
      here: Here | null;
    };

const LOADING: RouteState = { status: 'loading' };

/** What a trip loads once, whatever the mode. */
interface Loaded {
  router: Router;
  files: IndoorFiles;
  names: PlaceNames;
  here: Here | null;
}

// The router is built once for the shared campus and rooms, not again for every trip (campus.json and rooms.json are
// loaded once, so their objects stay the same).
let built: { campus: Campus; rooms: Rooms; router: Router } | undefined;
function routerFor(campus: Campus, rooms: Rooms): Router {
  if (built?.campus !== campus || built.rooms !== rooms) built = { campus, rooms, router: createRouter(campus, rooms) };
  return built.router;
}

/** campus.json and rooms.json (shared loads, so usually already there), then the trip's building files (D41). A
 *  building file that doesn't load is left out: the route stops at that door and says so (O5). */
async function loadTrip(from: From, to: To): Promise<LoadResult<Loaded>> {
  const [campus, rooms] = await Promise.all([loadCampus(), loadRooms()]);
  if (!campus.ok) return campus;
  if (!rooms.ok) return rooms;
  const slugs = tripBuildings(from, to, rooms.data);
  const results = await Promise.all(slugs.map((slug) => loadIndoor(slug)));
  const files = new Map(slugs.flatMap((slug, i) => (results[i]?.ok ? [[slug, results[i].data] as const] : [])));
  return {
    ok: true,
    data: {
      router: routerFor(campus.data, rooms.data),
      files,
      names: placeNames(campus.data),
      here: hereOf(from, rooms.data, campus.data),
    },
  };
}

/**
 * Routes From → To on `mode`, or null while there's no trip. The files load once per trip; a new mode routes again
 * from them at once (S5's Route options), with no new fetch. `from` and `to` must keep their identity between
 * renders, or it loads again.
 */
export function useRoute(from: From | null, to: To | null, mode: FloorMode): RouteState | null {
  // Each answer remembers the trip it was for, so a new From or To reads as loading until its own answer arrives.
  const [answer, setAnswer] = useState<{ from: From; to: To; result: LoadResult<Loaded> } | null>(null);
  useEffect(() => {
    if (from === null || to === null) return;
    let live = true;
    void loadTrip(from, to)
      .then((result) => {
        if (live) setAnswer({ from, to, result });
      })
      // A loader or router that throws would otherwise leave "Finding the route…" up for good.
      .catch(() => {
        if (live) setAnswer({ from, to, result: { ok: false, reason: 'invalid' } });
      });
    return () => {
      live = false;
    };
  }, [from, to]);

  const current = answer?.from === from && answer.to === to ? answer.result : null;
  return useMemo((): RouteState | null => {
    if (from === null || to === null) return null;
    if (current === null) return LOADING;
    if (!current.ok) return { status: 'failed', reason: current.reason };
    const { router, files, names, here } = current.data;
    try {
      return { status: 'ready', result: router(from, to, mode, files), names, here };
    } catch {
      return { status: 'failed', reason: 'invalid' };
    }
  }, [from, to, mode, current]);
}
