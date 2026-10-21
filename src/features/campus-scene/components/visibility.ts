import { Raycaster, Vector3, type Object3D } from 'three';
import type { BandSample } from '../floor-band';

const ray = new Raycaster();
const dir = new Vector3();
/** A hit this close in front of the point is the point's own wall, not something in the way, in meters. */
const SLACK = 0.3;

/** A band sample in scene coordinates: x east, y up, z south (massing.ts). */
export const toScene = (s: BandSample, out = new Vector3()) => out.set(s.x, s.h, -s.y);

/** True when nothing in `blockers` stands between `from` and `to`. */
export function sees(blockers: Object3D, from: Vector3, to: Vector3): boolean {
  dir.subVectors(to, from);
  const far = dir.length() - SLACK;
  if (far <= 0) return true;
  ray.set(from, dir.normalize());
  ray.far = far;
  return ray.intersectObject(blockers, false).length === 0;
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
