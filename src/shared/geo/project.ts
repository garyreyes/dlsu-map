// Lon/lat ↔ local meters around a fixed origin: x is meters east, y is meters north. The map is under a kilometre
// across, so a flat projection with WGS84's scale at the origin is accurate to millimetres. Tests: project.test.ts.

export type LonLat = readonly [lon: number, lat: number];
export type Meters = readonly [x: number, y: number];

const A = 6378137; // WGS84 semi-major axis, m
const E2 = 0.00669437999014; // WGS84 first eccentricity squared
const RAD = Math.PI / 180;

export function projection(origin: { readonly lon: number; readonly lat: number }) {
  const sin = Math.sin(origin.lat * RAD);
  const w = 1 - E2 * sin * sin;
  const metersPerLon = RAD * (A / Math.sqrt(w)) * Math.cos(origin.lat * RAD); // along the parallel
  const metersPerLat = RAD * ((A * (1 - E2)) / w ** 1.5); // along the meridian
  return {
    toMeters: ([lon, lat]: LonLat): [number, number] => [
      (lon - origin.lon) * metersPerLon,
      (lat - origin.lat) * metersPerLat,
    ],
    toLonLat: ([x, y]: Meters): [number, number] => [origin.lon + x / metersPerLon, origin.lat + y / metersPerLat],
  };
}
