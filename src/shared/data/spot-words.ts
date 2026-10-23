// How a door or a stairs is named on screen (8c-2): S4's spot chips, S5's door chips and the From chip. The same words
// as the steps (routing/directions.ts), so one place has one name. Pure. Tests: spot-words.test.ts.
import type { Entrance } from './campus.ts';

/** A building file's stairs or elevator id, as the steps say it: `east-stairs` → `east stairs`. */
export const verticalWords = (id: string): string => id.split('-').join(' ');

/** `main entrance facing Agno`, or `main entrance` when the building has one door of that kind (D48). */
export const doorWords = (door: Pick<Entrance, 'kind' | 'name'>): string =>
  `${door.kind} entrance${door.name === undefined ? '' : ` ${door.name}`}`;
