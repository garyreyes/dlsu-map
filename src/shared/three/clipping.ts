// The cut plane (7a). Only the entered building's materials get it, never the rest of the campus (PLAN §5).
import { Plane, Vector3 } from 'three';

/** A plane that keeps everything at or below `height` (scene y, meters) and clips everything above. Three clips
 *  where the distance to the plane is negative, so the normal points down. */
export const cutPlane = (height: number): Plane => new Plane(new Vector3(0, -1, 0), height);
