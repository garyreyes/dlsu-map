// Base and top of an extruded block from its OSM tags (Simple 3D Buildings). Pure. Tests: heights.test.ts.
import type { Tags } from '../osm-to-geojson.ts';

/** Meters per storey, as the prototype used. */
export const LEVEL_HEIGHT = 3.4;
/** A building OSM gives no height for: about 2–3 storeys, as the prototype drew Manila's low-rise blocks. */
export const DEFAULT_TOP = 9;

/** The four tags the height rules read, each with what counts as readable. */
const HEIGHT_TAGS = {
  height: /^(\d+(?:\.\d+)?)\s*(?:m)?$/, // meters, optionally "m"
  min_height: /^(\d+(?:\.\d+)?)\s*(?:m)?$/,
  'building:levels': /^(\d+)$/, // whole storeys
  'building:min_level': /^(\d+)$/,
} as const;
type HeightTag = keyof typeof HEIGHT_TAGS;

/** The tag's number, or undefined when it is missing or unreadable (unreadHeightTags reports the second case). */
function read(tags: Tags, key: HeightTag): number | undefined {
  const match = tags[key]?.trim().match(HEIGHT_TAGS[key]);
  return match ? Number(match[1]) : undefined;
}

const fix = (n: number): number => Math.round(n * 100) / 100; // 13.600000000000001 → 13.6

/** `{ base, top }` in meters above the ground, or null when the tags put the base at or above the top. */
export function heightOf(tags: Tags): { base: number; top: number } | null {
  const levels = read(tags, 'building:levels');
  const minLevel = read(tags, 'building:min_level');
  const top = read(tags, 'height') ?? (levels !== undefined ? levels * LEVEL_HEIGHT : DEFAULT_TOP);
  const base = read(tags, 'min_height') ?? (minLevel !== undefined ? minLevel * LEVEL_HEIGHT : 0);
  return base < top ? { base: fix(base), top: fix(top) } : null;
}

/** Height tags that are present but unreadable, as `key="value"`: heightOf treats them as missing, which guesses. */
export function unreadHeightTags(tags: Tags): string[] {
  return (Object.keys(HEIGHT_TAGS) as HeightTag[])
    .filter((key) => tags[key] !== undefined && read(tags, key) === undefined)
    .map((key) => `${key}="${tags[key] ?? ''}"`);
}

/** The level count a building's floor chips show, or undefined if OSM has none. */
export function levelsOf(tags: Tags): number | undefined {
  const levels = read(tags, 'building:levels');
  return levels !== undefined && levels > 0 ? levels : undefined;
}
