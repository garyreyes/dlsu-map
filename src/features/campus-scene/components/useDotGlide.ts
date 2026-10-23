import { useCallback, useMemo, useRef } from 'react';
import type { Vector3 } from 'three';
import type { Route, XY } from '@/shared/data/route';
import { easeOut, glidePath, GLIDE_MS, pointAlong } from '../glide';
import type { MapFocus } from './useTripMarks';

/** The level the dot is on: the ground, or one building's floor with a spot on it. Null where the dot never glides
 *  (no player, a floor without a spot). */
type Level = { readonly key: string; readonly building?: string; readonly floor?: number } | null;

function levelOf(focus: MapFocus | null): Level {
  if (focus?.kind === 'ground') return { key: 'ground' };
  if (focus?.kind === 'floor' && focus.at !== undefined) {
    return { key: `${focus.building}:${String(focus.floor)}`, building: focus.building, floor: focus.floor };
  }
  return null;
}

/** The route's lines on a level: the outdoor walks, or that floor's indoor legs. */
function linesOn(route: Route | null, level: NonNullable<Level>): (readonly XY[])[] {
  return (route?.legs ?? []).flatMap((l) => {
    if (level.building === undefined) return l.kind === 'walk' ? [l.path] : [];
    return l.kind === 'indoor' && l.building === level.building && l.floor === level.floor ? [l.path] : [];
  });
}

/** A scene point back to campus meters: x east, y north (the scene's z points south). */
const toXY = (v: Vector3): XY => [v.x, -v.z];

interface Glide {
  /** The dot's target the glide was set for; a new object means a new step. */
  target: Vector3 | null;
  level: Level;
  /** The way being walked, or null when the dot is at rest. */
  path: XY[] | null;
  /** When the first frame drew it, ms; null until then. */
  startedAt: number | null;
  /** Where the dot was last drawn, so a restart begins there. */
  drawn: XY | null;
}

/**
 * The "you are here" dot's glide between steps on the same level (D52). `place` is called every frame with the dot's
 * target and writes where to draw it into `out`; it returns true while the dot is still moving, so the caller asks for
 * another frame. Anything else than the same level (or reduced motion) jumps.
 */
export function useDotGlide(route: Route | null, focus: MapFocus | null, reduced: boolean) {
  const state = useRef<Glide>({ target: null, level: null, path: null, startedAt: null, drawn: null });
  const level = useMemo(() => levelOf(focus), [focus]);

  return useCallback(
    (here: Vector3 | null, out: Vector3, now: number): boolean => {
      const s = state.current;
      if (here !== s.target) {
        const target = here ? toXY(here) : null;
        const from = s.drawn;
        const glides = !reduced && from && target && level && s.level && level.key === s.level.key;
        const path = glides ? glidePath(from, target, linesOn(route, level)) : null;
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
        s.drawn = toXY(here);
        out.copy(here);
        return false;
      }
      const at = pointAlong(s.path, easeOut(p));
      s.drawn = at;
      out.set(at[0], here.y, -at[1]);
      return true;
    },
    [route, level, reduced],
  );
}
