// 8b: a path through one building (indoor-graph.ts) as legs and steps (D41). One indoor leg per floor walked, a
// floors leg for each climb; steps where the student has a choice, as outdoors (D35): turns at junctions, named by a
// room door within 5 m, then the climb, then the side of the hallway the room is on. Pure: no React, no fetch.
import { ELEVATOR_PER_FLOOR, ELEVATOR_WAIT, STAIRS_PER_FLOOR, WALK_SPEED } from '@/shared/config/routing';
import type { Vertical } from '@/shared/data/indoor';
import type { Leg, Step, XY } from '@/shared/data/route';
import type { Directions } from './directions.ts';
import type { IndoorModel } from './indoor-graph.ts';
import { bend, heading, MERGE_METERS, shownMeters, turnOf, turnWords, WOBBLE_DEGREES } from './turns.ts';

/** A room door this close to a turn names it (D41). */
export const ROOM_METERS = 5;

/** Legs and steps inside one building, placed among the route's legs once their position is known. */
export interface Chunk {
  readonly legs: readonly Leg[];
  /** The steps, given the index in the route of the chunk's first leg. */
  steps(first: number): Step[];
  /** Meters from where the chunk starts to its first step: the walk inside after an enter step. */
  readonly lead: number;
}

export interface ChunkOptions {
  readonly building: string;
  /** Elevator was asked for, but the building has none. */
  readonly noElevator: boolean;
  /** Set when the route starts here: what the start step calls the place, "AL101", "the elevator". */
  readonly start?: string;
  /** Set when the route ends at this room's door. */
  readonly room?: string;
  /** Rooms a turn is never named after: the trip's own. */
  readonly skip: readonly string[];
}

type Segment =
  | { readonly kind: 'walk'; readonly points: readonly number[] }
  | { kind: 'climb'; readonly vertical: Vertical; readonly at: number; readonly from: number; to: number };

/** A step found along the chunk, before its distance to the next is known. */
interface Mark {
  /** Meters walked from the chunk's start. */
  readonly along: number;
  /** Which step needs no distance: the arrival. */
  readonly last?: true;
  readonly make: (meters: number, first: number) => Step;
}

/** The legs and steps for a path through the building. `directions` words the climbs, as outdoors. */
export function indoorChunk(
  model: IndoorModel,
  points: readonly number[],
  opts: ChunkOptions,
  directions: Directions,
): Chunk {
  const segments = segmentsOf(model, points);
  const legs = segments.map((s) => legOf(model, s, opts));
  const { marks, total } = marksOf(model, segments, legs, opts, directions);
  return {
    legs,
    lead: marks[0]?.along ?? total,
    steps: (first) =>
      marks.map((m, k) => m.make(m.last ? 0 : shownMeters((marks[k + 1]?.along ?? total) - m.along), first)),
  };
}

/** The path cut at each change of floor. A climb through floors it doesn't stop on is one climb. */
function segmentsOf(model: IndoorModel, points: readonly number[]): Segment[] {
  const segments: Segment[] = [];
  let run: number[] = [];
  for (const p of points) {
    const prev = run.at(-1);
    if (prev === undefined || model.floor(p) === model.floor(prev)) {
      run.push(p);
      continue;
    }
    const vertical = model.vertical(prev);
    const last = segments.at(-1);
    if (run.length === 1 && last?.kind === 'climb' && last.vertical === vertical) last.to = model.floor(p);
    else {
      if (run.length > 1) segments.push({ kind: 'walk', points: run });
      if (vertical === undefined) throw new Error(`point ${String(prev)} changes floor but is no stop`);
      segments.push({ kind: 'climb', vertical, at: prev, from: model.floor(prev), to: model.floor(p) });
    }
    run = [p];
  }
  if (run.length > 1) segments.push({ kind: 'walk', points: run });
  return segments;
}

const metersOf = (model: IndoorModel, points: readonly number[]): number =>
  points.slice(1).reduce((m, p, i) => m + distance(model.at(points[i] ?? p), model.at(p)), 0);
const distance = ([ax, ay]: XY, [bx, by]: XY): number => Math.hypot(bx - ax, by - ay);

function legOf(model: IndoorModel, s: Segment, opts: ChunkOptions): Leg {
  if (s.kind === 'walk') {
    const meters = metersOf(model, s.points);
    const path = s.points.map((p) => model.at(p));
    return {
      kind: 'indoor',
      building: opts.building,
      floor: model.floor(s.points[0] ?? 0),
      path,
      meters,
      seconds: meters / WALK_SPEED,
    };
  }
  const floors = Math.abs(s.to - s.from);
  const by = s.vertical.kind;
  const seconds = by === 'elevator' ? ELEVATOR_WAIT + ELEVATOR_PER_FLOOR * floors : STAIRS_PER_FLOOR * floors;
  const leg = { kind: 'floors', building: opts.building, from: s.from, to: s.to, by, seconds } as const;
  return { ...leg, ...(opts.noElevator ? { noElevator: true } : {}), via: s.vertical.id, at: model.at(s.at) };
}

function marksOf(
  model: IndoorModel,
  segments: readonly Segment[],
  legs: readonly Leg[],
  opts: ChunkOptions,
  directions: Directions,
): { marks: Mark[]; total: number } {
  const marks: Mark[] = [];
  let along = 0;
  const lastClimb = segments.findLastIndex((s) => s.kind === 'climb');
  segments.forEach((s, i) => {
    if (s.kind === 'climb') {
      const leg = legs[i];
      // The climb to the room's floor says which floor that is: "AL205 is on 2F: take the west stairs up to 2F".
      const room = i === lastClimb ? opts.room : undefined;
      const at = model.at(s.at);
      if (leg?.kind === 'floors') {
        marks.push({ along, make: (meters, first) => ({ ...directions.floors(leg, first + i, room), at, meters }) });
      }
      return;
    }
    if (i === 0 && opts.start !== undefined) marks.push(startMark(model, s.points, opts.start));
    marks.push(...turnMarks(model, s.points, i, along, opts.skip));
    along += metersOf(model, s.points);
  });
  const last = segments.at(-1);
  if (opts.room !== undefined && last?.kind === 'walk')
    marks.push(arriveMark(model, last.points, segments.length - 1, along, opts.room));
  return { marks, total: along };
}

function startMark(model: IndoorModel, points: readonly number[], name: string): Mark {
  const at = model.at(points[0] ?? 0);
  return { along: 0, make: (meters, first) => ({ kind: 'start', leg: first, at, meters, text: `Start at ${name}` }) };
}

/** Turns along one floor's walk (D35's rules): never at its first point, nor onto its last link, which leads into a
 *  door, a stairs or an entrance and is the next step's business. */
function turnMarks(
  model: IndoorModel,
  points: readonly number[],
  leg: number,
  start: number,
  skip: readonly string[],
): Mark[] {
  const xy = points.map((p) => model.at(p));
  const headings = xy.slice(1).map((b, i) => heading(xy[i] ?? b, b));
  const along = [0];
  for (let i = 1; i < xy.length; i++) along.push((along[i - 1] ?? 0) + distance(xy[i - 1] ?? [0, 0], xy[i] ?? [0, 0]));
  const groups: { first: number; last: number }[] = [];
  headings.forEach((h, i) => {
    if (i === 0 || i === headings.length - 1) return;
    if (Math.abs(bend(headings[i - 1] ?? h, h)) < WOBBLE_DEGREES) return;
    const group = groups.at(-1);
    if (group !== undefined && (along[i] ?? 0) - (along[group.last] ?? 0) < MERGE_METERS) group.last = i;
    else groups.push({ first: i, last: i });
  });
  return groups.flatMap(({ first, last }): Mark[] => {
    const turn = turnOf(bend(headings[first - 1] ?? 0, headings[last] ?? 0));
    const index = points.findIndex((p, i) => i >= first && i <= last && model.degree(p) >= 3);
    if (turn === null || index < 0) return [];
    const at = xy[index] ?? [0, 0];
    const name = roomNear(model, points[index] ?? 0, skip);
    const text = turnWords(turn) + (name === undefined ? '' : ` at ${name}`);
    return [
      {
        along: start + (along[index] ?? 0),
        make: (meters, f) => ({ kind: 'turn', leg: f + leg, at, meters, turn, text }),
      },
    ];
  });
}

/** The room whose door is nearest the point on its floor, within ROOM_METERS; the first listed on a tie. */
function roomNear(model: IndoorModel, point: number, skip: readonly string[]): string | undefined {
  const here = model.at(point);
  const floor = model.floor(point);
  let best: { code: string; meters: number } | undefined;
  for (const room of model.file.rooms) {
    if (room.floor !== floor || skip.includes(room.code)) continue;
    const meters = Math.min(...room.doors.map((d) => distance(here, model.at(d))));
    if (meters <= ROOM_METERS && (best === undefined || meters < best.meters)) best = { code: room.code, meters };
  }
  return best?.code;
}

/** "AL101 is on your left": from the way the student walks up to the hallway point by the door, and the turn into it. */
function arriveMark(model: IndoorModel, points: readonly number[], leg: number, along: number, code: string): Mark {
  const [before, by, door] = points.slice(-3).map((p) => model.at(p));
  const at = model.at(points.at(-1) ?? 0);
  const degrees =
    door === undefined || by === undefined || before === undefined ? 0 : bend(heading(before, by), heading(by, door));
  const side = Math.abs(degrees) < 30 ? 'ahead' : degrees > 0 ? 'left' : 'right';
  const text = side === 'ahead' ? `${code} is ahead` : `${code} is on your ${side}`;
  return { along, last: true, make: (_meters, first) => ({ kind: 'arrive', leg: first + leg, code, side, at, text }) };
}
