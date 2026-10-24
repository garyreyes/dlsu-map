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

/**
 * Plates for spots that sit close together (two doors of one building) would hide each other, and a plate with no
 * name beside its chip is no help. Each plate that overlaps an earlier one slides up above it instead, so all of
 * them can show, in the order given. They also dodge `fixed` rects (the dot, the chip) the same way. Returns new
 * boxes; the input is left as it was.
 */
export function stackUp(boxes: readonly LabelBox[], fixed: readonly Rect[] = []): LabelBox[] {
  const out: Rect[] = [...fixed];
  const moved: LabelBox[] = [];
  for (const box of boxes) {
    let top = box.top;
    // Each pass moves above the plate in the way; the list is short and every move goes strictly up.
    for (let hit = out.find((o) => overlaps({ ...box, top }, o, LABEL_GAP)); hit;) {
      top = hit.top - box.height - LABEL_GAP;
      hit = out.find((o) => overlaps({ ...box, top }, o, LABEL_GAP));
    }
    out.push({ ...box, top });
    moved.push({ ...box, top });
  }
  return moved;
}

/** Minor labels (buildings without interiors) only show once the camera is this close to what it looks at, in m. */
export const MINOR_LABEL_DISTANCE = 550;
