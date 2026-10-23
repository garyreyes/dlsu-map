import { useCallback, useMemo, useRef } from 'react';
import type { Vector3 } from 'three';
import type { Route, XY } from '@/shared/data/route';
import { climbPath, easeOut, GLIDE_MS, levelPath, pointAlong, type XYH } from '../glide';
import type { MapFocus } from './useTripMarks';

/** The level the dot is on: the ground, which takes in every building's G (floor 1), or one building's upper floor with
 *  a spot on it. Null where the dot never glides (no player, a floor without a spot). */
type Level = { readonly key: string; readonly building?: string; readonly floor?: number } | null;

function levelOf(focus: MapFocus | null): Level {
  if (focus?.kind === 'ground') return { key: 'ground' };
  if (focus?.kind !== 'floor' || focus.at === undefined) return null;
  const key = focus.floor === 1 ? 'ground' : `${focus.building}:${String(focus.floor)}`;
  return { key, building: focus.building, floor: focus.floor };
}

/** The route's lines on a level: on the ground the outdoor walks and every G's indoor legs, else that floor's. */
function linesOn(route: Route | null, level: NonNullable<Level>): (readonly XY[])[] {
  return (route?.legs ?? []).flatMap((l) => {
    if (level.key === 'ground') return l.kind === 'walk' || (l.kind === 'indoor' && l.floor === 1) ? [l.path] : [];
    return l.kind === 'indoor' && l.building === level.building && l.floor === level.floor ? [l.path] : [];
  });
}

/** The way from one drawn point to the next step's (D52): along one level's line, or up or down a floor of the same
 *  building at the stairs. Null where the dot jumps: into another building's upper floor, or off the player. */
function pathBetween(route: Route | null, from: XYH, to: XYH, was: Level, now: Level): XYH[] | null {
  if (!was || !now) return null;
  if (was.key === now.key) return levelPath(from, to, linesOn(route, now));
  if (was.building === undefined || was.building !== now.building) return null;
  return climbPath(from, to, linesOn(route, was), linesOn(route, now));
}

/** A scene point back to campus meters: x east, y north (the scene's z points south), h up (the scene's y). */
const toXYH = (v: Vector3): XYH => [v.x, -v.z, v.y];

interface Glide {
  /** The dot's target the glide was set for; a new object means a new step. */
  target: Vector3 | null;
  level: Level;
  /** The way being walked, or null when the dot is at rest. */
  path: XYH[] | null;
  /** When the first frame drew it, ms; null until then. */
  startedAt: number | null;
  /** Where the dot was last drawn, so a restart begins there. */
  drawn: XYH | null;
}

/**
 * The "you are here" dot's glide between steps (D52). `place` is called every frame with the dot's target and writes
 * where to draw it into `out`; it returns true while the dot is still moving, so the caller asks for another frame.
 * Between buildings, off the player, or with reduced motion, it jumps.
 */
export function useDotGlide(route: Route | null, focus: MapFocus | null, reduced: boolean) {
  const state = useRef<Glide>({ target: null, level: null, path: null, startedAt: null, drawn: null });
  const level = useMemo(() => levelOf(focus), [focus]);

  return useCallback(
    (here: Vector3 | null, out: Vector3, now: number): boolean => {
      const s = state.current;
      if (here !== s.target) {
        const target = here ? toXYH(here) : null;
        const path = !reduced && s.drawn && target ? pathBetween(route, s.drawn, target, s.level, level) : null;
        // A dot that stays put has nowhere to glide, so it asks for no frames.
        s.path = path && path.length > 1 ? path : null;
        s.startedAt = null;
        s.target = here;
        s.level = level;
        if (!s.path) s.drawn = target;
      }
      if (!here) return false;
      if (!s.path) {
        out.copy(here);
        return false;
      }
      s.startedAt ??= now;
      const p = Math.min(1, (now - s.startedAt) / GLIDE_MS);
      if (p >= 1) {
        s.path = null;
        s.drawn = toXYH(here);
        out.copy(here);
        return false;
      }
      const [x, y, h] = pointAlong(s.path, easeOut(p));
      s.drawn = [x, y, h];
      out.set(x, h, -y);
      return true;
    },
    [route, level, reduced],
  );
}
