// SVG pictures for checking a draft by eye: the overlay (walls red, route blue, on the straightened photo) and a plain
// 3D preview (walls extruded, painter's order), as in the spike. Presentation only, so no tests.
import type { Segment } from './image.ts';

const line = (s: Segment, color: string, width: number) =>
  `<line x1="${String(s.x0)}" y1="${String(s.y0)}" x2="${String(s.x1)}" y2="${String(s.y1)}" stroke="${color}" stroke-width="${String(width)}"/>`;

/** Drawn over the straightened photo (same size), which shows through a white wash. */
export function overlaySvg(
  width: number,
  height: number,
  walls: readonly Segment[],
  route: readonly Segment[],
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">
  <rect width="100%" height="100%" fill="white" opacity="0.55"/>
  ${walls.map((s) => line(s, '#d00', Math.max(4, s.t))).join('')}
  ${route.map((s) => line(s, '#06f', 10)).join('')}</svg>`;
}

/** A tilted, rotated view with each wall raised to a fixed height. `pad` is the straightened image's padding. */
export function preview3dSvg(
  width: number,
  height: number,
  pad: number,
  walls: readonly Segment[],
  route: readonly Segment[],
): string {
  const S = 2400 / width;
  const [ANG, TILT, WALL_H] = [-0.5, 0.55, 70];
  const proj = ([x, y, z]: [number, number, number]): [number, number, number] => {
    const xr = x * Math.cos(ANG) - y * Math.sin(ANG);
    const yr = x * Math.sin(ANG) + y * Math.cos(ANG);
    return [xr * S + 300, yr * S * TILT - z * S + 1400, yr];
  };
  const poly = (pts: [number, number, number][], fill: string) =>
    `<polygon points="${pts.map((p) => proj(p).slice(0, 2).join(',')).join(' ')}" fill="${fill}" stroke="#7a8794" stroke-width="0.6"/>`;
  const boxes = walls
    .map((s) => {
      const half = s.t / 2;
      const flat = s.y0 === s.y1;
      const [x0, x1] = flat ? [s.x0, s.x1] : [s.x0 - half, s.x0 + half];
      const [y0, y1] = flat ? [s.y0 - half, s.y0 + half] : [s.y0, s.y1];
      return { x0, x1, y0, y1, depth: proj([(x0 + x1) / 2, (y0 + y1) / 2, 0])[2] };
    })
    .sort((a, b) => a.depth - b.depth);
  const faces = boxes.map(({ x0, x1, y0, y1 }) =>
    [
      poly(
        [
          [x0, y1, 0],
          [x1, y1, 0],
          [x1, y1, WALL_H],
          [x0, y1, WALL_H],
        ],
        '#c9d3dc',
      ),
      poly(
        [
          [x1, y0, 0],
          [x1, y1, 0],
          [x1, y1, WALL_H],
          [x1, y0, WALL_H],
        ],
        '#aab6c2',
      ),
      poly(
        [
          [x0, y0, WALL_H],
          [x1, y0, WALL_H],
          [x1, y1, WALL_H],
          [x0, y1, WALL_H],
        ],
        '#f2f5f8',
      ),
    ].join(''),
  );
  const floor = poly(
    [
      [pad, pad, 0],
      [width - pad, pad, 0],
      [width - pad, height - pad, 0],
      [pad, height - pad, 0],
    ],
    '#e8e2d6',
  );
  const routeLines = route.map((s) => {
    const [a, b] = [proj([s.x0, s.y0, 2]), proj([s.x1, s.y1, 2])];
    return `<line x1="${String(a[0])}" y1="${String(a[1])}" x2="${String(b[0])}" y2="${String(b[1])}" stroke="#0a7a3a" stroke-width="6" stroke-linecap="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2800" height="1700"><rect width="100%" height="100%" fill="#fff"/>
  ${floor}${routeLines.join('')}${faces.join('')}</svg>`;
}

/** A grid every `step` px over a crop, labelled with the photo's own coordinates, for reading a corner exactly. */
export function cropGridSvg(size: number, scale: number, left: number, top: number, step: number): string {
  const lines: string[] = [];
  const first = (origin: number) => Math.ceil(origin / step) * step;
  for (let x = first(left); x < left + size; x += step) {
    const px = (x - left) * scale;
    lines.push(
      `<line x1="${String(px)}" y1="0" x2="${String(px)}" y2="${String(size * scale)}" stroke="#f0f" stroke-width="1" opacity="0.6"/>`,
    );
    lines.push(`<text x="${String(px + 2)}" y="14" font-size="12" fill="#f0f">${String(x)}</text>`);
  }
  for (let y = first(top); y < top + size; y += step) {
    const py = (y - top) * scale;
    lines.push(
      `<line x1="0" y1="${String(py)}" x2="${String(size * scale)}" y2="${String(py)}" stroke="#0aa" stroke-width="1" opacity="0.6"/>`,
    );
    lines.push(`<text x="2" y="${String(py - 2)}" font-size="12" fill="#0aa">${String(y)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size * scale)}" height="${String(size * scale)}">${lines.join('')}</svg>`;
}
