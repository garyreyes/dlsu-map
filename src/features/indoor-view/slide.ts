// The cut's slide (7b, D45), as pure functions: which way the plane moves for a step change, what stays drawn while it
// does, and how high it is at each moment. The hook that plays it is components/useCutSlide.ts. No React, no DOM.
import { CUT_ABOVE_FLOOR, type Cutaway, type CutawayView } from './cutaway';
import { SLIDE_MS, type CutMove, type CutSlide } from './transition';

/** What a change of step does to the cut (see `CutMove`). */
export function cutMove(prev: Cutaway | null, next: Cutaway | null): CutMove {
  if (!prev && !next) return 'none';
  if (!prev) return 'enter';
  if (!next) return 'exit';
  if (prev.building !== next.building) return 'swap';
  return prev.floor === next.floor ? 'none' : 'floor';
}

/** Where a view's cut sits: its floor's slab plus CUT_ABOVE_FLOOR, meters. */
const cutOf = (v: CutawayView) => v.cutaway.base + CUT_ABOVE_FLOOR;

/** The slide from the cut before to the cut after, or null when nothing moves. `at`, when the plane was mid-slide,
 *  is where this one starts instead. */
export function slideOf(prev: CutawayView | null, next: CutawayView | null, at?: number): CutSlide | null {
  const move = cutMove(prev?.cutaway ?? null, next?.cutaway ?? null);
  if (move === 'none') return null;
  const start = (planned: number) => at ?? planned;
  if (move === 'exit') return prev && { move, shown: prev, from: start(cutOf(prev)), to: prev.roof };
  if (!next) return null;
  if (move === 'floor') {
    if (!prev) return null;
    // Going up, the lower floor stays the one drawn, so the floors the plane passes are still there to be cut.
    const shown = next.cutaway.floor > prev.cutaway.floor ? prev : next;
    return { move, shown, from: start(cutOf(prev)), to: cutOf(next) };
  }
  // Enter, and a swap (the old building has already rejoined the campus): from the new building's roof.
  return { move, shown: next, from: start(next.roof), to: cutOf(next) };
}

/** Cubic ease-out of progress 0..1: exactly 0 at the start and exactly 1 at the end. Over SLIDE_MS (600 ms) it is
 *  half done at about 124 ms and about 88% done at 300 ms, so the slide reads as the whole 600 ms (the exponential
 *  one it replaced was 97% done at 300 ms and looked like 80 ms). */
const easeOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) ** 3);

/** The plane's height `elapsedMs` into a slide: exactly `from` at 0 and exactly `to` from SLIDE_MS on. */
export function slideHeight(slide: CutSlide, elapsedMs: number): number {
  const p = easeOut(elapsedMs / SLIDE_MS);
  if (p <= 0) return slide.from;
  if (p >= 1) return slide.to;
  return slide.from + (slide.to - slide.from) * p;
}

/** What the hook holds between renders: the cut it was last told, what it draws now, and the slide in play. */
export interface CutState {
  readonly target: CutawayView | null;
  readonly shown: CutawayView | null;
  readonly slide: CutSlide | null;
}

export const IDLE_CUT: CutState = { target: null, shown: null, slide: null };

/** Where the plane rests when no slide plays: the target's cut, or 0 when nothing is cut. */
export const restHeight = (target: CutawayView | null): number => (target ? cutOf(target) : 0);

/** What a floor slide draws when it interrupts another: the lower of the two shown floors, so the floors the plane
 *  is still passing stay drawn instead of turning into stump. */
function lowest(slide: CutSlide, shown: CutawayView | null, at: number | undefined): CutawayView {
  const keep =
    slide.move === 'floor' &&
    at !== undefined &&
    shown?.cutaway.building === slide.shown.cutaway.building &&
    shown.cutaway.floor < slide.shown.cutaway.floor;
  return keep ? shown : slide.shown;
}

/** The state after the target changes. `height` is where the plane is now; a slide in play starts there when it stays
 *  in the same building, and otherwise the new one starts from its own roof. Under `reduced` the end state is at once. */
export function retarget(state: CutState, target: CutawayView | null, reduced: boolean, height: number): CutState {
  if (reduced) return { target, shown: target, slide: null };
  const playing = state.slide;
  const building = (target ?? state.target)?.cutaway.building;
  const at = playing && playing.shown.cutaway.building === building ? height : undefined;
  const planned = slideOf(state.target, target, at);
  const slide = planned && { ...planned, shown: lowest(planned, state.shown, at) };
  if (slide) return { target, shown: slide.shown, slide };
  // The cut is unchanged: a slide in play carries on towards the newer view; otherwise show it now.
  return playing ? { ...state, target } : { target, shown: target, slide: null };
}

/** The state when the slide has played out: what's drawn is the target. */
export const settled = (state: CutState): CutState => ({ target: state.target, shown: state.target, slide: null });
