// Quality tiers (10c, PLAN.md §5): a slow phone draws fewer pixels, and on the lowest tier drops the see-through city
// around the campus. No React, no DOM. Tests: quality.test.ts.
//
// Frames only run on demand, so the gap before a frame after the map sat still is idle time, not a slow frame. Only
// frames drawn back to back (a pan, a flight, a slide) count.

export type QualityTier = 'high' | 'mid' | 'low';

/** The most device pixels per CSS pixel each tier draws; the phone's own ratio caps it. */
export const TIER_DPR: Readonly<Record<QualityTier, number>> = { high: 2, mid: 1.5, low: 1 };

/** The city around the campus draws on every tier but the lowest. */
export const showsCity = (tier: QualityTier): boolean => tier !== 'low';

/** What the monitor carries from frame to frame. Start from `startQuality()`. */
export interface QualityState {
  readonly tier: QualityTier;
  /** Recent back-to-back frame times in ms, oldest first. */
  readonly frames: readonly number[];
  /** Times the tier has changed; it stops changing after `MAX_CHANGES` so it can't flicker between two. */
  readonly changes: number;
}

/** A frame longer than this is an idle gap or a tab switch, not a slow frame: it empties the window, so frames from
 *  separate taps never add up. */
export const IDLE_MS = 100;

/** How many recent back-to-back frames are judged together; nothing is judged until the window is full. */
export const WINDOW_FRAMES = 30;

/** An average frame time above this (about 45 fps) steps the tier down. */
export const SLOW_MS = 1000 / 45;

/** An average frame time below this (about 58 fps) steps the tier up. The gap to `SLOW_MS` stops it flipping. */
export const FAST_MS = 1000 / 58;

/** The most tier changes in a session; after that the tier stays put. */
export const MAX_CHANGES = 4;

const TIERS: readonly QualityTier[] = ['low', 'mid', 'high'];

/** The state to start a session with: the best tier, nothing measured. */
export const startQuality = (): QualityState => ({ tier: 'high', frames: [], changes: 0 });

/** The tier one step `by` (-1 down, +1 up) from `tier`, or `tier` itself at the end of the range. */
function stepped(tier: QualityTier, by: -1 | 1): QualityTier {
  const next = TIERS[TIERS.indexOf(tier) + by];
  return next ?? tier;
}

/**
 * Takes in one drawn frame's time (ms) and returns the new state; the input is never changed. Idle gaps and bad
 * numbers are ignored, except that an idle gap empties the window. On a full window the average decides: slower than `SLOW_MS` steps
 * down, faster than `FAST_MS` steps up, and either clears the window. After `MAX_CHANGES` nothing changes any more.
 */
export function nextQuality(state: QualityState, frameMs: number): QualityState {
  if (state.changes >= MAX_CHANGES) return state;
  if (!Number.isFinite(frameMs) || frameMs <= 0) return state;
  if (frameMs > IDLE_MS) return state.frames.length === 0 ? state : { ...state, frames: [] };
  const frames = [...state.frames, frameMs].slice(-WINDOW_FRAMES);
  if (frames.length < WINDOW_FRAMES) return { ...state, frames };
  const average = frames.reduce((sum, ms) => sum + ms, 0) / frames.length;
  const tier = average > SLOW_MS ? stepped(state.tier, -1) : average < FAST_MS ? stepped(state.tier, 1) : state.tier;
  if (tier === state.tier) return { ...state, frames };
  return { tier, frames: [], changes: state.changes + 1 };
}
