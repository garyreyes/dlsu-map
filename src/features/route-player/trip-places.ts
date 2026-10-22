// The places a trip needs worked out before routing: which buildings' floor files to load (D41), so the rest are
// never fetched, and where the "you are here" dot goes. Pure: no React, no fetch.
import type { Campus } from '@/shared/data/campus';
import type { From, To, XY } from '@/shared/data/route';
import type { Room } from '@/shared/data/rooms';

type RoomList = { readonly rooms: readonly Pick<Room, 'code' | 'building' | 'floor'>[] };

/** Where the student is, for the map: a building's floor, or a point on the ground (a gate). */
export type Here =
  | { readonly kind: 'floor'; readonly building: string; readonly floor: number }
  | { readonly kind: 'ground'; readonly at: XY };

/** From as a place on the map, or null when its room or gate isn't in the data. */
export function hereOf(
  from: From,
  rooms: RoomList,
  campus: {
    readonly walk: Pick<Campus['walk'], 'points'>;
    readonly gates: readonly Pick<Campus['gates'][number], 'id' | 'point'>[];
  },
): Here | null {
  switch (from.kind) {
    case 'building':
      return { kind: 'floor', building: from.building, floor: from.floor };
    case 'room': {
      const room = rooms.rooms.find((r) => r.code === from.code);
      return room ? { kind: 'floor', building: room.building, floor: room.floor } : null;
    }
    case 'gate': {
      const gate = campus.gates.find((g) => g.id === from.gate);
      const [x, y] = gate ? [campus.walk.points[gate.point * 2], campus.walk.points[gate.point * 2 + 1]] : [];
      return x === undefined || y === undefined ? null : { kind: 'ground', at: [x, y] };
    }
  }
}

/**
 * The slugs to load for a trip, From's first, each once. A room needs its building's file at either end. A building
 * tapped on an upper floor starts at its elevator lobby, so it needs its file too; on G it starts at the main
 * entrance and doesn't. A gate, or a building as To (it ends at the door), needs none. A code that isn't in the
 * room list needs none: the router answers `unknown-place` without it.
 */
export function tripBuildings(from: From, to: To, rooms: RoomList): string[] {
  const buildingOf = (code: string) => rooms.rooms.find((r) => r.code === code)?.building;
  const fromSlug =
    from.kind === 'room'
      ? buildingOf(from.code)
      : from.kind === 'building' && from.floor > 1
        ? from.building
        : undefined;
  const toSlug = to.kind === 'room' ? buildingOf(to.code) : undefined;
  return [...new Set([fromSlug, toSlug].filter((s) => s !== undefined))];
}
