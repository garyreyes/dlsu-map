// Routing costs (D34): the owner's answers, 2026-10-20. The router (4b) adds up seconds, so walking, waiting at
// Taft and changing floors are compared in one unit. The time shown in S5 is the same sum without WAY_FACTOR: real
// walking time, plus the waits and floor changes.
import type { Walk } from '@/shared/data/campus';

type WayKind = Walk['ways'][number]['kind'];

/** Walking speed, meters per second. */
export const WALK_SPEED = 1.3;

/** When choosing a route, each meter of a way counts as this many: small streets are walked down the middle with
 *  cars, and steps are slower. Not in the time shown to students. */
export const WAY_FACTOR = {
  path: 1,
  sidewalk: 1,
  crossing: 1,
  door: 1,
  street: 1.5,
  steps: 1.2,
} as const satisfies Record<WayKind, number>;

/** Seconds of waiting each time a route crosses the named street. Small streets (Dagonoy) have no wait. */
export const CROSSING_WAIT: Readonly<Record<string, number>> = { 'Taft Avenue': 45 };

/** Stairs, seconds per floor, up or down. */
export const STAIRS_PER_FLOOR = 20;
/** Elevator: the wait for a car (rush hour is 3–10 min; 3 is the estimate), then seconds per floor. */
export const ELEVATOR_WAIT = 180;
export const ELEVATOR_PER_FLOOR = 5;
/** Auto takes the elevator for this many floors or more (PRD UC3), and the stairs below it. */
export const AUTO_ELEVATOR_FLOORS = 3;
