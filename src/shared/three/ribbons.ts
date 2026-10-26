// Lines as thin flat ribbons, for streets and paths on the ground (campus-scene) and hallways on a floor
// (indoor-view). The positions are drawing only: a wrong width shows on screen. `ribbonAlong` has one right answer, so
// it is tested (ribbons.test.ts). Data coordinates are meters, x east and y north; the scene's are x east, y up and z
// south, so north is -z.

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

/** For each vertex `ribbonPositions(lines, width, lift)` emits, in the same order: how far along the route it is, in
 *  meters, counting the lines one after another as one walk. A quad's start vertices sit half the width before its
 *  segment and its end vertices half the width past it, so the value across the quad is the distance along the line at
 *  every fragment. A segment too short to draw still counts toward the distance. */
export function ribbonAlong(lines: readonly (readonly number[])[], width: number): Float32Array {
  const out: number[] = [];
  const h = width / 2;
  let walked = 0;
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      const len = Math.hypot((line[i + 2] ?? 0) - (line[i] ?? 0), (line[i + 3] ?? 0) - (line[i + 1] ?? 0));
      if (len >= 0.01) {
        const [start, end] = [walked - h, walked + len + h];
        // The same order as the positions: r1, r2, l2, r1, l2, l1.
        out.push(start, end, end, start, end, start);
      }
      walked += len;
    }
  }
  return new Float32Array(out);
}
