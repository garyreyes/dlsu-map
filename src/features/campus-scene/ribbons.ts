// Streets and paths as thin flat ribbons on the ground (D13: "thin bright lines, not wide grey strips"), and the LRT
// viaduct as blocks along its line. Drawing only, so no tests: a wrong width shows on screen. Data coordinates are
// meters, x east and y north; the scene's z is -y (see massing.ts).
import type { Block } from './massing';

/** Ribbon widths in meters, by path kind. */
export const RIBBON_WIDTH = { road: 7, street: 3.6, foot: 1.6 } as const;
/** The LRT Line 1 deck: about 9 m wide, its underside 9 m above Taft Avenue. */
export const VIADUCT = { width: 9, base: 9, top: 11 } as const;

/** Flat triangles (x, y, z per vertex, facing up) for each line at width `width`, `lift` meters above the ground. */
export function ribbonPositions(lines: readonly (readonly number[])[], width: number, lift: number): Float32Array {
  const out: number[] = [];
  const h = width / 2;
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      const [x1, y1, x2, y2] = [line[i] ?? 0, line[i + 1] ?? 0, line[i + 2] ?? 0, line[i + 3] ?? 0];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.01) continue;
      // Along and across the segment, each end pushed out by half the width so joints overlap instead of gapping.
      const [ux, uy] = [((x2 - x1) / len) * h, ((y2 - y1) / len) * h];
      const [ax, ay, bx, by] = [x1 - ux, y1 - uy, x2 + ux, y2 + uy];
      const [l1, l2, r1, r2] = [
        [ax - uy, ay + ux],
        [bx - uy, by + ux],
        [ax + uy, ay - ux],
        [bx + uy, by - ux],
      ] as const;
      // Anticlockwise seen from above once y becomes -z: left side first.
      for (const [x, y] of [r1, r2, l2, r1, l2, l1]) out.push(x, lift, -y);
    }
  }
  return new Float32Array(out);
}

/** The viaduct as one deck block per segment of the rail line. */
export function viaductBlocks(lines: readonly (readonly number[])[]): Block[] {
  const h = VIADUCT.width / 2;
  const blocks: Block[] = [];
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      const [x1, y1, x2, y2] = [line[i] ?? 0, line[i + 1] ?? 0, line[i + 2] ?? 0, line[i + 3] ?? 0];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.01) continue;
      const [nx, ny] = [(-(y2 - y1) / len) * h, ((x2 - x1) / len) * h];
      blocks.push({
        outline: [x1 + nx, y1 + ny, x1 - nx, y1 - ny, x2 - nx, y2 - ny, x2 + nx, y2 + ny],
        base: VIADUCT.base,
        top: VIADUCT.top,
      });
    }
  }
  return blocks;
}
