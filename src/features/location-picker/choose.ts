// How each choice in Where are you (S4) becomes From (user-flows §3.5, D23). Pure: no React, no fetch. Strict like To
// (PRD §7): only a room the student picked or typed exactly, never a suggestion or a guessed floor.
// Tests: choose.test.ts.
import type { Hit, SearchView } from '@/features/search';
import type { From, To } from '@/shared/data/route';

export type Choice =
  /** From is set. */
  | { readonly kind: 'from'; readonly from: From }
  /** The room the student is going to: "You're already at ST311." */
  | { readonly kind: 'same'; readonly code: string }
  /** A building: its floors come next. */
  | { readonly kind: 'floors'; readonly building: string };

/** G is floor 1 and starts at the main entrance; other floors at the elevator lobby (PRD UC2). */
export const atFloor = (building: string, floor: number): From => ({ kind: 'building', building, floor });

export const atGate = (gate: string): From => ({ kind: 'gate', gate });

/** "I'm outside, next to a building": its main entrance, which is where its ground floor starts. */
export const nextTo = (building: string): From => atFloor(building, 1);

/** A result row tapped in the code box. */
export function chooseHit(hit: Hit, to: To | null): Choice {
  if (hit.kind === 'building') return { kind: 'floors', building: hit.building.slug };
  if (to?.kind === 'room' && to.code === hit.code) return { kind: 'same', code: hit.code };
  return { kind: 'from', from: { kind: 'room', code: hit.code } };
}

/** The keyboard's Enter: only an exact room or building, as Go in search (D38). Null while rooms load. */
export function chooseEnter(view: SearchView | null, to: To | null): Choice | null {
  return view?.exact ? chooseHit(view.exact, to) : null;
}
