import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { CameraControls } from '@react-three/drei';
import type { CampusBuilding } from '@/shared/data/campus';
import { MINOR_LABEL_DISTANCE, placeLabels, type LabelBox, type Rect } from '../labels';
import type { MapInsets } from './CameraRig';

/** Plates sit this far above the roof, in meters. */
const ROOF_GAP = 2;

/** The label elements by building slug, filled by LabelLayer and positioned by LabelProjector. */
export type LabelElements = Map<string, HTMLElement>;

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
}

/**
 * Building names on white plates (DESIGN.md, Map labels), in a layer over the canvas. Hidden until the projector
 * places them; decorative for screen readers, since every building is reachable from search.
 */
export function LabelLayer({ buildings, elementsRef, selected }: LayerProps) {
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
    </div>
  );
}

interface ProjectorProps {
  buildings: readonly CampusBuilding[];
  elementsRef: RefObject<LabelElements>;
  insets: MapInsets;
  /** Placed before every other label, and shown at any zoom. */
  selected: string | null;
}

/** Each frame the canvas draws: projects every anchor to the screen, then shows the labels that fit (labels.ts). */
export function LabelProjector({ buildings, elementsRef, insets, selected }: ProjectorProps) {
  const anchors = useMemo(() => buildings.map(anchorFor), [buildings]);
  const controls = useThree((s) => s.controls) as CameraControls | null;
  // Plate sizes never change (fixed text, system font), so each is measured once.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const scratch = useMemo(() => new Vector3(), []);

  useFrame(({ camera, size }) => {
    const distance = controls?.distance ?? Infinity;
    const boxes: LabelBox[] = [];
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
    for (const [id, el] of elementsRef.current) {
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
