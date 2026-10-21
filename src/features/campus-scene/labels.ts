// Which building labels show (DESIGN.md, Map labels). Labels hide rather than overlap: the lower rank (more
// important) is placed first and keeps its spot, and none may sit under the chrome or off the screen. Boxes are
// measured CSS pixels, never estimated from the text length. No React, no DOM. Tests: labels.test.ts.

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LabelBox extends Rect {
  id: string;
  /** 0 is placed first. Equal ranks keep the order they were given in. */
  rank: number;
}

/** The least room between two plates, in px, so their shadows don't merge. */
export const LABEL_GAP = 4;

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.left < b.left + b.width + gap &&
  b.left < a.left + a.width + gap &&
  a.top < b.top + b.height + gap &&
  b.top < a.top + a.height + gap;

const inside = (r: Rect, view: { width: number; height: number }) =>
  r.left >= 0 && r.top >= 0 && r.left + r.width <= view.width && r.top + r.height <= view.height;

/** The ids of the labels to show, given each label's box, the chrome's boxes and the screen size. */
export function placeLabels(
  labels: readonly LabelBox[],
  keepOut: readonly Rect[],
  view: { width: number; height: number },
): Set<string> {
  const placed: Rect[] = [];
  const shown = new Set<string>();
  // Array.prototype.sort is stable, so equal ranks keep their input order.
  for (const label of [...labels].sort((a, b) => a.rank - b.rank)) {
    if (!inside(label, view)) continue;
    if (keepOut.some((r) => overlaps(label, r, 0))) continue;
    if (placed.some((r) => overlaps(label, r, LABEL_GAP))) continue;
    placed.push(label);
    shown.add(label.id);
  }
  return shown;
}

/** Minor labels (buildings without interiors) only show once the camera is this close to what it looks at, in m. */
export const MINOR_LABEL_DISTANCE = 550;
