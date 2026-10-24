// Which building labels show (DESIGN.md, Map labels): labels hide rather than overlap, the more important one wins,
// and none sits under the search pill or the sheet. Right or wrong here is exact: a label either shows or it doesn't.
import { describe, expect, it } from 'vitest';
import { LABEL_GAP, placeLabels, stackUp, type LabelBox } from './labels';

const view = { width: 400, height: 800 };
const box = (id: string, x: number, y: number, rank = 0, w = 80, h = 30): LabelBox => ({
  id,
  rank,
  left: x,
  top: y,
  width: w,
  height: h,
});

describe('placeLabels', () => {
  it('shows labels that do not touch', () => {
    expect(placeLabels([box('a', 10, 100), box('b', 200, 100)], [], view)).toStrictEqual(new Set(['a', 'b']));
  });

  it('hides the lower-ranked of two overlapping labels, whatever order they come in', () => {
    const minor = box('minor', 10, 100, 1);
    const major = box('major', 40, 110, 0);
    expect(placeLabels([minor, major], [], view)).toStrictEqual(new Set(['major']));
    expect(placeLabels([major, minor], [], view)).toStrictEqual(new Set(['major']));
  });

  it('keeps the first one given when two equal ranks overlap', () => {
    expect(placeLabels([box('a', 10, 100), box('b', 40, 110)], [], view)).toStrictEqual(new Set(['a']));
  });

  it('lets a hidden label free its space: a third label only blocked by the hidden one still shows', () => {
    // a beats b; b overlaps c; a doesn't overlap c. b is hidden, so c shows.
    const a = box('a', 0, 100, 0);
    const b = box('b', 60, 100, 1);
    const c = box('c', 130, 100, 2);
    expect(placeLabels([a, b, c], [], view)).toStrictEqual(new Set(['a', 'c']));
  });

  it('keeps labels a few pixels apart, so plates never kiss', () => {
    // 2 px gap between them: too close.
    expect(placeLabels([box('a', 10, 100), box('b', 92, 100)], [], view)).toStrictEqual(new Set(['a']));
    // 10 px gap: fine.
    expect(placeLabels([box('a', 10, 100), box('b', 100, 100)], [], view)).toStrictEqual(new Set(['a', 'b']));
  });

  it('hides a label under the chrome (the pill or the sheet)', () => {
    const pill = { left: 0, top: 0, width: 400, height: 72 };
    const sheet = { left: 0, top: 700, width: 400, height: 100 };
    const labels = [box('under-pill', 10, 50), box('free', 10, 300), box('under-sheet', 10, 690)];
    expect(placeLabels(labels, [pill, sheet], view)).toStrictEqual(new Set(['free']));
  });

  it('hides a label that runs off the screen', () => {
    const labels = [box('left', -20, 100), box('right', 350, 200), box('bottom', 10, 790), box('in', 100, 400)];
    expect(placeLabels(labels, [], view)).toStrictEqual(new Set(['in']));
  });

  it('shows nothing when given nothing', () => {
    expect(placeLabels([], [], view)).toStrictEqual(new Set());
  });
});

describe('stackUp', () => {
  it('leaves plates that do not touch where they are', () => {
    const boxes = [box('a', 10, 100), box('b', 200, 100)];
    expect(stackUp(boxes)).toStrictEqual(boxes);
  });

  it('slides a plate that overlaps an earlier one above it, and keeps sliding past a second', () => {
    const [a, b, c] = stackUp([box('a', 10, 100), box('b', 20, 105), box('c', 30, 110)]);
    expect(a?.top).toBe(100);
    expect(b?.top).toBe(100 - 30 - LABEL_GAP);
    expect(c?.top).toBe(100 - 2 * (30 + LABEL_GAP));
  });

  it('also dodges fixed rects, which it does not return', () => {
    const dot = { left: 0, top: 100, width: 24, height: 24 };
    const out = stackUp([box('a', 10, 105)], [dot]);
    expect(out).toHaveLength(1);
    expect(out[0]?.top).toBe(100 - 30 - LABEL_GAP);
  });

  it('does not change the boxes it was given', () => {
    const boxes = [box('a', 10, 100), box('b', 20, 105)];
    stackUp(boxes);
    expect(boxes[1]?.top).toBe(105);
  });
});
