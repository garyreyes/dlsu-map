// The 2D view's rules (D58) are a table with one right answer per cell: which tilt each shot is seen from, whether it is
// forced north up, and which gestures stay on. A wrong cell still looks plausible on screen, so exact values.
import { describe, expect, it } from 'vitest';
import { DRONE_POLAR, FLAT_POLAR, HOME_POLAR, NORTH_UP, SELECT_POLAR, STEP_POLAR } from '@/shared/config/camera';
import type { MapView } from '@/shared/settings/map-settings';
import { gesturesFor, northFrom, shotLens, usualAzimuth, type Shot } from './flat';

const TURN = 2 * Math.PI;

describe('shotLens', () => {
  const table: [MapView, Shot, number, boolean][] = [
    ['3d', 'home', HOME_POLAR, false],
    ['3d', 'building', SELECT_POLAR, false],
    ['3d', 'trip', DRONE_POLAR, false],
    ['3d', 'trip-no-walk', SELECT_POLAR, false],
    ['3d', 'ground-step', DRONE_POLAR, false],
    ['3d', 'indoor-step', STEP_POLAR, false],
    ['3d', 'indoor-band', STEP_POLAR, false],
    ['2d', 'home', FLAT_POLAR, true],
    ['2d', 'building', FLAT_POLAR, true],
    ['2d', 'trip', DRONE_POLAR, false],
    ['2d', 'trip-no-walk', FLAT_POLAR, true],
    ['2d', 'ground-step', DRONE_POLAR, false],
    ['2d', 'indoor-step', FLAT_POLAR, false],
    ['2d', 'indoor-band', FLAT_POLAR, false],
  ];

  it.each(table)('%s %s looks from polar %d, north up: %s', (view, shot, polar, northUp) => {
    expect(shotLens(view, shot)).toEqual({ polar, northUp });
  });
});

describe('gesturesFor', () => {
  it('keeps twist and tilt on in 3D, in the player or not', () => {
    expect(gesturesFor('3d', false)).toEqual({ tilt: true, twist: true });
    expect(gesturesFor('3d', true)).toEqual({ tilt: true, twist: true });
  });

  it('turns tilt and twist off while browsing in 2D', () => {
    expect(gesturesFor('2d', false)).toEqual({ tilt: false, twist: false });
  });

  it('keeps twist but not tilt in the route player in 2D', () => {
    expect(gesturesFor('2d', true)).toEqual({ tilt: false, twist: true });
  });
});

describe('usualAzimuth', () => {
  it('is the home heading in 3D', () => {
    expect(usualAzimuth('3d', 1.234)).toBe(1.234);
  });

  it('is north up in 2D, whatever the home heading', () => {
    expect(usualAzimuth('2d', 1.234)).toBe(NORTH_UP);
  });
});

describe('northFrom', () => {
  it('turns back the short way from a small angle', () => {
    expect(northFrom(0.3)).toBeCloseTo(0, 12);
  });

  it('does not spin a full turn from an angle past one turn', () => {
    expect(northFrom(TURN + 0.3)).toBeCloseTo(TURN, 12);
  });

  it('turns up to the nearer north from a negative angle', () => {
    expect(northFrom(-3)).toBeCloseTo(0, 12);
  });

  it('picks the nearer north from three half-turns round', () => {
    // 3π is half a turn past 2π: either north is π away, so it must land on a multiple of 2π within π.
    const to = northFrom(3 * Math.PI);
    expect(Math.abs(to - 3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(Math.abs(Math.sin(to))).toBeLessThan(1e-9);
    expect(Math.cos(to)).toBeCloseTo(1, 12);
  });

  it('stays put when already north up', () => {
    expect(northFrom(NORTH_UP)).toBe(NORTH_UP);
  });
});
