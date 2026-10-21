// The dev-only link (5c): `?from=…&to=…` opens the all-steps list for any route, before Where are you (5a) and the
// route preview (5b) exist. Only shape is checked here; the router says whether the places are real. Pure.
import type { From, To } from '@/shared/data/route';

export interface DevTrip {
  readonly from: From;
  readonly to: To;
}

/** A gate id or building slug: `gate-1`, `agno`, `strc`. */
const SLUG = /^[a-z][a-z0-9-]*$/;
/** A canonical room code: `ST311`, `AG1104`, `ST315A`. */
const ROOM = /^[A-Z]+\d+[A-Z]?$/;
/** A building and floor, G = 1: `strc@3`. */
const SPOT = /^([a-z][a-z0-9-]*)@([1-9]\d*)$/;

/**
 * `from`: a gate (`gate-1`), a building spot (`strc@3`) or a room (`AG1104`). `to`: a room (`ST311`) or a building
 * (`strc`). Null unless both are there and well formed.
 */
export function parseDevLink(search: string): DevTrip | null {
  const params = new URLSearchParams(search);
  const from = readFrom(params.get('from') ?? '');
  const to = readTo(params.get('to') ?? '');
  return from === null || to === null ? null : { from, to };
}

function readFrom(value: string): From | null {
  const spot = SPOT.exec(value);
  if (spot?.[1] !== undefined && spot[2] !== undefined) {
    return { kind: 'building', building: spot[1], floor: Number(spot[2]) };
  }
  if (ROOM.test(value)) return { kind: 'room', code: value };
  return SLUG.test(value) ? { kind: 'gate', gate: value } : null;
}

function readTo(value: string): To | null {
  if (ROOM.test(value)) return { kind: 'room', code: value };
  return SLUG.test(value) ? { kind: 'building', building: value } : null;
}
