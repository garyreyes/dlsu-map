// The directions (4c, D35): a walk's points and the floors legs turned into steps, one line of text each. A step is
// where the student has a choice: a turn at a junction, a crossing, a door, a floor change. Pure: no React, no fetch.
import type { CampusBuilding, Walk } from '@/shared/data/campus';
import type { Step, WalkEnd, XY } from '@/shared/data/route';
import type { FloorsLeg } from './floors.ts';
import {
  bend,
  distanceToOutline,
  heading,
  LANDMARK_METERS,
  MERGE_METERS,
  shownMeters,
  turnOf,
  turnWords,
  WOBBLE_DEGREES,
} from './turns.ts';
import type { WalkGraph } from './walk-graph.ts';

export type DirectionsBuilding = Pick<CampusBuilding, 'slug' | 'short' | 'floorLabels' | 'volumes'>;
type Way = Walk['ways'][number];
type Door = Extract<WalkEnd, { kind: 'door' }>;

export interface Directions {
  /** Steps for a walk over these walk points (start to target), which is leg `leg` of the route. */
  walk(points: readonly number[], from: WalkEnd, to: Door, leg: number): Step[];
  /** The step for a floors leg. `room` is the To room when this is the route's last leg: "ST311 is on 3F: …". */
  floors(leg: FloorsLeg, index: number, room?: string): Step;
}

/** One link of the walk, in walking order. */
interface Link {
  readonly way: Way;
  readonly heading: number;
}
/** A step found along the walk, before its distance to the next one is known. */
interface Mark {
  /** Which walk point it's at. */
  readonly index: number;
  readonly make: (meters: number) => Step;
}
interface Context {
  readonly g: WalkGraph;
  readonly ways: Walk['ways'];
  /** How many other points each point links to: 3 or more is a junction. */
  readonly degree: readonly number[];
  readonly buildings: readonly DirectionsBuilding[];
}

export function createDirections(walk: Walk, g: WalkGraph, buildings: readonly DirectionsBuilding[]): Directions {
  const ctx: Context = { g, ways: walk.ways, degree: degrees(walk), buildings };
  const bySlug = new Map(buildings.map((b) => [b.slug, b]));
  const short = (slug: string): string => bySlug.get(slug)?.short ?? slug;
  const label = (slug: string, floor: number): string =>
    bySlug.get(slug)?.floorLabels?.[String(floor)] ?? `${String(floor)}F`;
  return {
    walk: (points, from, to, leg) => walkSteps(ctx, short, { points, from, to, leg }),
    floors: (l, index, room) => {
      const to = label(l.building, l.to);
      // On labelled floors (8b) it names which one: `east-stairs` is "the east stairs".
      const what = l.via === undefined ? l.by : l.via.split('-').join(' ');
      const how = `take the ${what} ${l.to > l.from ? 'up' : 'down'} to ${to}`;
      const text = room === undefined ? how.charAt(0).toUpperCase() + how.slice(1) : `${room} is on ${to}: ${how}`;
      return { kind: 'floors', leg: index, building: l.building, to: l.to, by: l.by, text };
    },
  };
}

function degrees(walk: Walk): number[] {
  const near = Array.from({ length: walk.points.length / 2 }, () => new Set<number>());
  for (const [a, b] of walk.links) {
    near[a]?.add(b);
    near[b]?.add(a);
  }
  return near.map((s) => s.size);
}

interface Trip {
  readonly points: readonly number[];
  readonly from: WalkEnd;
  readonly to: Door;
  readonly leg: number;
}

function walkSteps(ctx: Context, short: (slug: string) => string, trip: Trip): Step[] {
  const { points, from, to, leg } = trip;
  const xy = points.map((p) => ctx.g.at(p));
  const links: Link[] = [];
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    const cost = ctx.g.link(points[i - 1] ?? -1, points[i] ?? -1);
    links.push({ way: ctx.ways[cost?.way ?? -1] ?? { kind: 'path' }, heading: heading(at(xy, i - 1), at(xy, i)) });
    along.push((along[i - 1] ?? 0) + (cost?.meters ?? 0));
  }
  const marks: Mark[] = [startMark(from, leg, short), ...middleMarks(ctx, { points, xy, links, along, leg })];
  const end = points.length - 1;
  const steps = marks.map((m, k) =>
    m.make(shownMeters((along[marks[k + 1]?.index ?? end] ?? 0) - (along[m.index] ?? 0))),
  );
  const sure = to.verified ? {} : { approximate: true as const };
  const text = approximately(`Enter ${short(to.building)} by ${doorWords(to)}`, to.verified);
  return [...steps, { kind: 'enter', leg, building: to.building, at: to.at, ...sure, text }];
}

const at = (xy: readonly XY[], i: number): XY => xy[i] ?? [Number.NaN, Number.NaN];
export const doorWords = (d: Door): string => `the ${d.door} entrance${d.name === undefined ? '' : ` ${d.name}`}`;
const approximately = (text: string, verified: boolean): string => (verified ? text : `${text} (approximate)`);

function startMark(from: WalkEnd, leg: number, short: (slug: string) => string): Mark {
  if (from.kind === 'gate') {
    return { index: 0, make: (meters) => ({ kind: 'start', leg, at: from.at, meters, text: `Start at ${from.name}` }) };
  }
  const text = approximately(`Leave ${short(from.building)} by ${doorWords(from)}`, from.verified);
  const sure = from.verified ? {} : { approximate: true as const };
  return { index: 0, make: (meters) => ({ kind: 'start', leg, at: from.at, meters, ...sure, text }) };
}

interface Walked {
  readonly points: readonly number[];
  readonly xy: readonly XY[];
  readonly links: readonly Link[];
  /** Meters from the start to each point. */
  readonly along: readonly number[];
  readonly leg: number;
}

/** Crossings and turns, in walking order. Bends under 15 m apart are one turn (D35), chained: each within 15 m of the
 *  one before. A crossing ends a turn. The bend onto the last link into a door is left to the enter step. */
function middleMarks(ctx: Context, w: Walked): Mark[] {
  const marks: Mark[] = [];
  let group: { first: number; last: number } | null = null;
  const flush = () => {
    const mark = group === null ? null : turnMark(ctx, w, group.first, group.last);
    if (mark !== null) marks.push(mark);
    group = null;
  };
  w.links.forEach((link, i) => {
    const before = w.links[i - 1];
    const crossing = link.way.kind === 'crossing';
    // One step per street: a crosswalk drawn in pieces is one run, but a corner crossing two streets is two.
    if (crossing && (before?.way.kind !== 'crossing' || before.way.name !== link.way.name)) {
      flush();
      marks.push(crossMark(w, i, link.way.name));
    }
    const intoDoor = i === w.links.length - 1 && link.way.kind === 'door';
    if (crossing || intoDoor || before === undefined) return;
    if (Math.abs(bend(before.heading, link.heading)) < WOBBLE_DEGREES) return;
    if (group !== null && (w.along[i] ?? 0) - (w.along[group.last] ?? 0) < MERGE_METERS) group.last = i;
    else {
      flush();
      group = { first: i, last: i };
    }
  });
  flush();
  return marks;
}

function crossMark(w: Walked, index: number, name: string | undefined): Mark {
  const street = name ?? 'the street';
  const text = `Cross ${street} at the crosswalk`;
  return { index, make: (meters) => ({ kind: 'cross', leg: w.leg, at: at(w.xy, index), meters, street, text }) };
}

/** The turn made over the bends at points first..last, at its first junction, or null if it's no step. */
function turnMark(ctx: Context, w: Walked, first: number, last: number): Mark | null {
  const into = w.links[first - 1];
  const out = w.links[last];
  if (into === undefined || out === undefined) return null;
  const turn = turnOf(bend(into.heading, out.heading));
  if (turn === null) return null;
  let index = first;
  while (index <= last && (ctx.degree[w.points[index] ?? -1] ?? 0) < 3) index++;
  if (index > last) return null;
  const where = at(w.xy, index);
  const text = turnWords(turn) + landmark(ctx, out.way, where);
  return { index, make: (meters) => ({ kind: 'turn', leg: w.leg, at: where, meters, turn, text }) };
}

/** D35's order: the way's name, else the covered walk, else a building within 20 m, else nothing. */
function landmark(ctx: Context, way: Way, where: XY): string {
  if (way.name !== undefined) return way.kind === 'sidewalk' ? ` onto the ${way.name} sidewalk` : ` onto ${way.name}`;
  if (way.covered === true) return ' onto the covered walk';
  let best: { short: string; meters: number } | null = null;
  for (const b of ctx.buildings) {
    const meters = Math.min(...b.volumes.map((v) => distanceToOutline(where, v.outline)));
    if (meters <= LANDMARK_METERS && (best === null || meters < best.meters)) best = { short: b.short, meters };
  }
  return best === null ? '' : ` at ${best.short}`;
}
