// Changing floors inside one building (D34). Indoor walking to the stairs or elevator comes with the floor plans (8b).
import { AUTO_ELEVATOR_FLOORS, ELEVATOR_PER_FLOOR, ELEVATOR_WAIT, STAIRS_PER_FLOOR } from '@/shared/config/routing';
import type { FloorMode, Leg } from '@/shared/data/route';

export type FloorsLeg = Extract<Leg, { kind: 'floors' }>;

/** Stairs or elevator from one floor to another, or null on the same floor. `noElevator` is set only when the
 *  student asked for the elevator: Auto falling back to the stairs isn't news. */
export function floorsLeg(
  building: string,
  from: number,
  to: number,
  mode: FloorMode,
  hasElevator: boolean,
): FloorsLeg | null {
  const floors = Math.abs(to - from);
  if (floors === 0) return null;
  const wantsElevator = mode === 'elevator' || (mode === 'auto' && floors >= AUTO_ELEVATOR_FLOORS);
  const by = wantsElevator && hasElevator ? 'elevator' : 'stairs';
  const seconds = by === 'elevator' ? ELEVATOR_WAIT + ELEVATOR_PER_FLOOR * floors : STAIRS_PER_FLOOR * floors;
  const leg = { kind: 'floors', building, from, to, by, seconds } as const;
  return mode === 'elevator' && !hasElevator ? { ...leg, noElevator: true } : leg;
}
