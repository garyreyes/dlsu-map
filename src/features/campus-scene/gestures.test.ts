// The angle maths behind twist, tilt and the compass. A sign or wraparound mistake here wouldn't crash anything: the
// map would just spin the wrong way or the compass would point wrong, so each case pins the exact value.
import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  createTapTracker,
  createTwoFingerTracker,
  headingDeg,
  lineAngle,
  showCompass,
  tiltDelta,
  type Point,
} from './gestures';
import { TAP_MAX_MOVE, TAP_MAX_MS } from '@/shared/config/camera';

const close = (actual: number, expected: number) => {
  expect(actual).toBeCloseTo(expected, 10);
};
const p = (x: number, y: number): Point => ({ x, y });

describe('angleDelta', () => {
  it.each([
    ['a small turn', 0.1, 0.3, 0.2],
    ['a turn back', 0.3, 0.1, -0.2],
    ['across +π to -π, the short way', Math.PI - 0.1, -Math.PI + 0.1, 0.2],
    ['across -π to +π, the short way', -Math.PI + 0.1, Math.PI - 0.1, -0.2],
    ['no turn', 1, 1, 0],
  ])('%s', (_label, from, to, expected) => {
    close(angleDelta(from, to), expected);
  });

  it('keeps every result within half a turn', () => {
    for (let from = -7; from <= 7; from += 0.7) {
      for (let to = -7; to <= 7; to += 0.9) {
        const d = angleDelta(from, to);
        expect(d).toBeGreaterThan(-Math.PI - 1e-12);
        expect(d).toBeLessThanOrEqual(Math.PI + 1e-12);
      }
    }
  });
});

describe('lineAngle', () => {
  it.each([
    ['pointing right', p(0, 0), p(1, 0), 0],
    ['pointing down the screen (y grows down)', p(0, 0), p(0, 1), Math.PI / 2],
    ['pointing left', p(0, 0), p(-1, 0), Math.PI],
  ])('%s', (_label, a, b, expected) => {
    close(lineAngle(a, b), expected);
  });
});

describe('tiltDelta', () => {
  const H = 800;

  it('tilts toward the horizon when both fingers move up together', () => {
    // Up is -y on screen: 80 px up on an 800 px screen with TILT_PER_SCREEN = π/2 is +π/20.
    close(tiltDelta([p(100, 400), p(200, 400)], [p(100, 320), p(200, 320)], H), Math.PI / 20);
  });

  it('tilts back toward straight down when both fingers move down together', () => {
    close(tiltDelta([p(100, 400), p(200, 400)], [p(100, 480), p(200, 480)], H), -Math.PI / 20);
  });

  it('uses the average of the two fingers', () => {
    close(tiltDelta([p(100, 400), p(200, 400)], [p(100, 360), p(200, 280)], H), Math.PI / 20);
  });

  it.each([
    ['a pinch (fingers apart vertically)', [p(100, 400), p(200, 400)], [p(100, 360), p(200, 440)]],
    ['one finger still', [p(100, 400), p(200, 400)], [p(100, 400), p(200, 320)]],
    ['a sideways two-finger slide', [p(100, 400), p(200, 400)], [p(180, 398), p(280, 398)]],
    ['no movement', [p(100, 400), p(200, 400)], [p(100, 400), p(200, 400)]],
  ] as const)('does not tilt on %s', (_label, prev, next) => {
    expect(tiltDelta([prev[0], prev[1]], [next[0], next[1]], H)).toBe(0);
  });

  it('does not tilt on a zero-height screen', () => {
    expect(tiltDelta([p(0, 10), p(5, 10)], [p(0, 0), p(5, 0)], 0)).toBe(0);
  });
});

describe('headingDeg', () => {
  const home = Math.PI / 2;

  it.each([
    ['at home', home, 0],
    ['turned 30° one way', home + Math.PI / 6, 30],
    ['turned 30° the other way', home - Math.PI / 6, -30],
    ['turned 350°, which reads as -10°', home + (350 * Math.PI) / 180, -10],
    ['a full extra turn', home + 2 * Math.PI, 0],
    ['exactly half a turn', home + Math.PI, -180],
  ])('%s', (_label, azimuth, expected) => {
    close(headingDeg(azimuth, home), expected);
  });
});

describe('showCompass', () => {
  it.each([
    [0, false],
    [4, false],
    [-4, false],
    [4.01, true],
    [-4.01, true],
    [-180, true],
  ])('%s° → %s', (deg, expected) => {
    expect(showCompass(deg)).toBe(expected);
  });
});

// Pointer events arrive one finger at a time, so the tracker is fed the way a phone feeds it.
describe('createTwoFingerTracker', () => {
  const H = 800;

  it('tilts when two fingers move up together, even though each event moves one finger', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(100, 400));
    t.down(2, p(200, 400));
    const first = t.move(1, p(100, 320), H); // only finger 1 has moved so far: no tilt yet
    const second = t.move(2, p(200, 320), H); // now both have: 80 px up → π/20
    expect(first.tilt).toBe(0);
    close(second.tilt, Math.PI / 20);
  });

  it('turns with the fingers on every event', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(0, 0));
    t.down(2, p(100, 0));
    close(t.move(2, p(100, 100), H).twist, Math.PI / 4);
  });

  it('does not tilt on a pinch fed one finger at a time', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(100, 400));
    t.down(2, p(200, 400));
    t.move(1, p(100, 360), H);
    expect(t.move(2, p(200, 440), H).tilt).toBe(0);
  });

  it('does nothing with one finger, or with a third', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(0, 0));
    expect(t.move(1, p(0, -50), H)).toStrictEqual({ twist: 0, tilt: 0 });
    t.down(2, p(100, 0));
    t.down(3, p(50, 50));
    expect(t.move(2, p(100, -50), H)).toStrictEqual({ twist: 0, tilt: 0 });
  });

  it('starts fresh after a finger lifts and comes back', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(100, 400));
    t.down(2, p(200, 400));
    t.move(1, p(100, 300), H); // finger 1 moved, finger 2 not yet
    t.up(2);
    t.down(2, p(200, 300));
    t.move(1, p(100, 300), H);
    expect(t.move(2, p(200, 300), H).tilt).toBe(0); // no stale movement carried over
  });

  it('ignores moves from a finger it never saw go down', () => {
    const t = createTwoFingerTracker();
    t.down(1, p(0, 0));
    t.down(2, p(100, 0));
    expect(t.move(9, p(5, 5), H)).toStrictEqual({ twist: 0, tilt: 0 });
  });
});

// A tap selects a building; anything else is the map being moved. If a pan's end counted as a tap, every drag would
// open a card; if a real tap didn't count, buildings couldn't be picked. Each case pins which one it is.
describe('createTapTracker', () => {
  it('counts a press that barely moves and lifts quickly as a tap, at the lift point', () => {
    const t = createTapTracker();
    t.down(1, p(100, 200), 0);
    expect(t.up(1, p(103, 204), 120)).toStrictEqual(p(103, 204));
  });

  it(`still counts a move of exactly TAP_MAX_MOVE px held for TAP_MAX_MS`, () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 1000);
    expect(t.up(1, p(TAP_MAX_MOVE, 0), 1000 + TAP_MAX_MS)).toStrictEqual(p(TAP_MAX_MOVE, 0));
  });

  it('treats a press that moved further as a pan', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    expect(t.up(1, p(TAP_MAX_MOVE + 1, 0), 100)).toBeNull();
  });

  it('treats a drag that wanders off and comes back as a pan, not a tap', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    t.move(1, p(40, 0));
    t.move(1, p(2, 0));
    expect(t.up(1, p(0, 0), 200)).toBeNull();
  });

  it('still counts a press that only trembles within TAP_MAX_MOVE', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    t.move(1, p(TAP_MAX_MOVE, 0));
    t.move(1, p(0, -TAP_MAX_MOVE));
    expect(t.up(1, p(1, 1), 200)).toStrictEqual(p(1, 1));
  });

  it('treats a press held too long as not a tap', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    expect(t.up(1, p(0, 0), TAP_MAX_MS + 1)).toBeNull();
  });

  it('never counts a pinch or twist as a tap, whichever finger lifts first', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    t.down(2, p(50, 0), 10);
    expect(t.up(2, p(50, 0), 60)).toBeNull();
    expect(t.up(1, p(0, 0), 80)).toBeNull();
  });

  it('starts fresh after a pinch: the next single press can be a tap', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    t.down(2, p(50, 0), 10);
    t.up(1, p(0, 0), 60);
    t.up(2, p(50, 0), 70);
    t.down(3, p(10, 10), 500);
    expect(t.up(3, p(10, 10), 550)).toStrictEqual(p(10, 10));
  });

  it('drops a press the browser cancelled', () => {
    const t = createTapTracker();
    t.down(1, p(0, 0), 0);
    t.cancel(1);
    expect(t.up(1, p(0, 0), 50)).toBeNull();
  });

  it('ignores a lift it never saw go down', () => {
    expect(createTapTracker().up(7, p(0, 0), 10)).toBeNull();
  });
});
