import { Raycaster, Vector3, type Object3D } from 'three';
import type { BandSample } from '../floor-band';

const ray = new Raycaster();
const dir = new Vector3();
/** A hit this close in front of the point is the point's own wall, not something in the way, in meters. */
const SLACK = 0.3;

/** A band sample in scene coordinates: x east, y up, z south (massing.ts). */
export const toScene = (s: BandSample, out = new Vector3()) => out.set(s.x, s.h, -s.y);

/** Meters from (x, y) to the segment a-b. */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/**
 * True when a scene point lies inside any of the outlines (flat campus x, y meters; scene z is -y), or within
 * `margin` meters of an outline's edge. A wall's hit lies on the edge, where inside-or-not is down to rounding.
 */
export function insideOutlines(p: Vector3, outlines: readonly (readonly number[])[], margin = 0): boolean {
  const x = p.x;
  const y = -p.z;
  return outlines.some((o) => {
    let inside = false;
    let near = Number.POSITIVE_INFINITY;
    for (let i = 0, j = o.length / 2 - 1; i < o.length / 2; j = i++) {
      const ax = o[2 * j] ?? 0;
      const ay = o[2 * j + 1] ?? 0;
      const bx = o[2 * i] ?? 0;
      const by = o[2 * i + 1] ?? 0;
      if (by > y !== ay > y && x < ((ax - bx) * (y - by)) / (ay - by) + bx) inside = !inside;
      near = Math.min(near, toSegment(x, y, ax, ay, bx, by));
    }
    return inside || near <= margin;
  });
}

/**
 * True when nothing in `blockers` stands between `from` and `to`. A hit `ignore` accepts doesn't count: the focus
 * building's own walls never block its band.
 */
export function sees(blockers: Object3D, from: Vector3, to: Vector3, ignore?: (hit: Vector3) => boolean): boolean {
  dir.subVectors(to, from);
  const far = dir.length() - SLACK;
  if (far <= 0) return true;
  ray.set(from, dir.normalize());
  ray.far = far;
  const hits = ray.intersectObject(blockers, false);
  return ignore ? hits.every((h) => ignore(h.point)) : hits.length === 0;
}

/** Where camera-controls puts the camera for this target, azimuth, polar angle and distance. */
export function cameraAt(target: Vector3, azimuth: number, polar: number, distance: number, out = new Vector3()) {
  const s = Math.sin(polar) * distance;
  return out.set(
    target.x + s * Math.sin(azimuth),
    target.y + Math.cos(polar) * distance,
    target.z + s * Math.cos(azimuth),
  );
}
