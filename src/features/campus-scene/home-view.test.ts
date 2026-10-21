// The home heading: the camera stands on Taft Avenue's side of the main campus, so Taft runs along the bottom of the
// screen like the official campus map (DESIGN.md, Camera). A sign mistake would show the campus from behind and
// nothing would fail, so each case pins the exact angle.
import { describe, expect, it } from 'vitest';
import { homeAzimuth, mainCampusCentre } from './home-view';

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
