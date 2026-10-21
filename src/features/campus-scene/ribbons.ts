// How wide streets and paths are drawn (D13: "thin bright lines, not wide grey strips"; the ribbons themselves come
// from shared/three), and the LRT viaduct as blocks along its line. Drawing only, so no tests: a wrong width shows on
// screen. Data coordinates are meters, x east and y north; the scene's z is -y (see massing.ts).
import type { Block } from './massing';

/** Ribbon widths in meters, by path kind. */
export const RIBBON_WIDTH = { road: 7, street: 3.6, foot: 1.6 } as const;
/** The LRT Line 1 deck: about 9 m wide, its underside 9 m above Taft Avenue. */
export const VIADUCT = { width: 9, base: 9, top: 11 } as const;

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
