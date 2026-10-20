// A wrong projection shifts or stretches the whole map without any error: every building would still draw, just in
// the wrong place. So the scale is checked against WGS84 degree lengths at the campus latitude, worked out by hand.
import { describe, expect, it } from 'vitest';
import { projection } from './project';

const origin = { lon: 120.9932, lat: 14.5647 };
const { toMeters, toLonLat } = projection(origin);

describe('projection', () => {
  it('puts the origin at 0, 0', () => {
    expect(toMeters([120.9932, 14.5647])).toStrictEqual([0, 0]);
  });

  // WGS84 at 14.5647° N: 1° of longitude is 107,765 m, 1° of latitude is 110,644 m.
  it('measures 0.001° east as 107.77 m and 0.001° north as 110.64 m', () => {
    const [east] = toMeters([120.9942, 14.5647]);
    const [, north] = toMeters([120.9932, 14.5657]);
    expect(east).toBeCloseTo(107.765, 2);
    expect(north).toBeCloseTo(110.644, 2);
  });

  it('makes x grow to the east and y to the north', () => {
    const [x, y] = toMeters([120.9922, 14.5637]); // south-west of the origin
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
  });

  it('turns meters back into the same lon/lat', () => {
    const [lon, lat] = toLonLat(toMeters([120.99123, 14.56789]));
    expect(lon).toBeCloseTo(120.99123, 9);
    expect(lat).toBeCloseTo(14.56789, 9);
  });
});
