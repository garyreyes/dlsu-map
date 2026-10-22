// The slide decides which way the cut plane moves and how high it is at each moment. If it picked the wrong move the
// wrong floors would stay drawn mid-slide, and if the ease missed its ends the plane would rest off the floor's cut.
// So each case asserts exact values.
import { describe, expect, it } from 'vitest';
import type { Volume } from '@/shared/data/campus';
import { indoorSchema } from '@/shared/data/indoor';
import sample from '@/shared/data/indoor.sample.json';
import { CUT_ABOVE_FLOOR, type Cutaway, type CutawayView } from './cutaway';
import { cutMove, IDLE_CUT, restHeight, retarget, settled, slideHeight, slideOf } from './slide';
import { SLIDE_MS, type CutSlide } from './transition';

const indoor = indoorSchema.parse(sample);
const volumes: Volume[] = [{ outline: [0, 0, 10, 0, 10, 10], base: 0, top: 13.6 }];

const cutaway = (building: string, floor: number): Cutaway => ({ building, floor, base: (floor - 1) * 3.4 });

const view = (building: string, floor: number, roof = 13.6): CutawayView => ({
  cutaway: cutaway(building, floor),
  indoor,
  rail: [],
  levels: 4,
  roof,
  volumes,
});

const cut = (floor: number) => (floor - 1) * 3.4 + CUT_ABOVE_FLOOR;

describe('cutMove', () => {
  it('enter: none before, one after', () => {
    expect(cutMove(null, cutaway('strc', 3))).toBe('enter');
  });

  it('exit: one before, none after', () => {
    expect(cutMove(cutaway('strc', 3), null)).toBe('exit');
  });

  it('floor: same building, another floor', () => {
    expect(cutMove(cutaway('strc', 3), cutaway('strc', 1))).toBe('floor');
  });

  it('swap: another building', () => {
    expect(cutMove(cutaway('strc', 3), cutaway('gok', 3))).toBe('swap');
  });

  it('none: both null', () => {
    expect(cutMove(null, null)).toBe('none');
  });

  it('none: the same building and floor', () => {
    expect(cutMove(cutaway('strc', 3), { ...cutaway('strc', 3) })).toBe('none');
  });
});

describe('slideOf', () => {
  it('is null when nothing changes', () => {
    expect(slideOf(null, null)).toBeNull();
    expect(slideOf(view('strc', 3), view('strc', 3))).toBeNull();
  });

  it('enter: shows the new cut, from its roof down to its cut height', () => {
    const next = view('strc', 3);
    expect(slideOf(null, next)).toEqual({ move: 'enter', shown: next, from: 13.6, to: cut(3) });
  });

  it('exit: shows the cut being left, from its cut height up to its roof', () => {
    const prev = view('strc', 3);
    expect(slideOf(prev, null)).toEqual({ move: 'exit', shown: prev, from: cut(3), to: 13.6 });
  });

  it('floor up: shows the lower floor, so the floors in between stay drawn', () => {
    const prev = view('strc', 1);
    const next = view('strc', 3);
    expect(slideOf(prev, next)).toEqual({ move: 'floor', shown: prev, from: cut(1), to: cut(3) });
  });

  it('floor down: shows the lower floor, which is the new one', () => {
    const prev = view('strc', 3);
    const next = view('strc', 1);
    expect(slideOf(prev, next)).toEqual({ move: 'floor', shown: next, from: cut(3), to: cut(1) });
  });

  it('swap: like an enter on the new building, from its own roof', () => {
    const prev = view('strc', 3, 13.6);
    const next = view('gok', 2, 20);
    expect(slideOf(prev, next)).toEqual({ move: 'swap', shown: next, from: 20, to: cut(2) });
  });

  it('starts where the plane is when an interrupted slide gives `at`', () => {
    const next = view('strc', 3);
    expect(slideOf(null, next, 9.25)?.from).toBe(9.25);
    expect(slideOf(view('strc', 1), next, 2.5)).toEqual({
      move: 'floor',
      shown: view('strc', 1),
      from: 2.5,
      to: cut(3),
    });
    expect(slideOf(view('strc', 3), null, 7)?.from).toBe(7);
  });
});

describe('slideHeight', () => {
  const slide: CutSlide = { move: 'enter', shown: view('strc', 3), from: 13.6, to: 8 };

  it('is exactly `from` at the start and exactly `to` at SLIDE_MS', () => {
    expect(slideHeight(slide, 0)).toBe(13.6);
    expect(slideHeight(slide, SLIDE_MS)).toBe(8);
  });

  it('stays at the ends outside the slide', () => {
    expect(slideHeight(slide, -50)).toBe(13.6);
    expect(slideHeight(slide, SLIDE_MS * 3)).toBe(8);
  });

  it('eases out cubically: height = to + (from - to) * (1 - p)^3 with p = t / SLIDE_MS', () => {
    const at = (ms: number) => slideHeight(slide, ms);
    const cubic = (p: number) => 8 + (13.6 - 8) * (1 - p) ** 3;
    expect(at(0)).toBe(13.6);
    expect(at(150)).toBeCloseTo(cubic(0.25), 10);
    expect(at(300)).toBeCloseTo(cubic(0.5), 10);
    expect(at(300)).toBeCloseTo(8.7, 10);
    expect(at(600)).toBe(8);
    expect(at(900)).toBe(8);
  });

  it('rises on an exit', () => {
    const up: CutSlide = { move: 'exit', shown: view('strc', 3), from: 8, to: 13.6 };
    expect(slideHeight(up, 300)).toBeCloseTo(13.6 - (13.6 - 8) * 0.125, 10);
  });
});

describe('retarget', () => {
  it('starts a slide on a new target, showing what the slide says', () => {
    const next = view('strc', 3);
    const slide = slideOf(null, next);
    expect(retarget(IDLE_CUT, next, false, 0)).toEqual({ target: next, shown: next, slide });
  });

  it('jumps to the end state under reduced motion', () => {
    const next = view('strc', 3);
    expect(retarget(IDLE_CUT, next, true, 0)).toEqual({ target: next, shown: next, slide: null });
    const mid = retarget(IDLE_CUT, next, false, 0);
    expect(retarget(mid, null, true, 9)).toEqual({ target: null, shown: null, slide: null });
  });

  it('shows the cut being left while an exit plays, then settles to nothing', () => {
    const at3 = view('strc', 3);
    const resting: typeof IDLE_CUT = { target: at3, shown: at3, slide: null };
    const leaving = retarget(resting, null, false, 0);
    expect(leaving).toEqual({ target: null, shown: at3, slide: slideOf(at3, null) });
    expect(settled(leaving)).toEqual({ target: null, shown: null, slide: null });
  });

  it('starts an interrupted slide where the plane is, in the same building', () => {
    const at3 = view('strc', 3);
    const entering = retarget(IDLE_CUT, at3, false, 0);
    const leaving = retarget(entering, null, false, 10.5);
    expect(leaving.slide).toEqual({ move: 'exit', shown: at3, from: 10.5, to: 13.6 });
  });

  it('keeps the lowest floor drawn when a slide up is interrupted by another floor up', () => {
    const at1 = view('strc', 1);
    const up = retarget({ target: at1, shown: at1, slide: null }, view('strc', 2), false, cut(1));
    const at3 = view('strc', 3);
    expect(retarget(up, at3, false, 2).slide).toEqual({ move: 'floor', shown: at1, from: 2, to: cut(3) });
  });

  it('starts from the new roof when the interrupted slide was in another building', () => {
    const gok = view('gok', 2, 20);
    const entering = retarget(IDLE_CUT, view('strc', 3), false, 0);
    const swapped = retarget(entering, gok, false, 10.5);
    expect(swapped.slide).toEqual({ move: 'swap', shown: gok, from: 20, to: cut(2) });
  });

  it('keeps the slide and takes the newer view when the cut is unchanged', () => {
    const next = view('strc', 3);
    const entering = retarget(IDLE_CUT, next, false, 0);
    const again = { ...next };
    expect(retarget(entering, again, false, 11)).toEqual({ ...entering, target: again });
  });

  it('shows the new view at once when nothing slides and the cut is unchanged', () => {
    const next = view('strc', 3);
    const again = { ...next };
    expect(retarget({ target: next, shown: next, slide: null }, again, false, 0)).toEqual({
      target: again,
      shown: again,
      slide: null,
    });
  });
});

describe('restHeight', () => {
  it("is the target floor's cut, or 0 when nothing is cut", () => {
    expect(restHeight(view('strc', 3))).toBe(cut(3));
    expect(restHeight(null)).toBe(0);
  });
});
