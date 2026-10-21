// Where the home view looks from (DESIGN.md, Camera): the camera stands on Taft Avenue's side of the main campus,
// square to the street, so Taft runs along the bottom of the screen like the official campus map. No React, no DOM.
// Data coordinates: meters, x east, y north. Tests: home-view.test.ts.

type XY = readonly [number, number];

/**
 * camera-controls' azimuth for the home view (0 puts the camera south of its target, π/2 east), from Taft Avenue's
 * lines and the main campus's centre. Null when there are no lines to go by.
 *
 * The street's direction is the length-weighted sum of its segments, each flipped to agree with the first, so the
 * two carriageways (drawn in opposite directions) and OSM's uneven point spacing don't tilt it.
 */
export function homeAzimuth(lines: readonly (readonly number[])[], centre: XY): number | null {
  let [dx, dy] = [0, 0];
  let [mx, my, total] = [0, 0, 0];
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      const [x1, y1, x2, y2] = [line[i] ?? 0, line[i + 1] ?? 0, line[i + 2] ?? 0, line[i + 3] ?? 0];
      let [sx, sy] = [x2 - x1, y2 - y1];
      if (dx === 0 && dy === 0 ? false : sx * dx + sy * dy < 0) [sx, sy] = [-sx, -sy];
      [dx, dy] = [dx + sx, dy + sy];
      const len = Math.hypot(sx, sy);
      [mx, my, total] = [mx + ((x1 + x2) / 2) * len, my + ((y1 + y2) / 2) * len, total + len];
    }
  }
  if (total === 0) return null;
  // Square to the street, on the side the street is on.
  let [nx, ny] = [dy, -dx];
  if (nx * (mx / total - centre[0]) + ny * (my / total - centre[1]) < 0) [nx, ny] = [-nx, -ny];
  // In the scene z is -y, and the azimuth is the angle of the camera's offset from +z toward +x.
  return Math.atan2(nx, -ny);
}

/** The area centre of the largest campus ring: the main campus, not Andrew or Razon across the street. */
export function mainCampusCentre(rings: readonly (readonly number[])[]): [number, number] {
  let best: [number, number] = [0, 0];
  let bestArea = -1;
  for (const ring of rings) {
    const n = ring.length / 2;
    let [a, cx, cy] = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [x1, y1, x2, y2] = [ring[i * 2] ?? 0, ring[i * 2 + 1] ?? 0, ring[j * 2] ?? 0, ring[j * 2 + 1] ?? 0];
      const cross = x1 * y2 - x2 * y1;
      [a, cx, cy] = [a + cross, cx + (x1 + x2) * cross, cy + (y1 + y2) * cross];
    }
    if (a !== 0 && Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

/** The middle of every building's outline points and the farthest point from it, so home can frame them all. */
export function framing(outlines: readonly (readonly number[])[]): { centre: [number, number]; radius: number } {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const o of outlines) {
    for (let i = 0; i + 1 < o.length; i += 2) {
      const [x, y] = [o[i] ?? 0, o[i + 1] ?? 0];
      [minX, minY, maxX, maxY] = [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)];
    }
  }
  if (minX > maxX) return { centre: [0, 0], radius: 0 };
  const centre: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
  let radius = 0;
  for (const o of outlines) {
    for (let i = 0; i + 1 < o.length; i += 2) {
      radius = Math.max(radius, Math.hypot((o[i] ?? 0) - centre[0], (o[i + 1] ?? 0) - centre[1]));
    }
  }
  return { centre, radius };
}

/**
 * How far back the camera stands so a ground circle of `radius` fits the part of the screen the chrome leaves free.
 * A first fit, tuned by eye on phones: the circle is foreshortened by the tilt toward the screen's top and bottom.
 */
export function fitDistance(
  radius: number,
  view: { width: number; height: number; fovDeg: number; polar: number },
  insets: { top: number; bottom: number; left: number },
): number {
  // The view offset (CameraRig) stretches the virtual screen by the difference between the top and bottom insets.
  const full = view.height + Math.abs(insets.bottom - insets.top);
  const perPixel = Math.tan((view.fovDeg * Math.PI) / 360) / (full / 2);
  const freeW = Math.max(120, view.width - insets.left);
  const freeH = Math.max(120, view.height - insets.top - insets.bottom);
  const across = radius / (perPixel * (freeW / 2));
  const upDown = (radius * Math.cos(view.polar)) / (perPixel * (freeH / 2));
  return Math.max(across, upDown) * 1.05;
}
