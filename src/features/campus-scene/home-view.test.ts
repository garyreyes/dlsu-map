// The home heading: the camera stands on Taft Avenue's side of the main campus, so Taft runs along the bottom of the
// screen like the official campus map (DESIGN.md, Camera). A sign mistake would show the campus from behind and
// nothing would fail, so each case pins the exact angle.
import { describe, expect, it } from 'vitest';
import { fitDistance, fitReach, homeAzimuth, mainCampusCentre } from './home-view';

/** Compares headings the short way round, so -π and π count as the same. */
const close = (actual: number | null, expected: number, within = 1e-10) => {
  expect(actual).not.toBeNull();
  const d = (actual ?? NaN) - expected;
  expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(within);
};

/** camera-controls' azimuth: 0 puts the camera at +z (south of the target), π/2 at +x (east). */
describe('homeAzimuth', () => {
  it.each([
    ['west of campus: camera in the west, looking east', [[-100, -500, -100, 500]], -Math.PI / 2],
    ['east of campus: camera in the east, looking west', [[100, -500, 100, 500]], Math.PI / 2],
    ['south of campus: camera in the south, north up', [[-500, -300, 500, -300]], 0],
    ['north of campus: camera in the north', [[-500, 300, 500, 300]], Math.PI],
  ])('Taft %s', (_label, lines, expected) => {
    close(homeAzimuth(lines, [0, 0]), expected);
  });

  it('stands square to a diagonal street', () => {
    // Taft runs from south-west to north-east, passing south-east of the campus.
    close(homeAzimuth([[0, -200, 200, 0]], [0, 0]), Math.PI / 4);
  });

  it('gives the same heading whichever way each carriageway was drawn', () => {
    const north = [-100, -500, -100, 500];
    const south = [-102, 500, -102, -500];
    close(homeAzimuth([north, south], [0, 0]), -Math.PI / 2);
  });

  it('follows the street, not where OSM put more points', () => {
    // One 1 km stretch with 2 points, one 11 m kinked stretch with 5: the long one decides, to within a degree.
    const long = [-100, -500, -100, 500];
    const short = [-100, 500, -98, 501, -96, 502, -94, 503, -92, 504];
    close(homeAzimuth([long, short], [0, 0]), -Math.PI / 2, Math.PI / 180);
  });

  it('answers null when there is no Taft Avenue to go by', () => {
    expect(homeAzimuth([], [0, 0])).toBeNull();
  });
});

describe('mainCampusCentre', () => {
  it('picks the largest campus ring, not the small one across the street', () => {
    const main = [0, 0, 100, 0, 100, 100, 0, 100];
    const acrossTheStreet = [-60, 0, -40, 0, -40, 20, -60, 20];
    expect(mainCampusCentre([acrossTheStreet, main])).toStrictEqual([50, 50]);
  });

  it('works for a ring drawn clockwise', () => {
    expect(mainCampusCentre([[0, 0, 0, 10, 10, 10, 10, 0]])).toStrictEqual([5, 5]);
  });
});

describe('fitReach', () => {
  const phone = { width: 390, height: 844, fovDeg: 40, polar: (8 * Math.PI) / 180 };
  const free = { top: 0, bottom: 0, left: 0 };

  it('is what fitDistance gives for a circle', () => {
    expect(fitDistance(100, phone, free)).toBe(fitReach({ across: 100, along: 100 }, phone, free));
    expect(fitDistance(55, { ...phone, polar: 1 }, { top: 60, bottom: 300, left: 0 })).toBe(
      fitReach({ across: 55, along: 55 }, { ...phone, polar: 1 }, { top: 60, bottom: 300, left: 0 }),
    );
  });

  it('needs less distance for a tall narrow reach on a portrait screen than for the circle of its longer half', () => {
    const tall = fitReach({ across: 20, along: 100 }, phone, free);
    expect(tall).toBeLessThan(fitDistance(100, phone, free));
    // Its length is what limits it here, not its width: more width changes nothing until the width term wins.
    expect(fitReach({ across: 40, along: 100 }, phone, free)).toBe(tall);
  });

  it('needs more distance for a wide reach than for a tall one of the same size', () => {
    const wide = fitReach({ across: 100, along: 20 }, phone, free);
    expect(wide).toBeGreaterThan(fitReach({ across: 20, along: 100 }, phone, free));
  });
});
