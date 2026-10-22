// The only place the app fetches its own data (ARCHITECTURE §6). Every file is checked twice before use: the
// response must really be JSON, then the JSON must match its Zod schema. A failure is returned, never thrown, with a
// reason the screen can act on, so the app never shows a half-loaded map (user-flows §4).
import { campusSchema, type Campus } from './campus';
import { indoorSchema, slugSchema, type Indoor } from './indoor';
import { roomsSchema, type Rooms } from './rooms';
import type { z } from './zod';

/** Why a file couldn't be used. `offline`: the request never got an answer. `http`: an error status. `not-json`:
 *  something else came back, like the hosting's index.html fallback for a missing file. `invalid`: broken or
 *  wrong-shaped JSON. */
export type LoadFailure = 'offline' | 'http' | 'not-json' | 'invalid';

export type LoadResult<T> = { ok: true; data: T } | { ok: false; reason: LoadFailure };

type Fetch = (input: RequestInfo | URL) => Promise<Response>;

// Cloudflare's single-page-app fallback answers any missing path with index.html and status 200, even for a JSON
// request (PROJECT_FACTS, Cloudflare), so `res.ok` alone would let the HTML page through.
// Media types are case-insensitive, so `Application/JSON` counts.
const isJson = (res: Response) =>
  res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json';

async function loadJson<T>(path: string, schema: z.ZodType<T>, fetchImpl: Fetch): Promise<LoadResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(path);
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!res.ok) return { ok: false, reason: 'http' };
  if (!isJson(res)) return { ok: false, reason: 'not-json' };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: 'invalid' };
}

/**
 * The first good load, shared: search (3c) and the map both need campus.json and rooms.json, and each would otherwise
 * fetch and validate its own copy. A failure isn't kept, so the next call tries again. A test passes its own fetch
 * and always gets a fresh load.
 */
function once<T>(load: (fetchImpl: Fetch) => Promise<LoadResult<T>>) {
  let shared: Promise<LoadResult<T>> | undefined;
  return (fetchImpl?: Fetch): Promise<LoadResult<T>> => {
    if (fetchImpl) return load(fetchImpl);
    shared ??= load((input) => fetch(input)).then((result) => {
      if (!result.ok) shared = undefined;
      return result;
    });
    return shared;
  };
}

/** Loads and validates `public/data/campus.json`, written by the data compiler (2b). */
export const loadCampus = once((fetchImpl): Promise<LoadResult<Campus>> =>
  // BASE_URL keeps the path right if the app is ever served from a subfolder; a wrong path would read as not-json.
  loadJson(`${import.meta.env.BASE_URL}data/campus.json`, campusSchema, fetchImpl),
);

function fetchIndoor(slug: string, fetchImpl: Fetch): Promise<LoadResult<Indoor>> {
  const schema = indoorSchema.refine((b) => b.building === slug, 'file is for another building');
  return loadJson(`${import.meta.env.BASE_URL}data/buildings/${slug}.json`, schema, fetchImpl);
}

// One shared load per building, and the data of the ones that came back good, for `peekIndoor`.
const sharedIndoor = new Map<string, Promise<LoadResult<Indoor>>>();
const settledIndoor = new Map<string, Indoor>();

/** Loads and validates one building's floors, `public/data/buildings/<slug>.json`, written by the data compiler (6b).
 *  A slug that couldn't be a building is `invalid` without a request, and so is a file for another building. Like
 *  `once`, the first good load is shared and a failure isn't kept; a test passes its own fetch and gets a fresh load. */
export function loadIndoor(slug: string, fetchImpl?: Fetch): Promise<LoadResult<Indoor>> {
  if (!slugSchema.safeParse(slug).success) return Promise.resolve({ ok: false, reason: 'invalid' });
  if (fetchImpl) return fetchIndoor(slug, fetchImpl);
  let shared = sharedIndoor.get(slug);
  if (!shared) {
    shared = fetchIndoor(slug, (input) => fetch(input)).then((result) => {
      if (result.ok) settledIndoor.set(slug, result.data);
      else sharedIndoor.delete(slug);
      return result;
    });
    sharedIndoor.set(slug, shared);
  }
  return shared;
}

/** A building's floors if its shared load has already come back good, else undefined. Lets a screen draw on the same
 *  render instead of showing a loading frame. */
export function peekIndoor(slug: string): Indoor | undefined {
  return settledIndoor.get(slug);
}

/** Starts the shared load of each building so its floors are ready before anyone steps there. Fire and forget. */
export function preloadIndoor(slugs: Iterable<string>): void {
  for (const slug of slugs) void loadIndoor(slug);
}

/** Loads and validates `public/data/rooms.json`, written by the data compiler (3b). */
export const loadRooms = once((fetchImpl): Promise<LoadResult<Rooms>> =>
  loadJson(`${import.meta.env.BASE_URL}data/rooms.json`, roomsSchema, fetchImpl),
);
