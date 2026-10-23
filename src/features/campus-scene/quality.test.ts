import { describe, expect, it } from 'vitest';
import {
  IDLE_MS,
  MAX_CHANGES,
  WINDOW_FRAMES,
  nextQuality,
  showsCity,
  startQuality,
  TIER_DPR,
  type QualityState,
  type QualityTier,
} from './quality';

/** Feed the same frame time `n` times. */
const feed = (state: QualityState, ms: number, n: number): QualityState =>
  Array.from({ length: n }).reduce<QualityState>((s) => nextQuality(s, ms), state);

const at = (tier: QualityTier, extra: Partial<QualityState> = {}): QualityState => ({
  ...startQuality(),
  tier,
  ...extra,
});

describe('tiers', () => {
  it('draws at most 2, 1.5 and 1 device pixels per CSS pixel', () => {
    expect(TIER_DPR).toEqual({ high: 2, mid: 1.5, low: 1 });
  });

  it('shows the city on every tier but low', () => {
    expect(showsCity('high')).toBe(true);
    expect(showsCity('mid')).toBe(true);
    expect(showsCity('low')).toBe(false);
  });
});

describe('startQuality', () => {
  it('starts on high with no frames and no changes', () => {
    expect(startQuality()).toEqual({ tier: 'high', frames: [], changes: 0 });
  });
});

describe('idle gaps', () => {
  it('clears the window on a frame above the idle threshold: only back-to-back frames are judged', () => {
    const s = at('high', { frames: [16, 30] });
    expect(nextQuality(s, IDLE_MS + 1)).toEqual(at('high', { frames: [] }));
    expect(nextQuality(s, 2000)).toEqual(at('high', { frames: [] }));
  });

  it('returns the same state for an idle gap when the window is already empty', () => {
    const s = startQuality();
    expect(nextQuality(s, 2000)).toBe(s);
  });

  it('counts a frame exactly at the idle threshold', () => {
    expect(nextQuality(startQuality(), IDLE_MS).frames).toEqual([IDLE_MS]);
  });

  it('ignores a zero, negative or non-finite frame time', () => {
    const s = at('high', { frames: [16] });
    expect(nextQuality(s, 0)).toBe(s);
    expect(nextQuality(s, -5)).toBe(s);
    expect(nextQuality(s, Number.NaN)).toBe(s);
  });

  it('does not step down after many idle gaps', () => {
    expect(feed(startQuality(), 800, 100)).toEqual(startQuality());
  });

  it('does not add up slow bursts split by idle gaps (taps in quick succession)', () => {
    let s = startQuality();
    for (let burst = 0; burst < 5; burst++) s = nextQuality(feed(s, 60, WINDOW_FRAMES - 1), 5000);
    expect(s).toEqual(startQuality());
  });
});

describe('the rolling window', () => {
  it('appends frames, oldest first, and does not mutate the input', () => {
    const s = at('high', { frames: [17, 18] });
    const next = nextQuality(s, 19);
    expect(next.frames).toEqual([17, 18, 19]);
    expect(s.frames).toEqual([17, 18]);
  });

  it('keeps only the latest WINDOW_FRAMES frames', () => {
    const s = feed(at('low'), 20, WINDOW_FRAMES + 5);
    expect(s.frames).toHaveLength(WINDOW_FRAMES);
  });

  it('does not judge before the window is full', () => {
    const s = feed(startQuality(), 40, WINDOW_FRAMES - 1);
    expect(s.tier).toBe('high');
    expect(s.changes).toBe(0);
  });
});

describe('stepping down', () => {
  it('drops high to mid on a full window averaging slower than 45 fps, and clears the window', () => {
    const s = feed(startQuality(), 30, WINDOW_FRAMES);
    expect(s).toEqual({ tier: 'mid', frames: [], changes: 1 });
  });

  it('drops mid to low', () => {
    const s = feed(at('mid'), 30, WINDOW_FRAMES);
    expect(s).toEqual({ tier: 'low', frames: [], changes: 1 });
  });

  it('judges the average: one slow frame among fast ones does not step down', () => {
    let s = feed(startQuality(), 20, WINDOW_FRAMES - 1);
    s = nextQuality(s, 80);
    expect(s.tier).toBe('high');
  });

  it('holds at exactly 45 fps (22.2 ms) and below', () => {
    expect(feed(startQuality(), 1000 / 45, WINDOW_FRAMES).tier).toBe('high');
  });

  it('never goes below low', () => {
    const s = feed(at('low'), 40, WINDOW_FRAMES * 2);
    expect(s.tier).toBe('low');
    expect(s.changes).toBe(0);
  });
});

describe('stepping up', () => {
  it('climbs low to mid on a full window averaging better than 58 fps', () => {
    const s = feed(at('low', { changes: 1 }), 16, WINDOW_FRAMES);
    expect(s).toEqual({ tier: 'mid', frames: [], changes: 2 });
  });

  it('climbs mid to high', () => {
    expect(feed(at('mid'), 16, WINDOW_FRAMES).tier).toBe('high');
  });

  it('never goes above high', () => {
    const s = feed(startQuality(), 10, WINDOW_FRAMES * 2);
    expect(s.tier).toBe('high');
    expect(s.changes).toBe(0);
  });
});

describe('hysteresis', () => {
  it.each([18, 20, 22])('stays put at %d ms (between 45 and 58 fps)', (ms) => {
    for (const tier of ['high', 'mid', 'low'] as const) {
      const s = feed(at(tier), ms, WINDOW_FRAMES * 3);
      expect(s.tier).toBe(tier);
      expect(s.changes).toBe(0);
    }
  });
});

describe('the change limit', () => {
  it('has a limit of 4', () => {
    expect(MAX_CHANGES).toBe(4);
  });

  it('stops changing tier after MAX_CHANGES, and returns the same state', () => {
    const s = at('high', { changes: MAX_CHANGES });
    expect(feed(s, 40, WINDOW_FRAMES * 2)).toBe(s);
  });

  it('makes the last allowed change, then stays put', () => {
    const last = feed(at('high', { changes: MAX_CHANGES - 1 }), 40, WINDOW_FRAMES);
    expect(last).toEqual({ tier: 'mid', frames: [], changes: MAX_CHANGES });
    expect(feed(last, 40, WINDOW_FRAMES * 2)).toBe(last);
  });
});
