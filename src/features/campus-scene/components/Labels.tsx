import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { Vector3, type Mesh } from 'three';
import type { CameraControls } from '@react-three/drei';
import type { CampusBuilding } from '@/shared/data/campus';
import { chipAnchor, type BandSample, type ScreenPoint } from '../floor-band';
import { MINOR_LABEL_DISTANCE, placeLabels, type LabelBox, type Rect } from '../labels';
import type { MapInsets } from './CameraRig';
import { sees, toScene } from './visibility';

/** Plates sit this far above the roof, in meters. */
const ROOF_GAP = 2;

/** The label elements by building slug, filled by LabelLayer and positioned by LabelProjector. */
export type LabelElements = Map<string, HTMLElement>;

/** The floor chip sits this far right of the band point it marks, in px. */
const CHIP_GAP = 8;
/** The chip's id among the label boxes. Building slugs never start with a dot. */
const CHIP_ID = '.floor-chip';
/** Which band point the chip marks is re-checked at most this often, in ms: each check casts rays at the campus. */
const CHIP_CHECK_MS = 100;

interface Anchor {
  id: string;
  /** Scene coordinates of the plate's bottom middle. */
  point: Vector3;
  minor: boolean;
}

/** The middle of the building's own outline (its first volume), just above its tallest part. */
function anchorFor(b: CampusBuilding): Anchor {
  const [first] = b.volumes;
  const outline = first?.outline ?? [];
  let [x, y] = [0, 0];
  for (let i = 0; i + 1 < outline.length; i += 2) [x, y] = [x + (outline[i] ?? 0), y + (outline[i + 1] ?? 0)];
  const n = Math.max(1, outline.length / 2);
  const top = Math.max(...b.volumes.map((v) => v.top));
  return { id: b.slug, point: new Vector3(x / n, top + ROOF_GAP, -y / n), minor: b.tier === 'block' };
}

interface LayerProps {
  buildings: readonly CampusBuilding[];
  elementsRef: RefObject<LabelElements>;
  /** The selected building's label turns Campus Green (DESIGN.md, Map labels). */
  selected: string | null;
  /** The floor chip's text ("3F", "G"), shown while a room is selected. */
  chip: string | null;
  chipRef: RefObject<HTMLElement | null>;
}

/**
 * Building names on white plates (DESIGN.md, Map labels), in a layer over the canvas. Hidden until the projector
 * places them; decorative for screen readers, since every building is reachable from search.
 */
export function LabelLayer({ buildings, elementsRef, selected, chip, chipRef }: LayerProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-1 overflow-hidden" aria-hidden>
      {buildings.map((b) => (
        <span
          key={b.slug}
          data-map-label
          ref={(el) => {
            if (el) elementsRef.current.set(b.slug, el);
            else elementsRef.current.delete(b.slug);
          }}
          className={`absolute top-0 left-0 rounded-label px-2 py-0.75 font-semibold whitespace-nowrap shadow-float ${
            b.slug === selected
              ? 'bg-accent text-white'
              : `bg-surface ${b.tier === 'block' ? 'text-ink-2' : 'text-ink'}`
          }`}
          style={{ visibility: 'hidden' }}
        >
          {b.short}
        </span>
      ))}
      {/* The floor chip (DESIGN.md, Floor band): Label strong, white on Campus Green, beside the band. */}
      {chip !== null && (
        <span
          ref={chipRef}
          data-floor-chip
          className="absolute top-0 left-0 rounded-label bg-accent px-2 py-0.75 font-bold whitespace-nowrap text-white tabular-nums shadow-float"
          style={{ visibility: 'hidden' }}
        >
          {chip}
        </span>
      )}
    </div>
  );
}

interface ProjectorProps {
  buildings: readonly CampusBuilding[];
  elementsRef: RefObject<LabelElements>;
  insets: MapInsets;
  /** Placed before every other label, and shown at any zoom. */
  selected: string | null;
  /** The floor band's sample points; the chip goes on the right-most one the camera sees, before any label. */
  band: readonly BandSample[];
  chipRef: RefObject<HTMLElement | null>;
  /** What can hide the band from the camera. */
  massRef: RefObject<Mesh | null>;
}

/** Each frame the canvas draws: projects every anchor to the screen, then shows the labels that fit (labels.ts). */
export function LabelProjector({ buildings, elementsRef, insets, selected, band, chipRef, massRef }: ProjectorProps) {
  const anchors = useMemo(() => buildings.map(anchorFor), [buildings]);
  const controls = useThree((s) => s.controls) as CameraControls | null;
  // Plate sizes never change (fixed text, system font), so each is measured once; the chip once per floor label.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const scratch = useMemo(() => new Vector3(), []);
  const seen = useMemo(() => new Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);
  // The band point the chip marks, and when (and for which band) that was worked out. Between checks the chip follows
  // the same point, projected fresh each frame; a skipped check asks for one more frame, so the map never comes to
  // rest on a stale answer (frames only run on demand).
  const anchor = useRef<{ band: readonly BandSample[]; index: number | null; at: number; retry: number }>({
    band: [],
    index: null,
    at: -Infinity,
    retry: 0,
  });

  useFrame(({ camera, size }) => {
    const distance = controls?.distance ?? Infinity;
    const boxes: LabelBox[] = [];
    const chip = chipRef.current;
    if (chip && band.length > 0) {
      const points = band.map((p): ScreenPoint => {
        toScene(p, scratch).project(camera);
        // Behind the camera: NaN is never inside the view, so the point is skipped.
        return scratch.z > 1
          ? { x: NaN, y: NaN }
          : { x: ((scratch.x + 1) / 2) * size.width, y: ((1 - scratch.y) / 2) * size.height };
      });
      const view = { left: insets.left, top: insets.top, right: size.width, bottom: size.height - insets.bottom };
      const mass = massRef.current;
      const last = anchor.current;
      const now = performance.now();
      if (last.band !== band || now - last.at >= CHIP_CHECK_MS) {
        const index = chipAnchor(points, view, (i) => {
          const p = band[i];
          return !mass || !p || sees(mass, camera.position, toScene(p, seen));
        });
        anchor.current = { band, index, at: now, retry: last.retry };
      } else if (!last.retry) {
        last.retry = window.setTimeout(() => {
          anchor.current.retry = 0;
          invalidate();
        }, CHIP_CHECK_MS);
      }
      const at = anchor.current.index;
      const point = at === null ? undefined : points[at];
      if (point) {
        // Measured once per text, like the plates.
        const text = chip.textContent;
        let s = sizes.current.get(CHIP_ID + text);
        if (!s) {
          s = { width: chip.offsetWidth, height: chip.offsetHeight };
          if (s.width > 0) sizes.current.set(CHIP_ID + text, s);
        }
        boxes.push({ id: CHIP_ID, rank: -2, left: point.x + CHIP_GAP, top: point.y - s.height / 2, ...s });
      }
    }
    for (const a of anchors) {
      const el = elementsRef.current.get(a.id);
      const chosen = a.id === selected;
      if (!el || (a.minor && !chosen && distance > MINOR_LABEL_DISTANCE)) continue;
      scratch.copy(a.point).project(camera);
      if (scratch.z > 1) continue; // behind the camera
      let s = sizes.current.get(a.id);
      if (!s) {
        s = { width: el.offsetWidth, height: el.offsetHeight };
        if (s.width > 0) sizes.current.set(a.id, s);
      }
      const [x, y] = [((scratch.x + 1) / 2) * size.width, ((1 - scratch.y) / 2) * size.height];
      const rank = chosen ? -1 : a.minor ? 1 : 0;
      boxes.push({ id: a.id, rank, left: x - s.width / 2, top: y - s.height, ...s });
    }
    const keepOut: Rect[] = [
      { left: 0, top: 0, width: size.width, height: insets.top },
      { left: 0, top: size.height - insets.bottom, width: size.width, height: insets.bottom },
      { left: 0, top: 0, width: insets.left, height: size.height },
    ];
    const shown = placeLabels(boxes, keepOut, size);
    const byId = new Map(boxes.map((b) => [b.id, b]));
    const placed: [string, HTMLElement][] = chip ? [[CHIP_ID, chip]] : [];
    for (const [id, el] of [...placed, ...elementsRef.current]) {
      const box = byId.get(id);
      if (box && shown.has(id)) {
        el.style.setProperty(
          'transform',
          `translate(${String(Math.round(box.left))}px, ${String(Math.round(box.top))}px)`,
        );
        el.style.setProperty('visibility', 'visible');
      } else {
        el.style.setProperty('visibility', 'hidden');
      }
    }
  });
  return null;
}
