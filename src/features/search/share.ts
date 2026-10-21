// What Share sends (3d, user-flows §3.4): the app's address with only the destination, never From (PRD §6), and the
// card's line as the title. Pure. Tests: deep-link.test.ts, which also checks a shared link opens the same room.
import type { RoomHit } from './search-index';

/** `https://…/?to=ST311`. `origin` is the page's own, so a beta or preview link shares itself. */
export function shareLink(origin: string, code: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('to', code);
  return url.href;
}

/** `ST311 · Surface Physics Lab · STRC 3F`. */
export function shareTitle(room: RoomHit): string {
  return `${room.code} · ${room.name} · ${room.building.short} ${room.floorLabel}`;
}
