// Floor files → public/data/buildings/<slug>.json (D36, 6b). Each floor is fitted onto the outline of the building
// volume it sits in, so a tower floor goes on the tower; then its rooms, stairs and elevators join the indoor graph
// (8a, indoor-links.ts). Pure. Tests: indoor.test.ts.
import type { CampusBuilding } from '../../src/shared/data/campus.ts';
import type { FloorSource, VerticalSource } from '../../src/shared/data/floor-source.ts';
import { indoorSchema, type Indoor, type IndoorFloor } from '../../src/shared/data/indoor.ts';
import { fitFrame, fitPoint, outlineGap, type Frame } from './fit.ts';
import { ringArea, round, type Point } from './geometry.ts';
import { linkBuilding, type LabelledFloor } from './indoor-links.ts';

/** One floor file as read, with its path for error messages: `data-src/floors/strc/03.json`. */
export interface FloorFile {
  readonly path: string;
  readonly floor: FloorSource;
}

/** What the floors are labelled against (8a). Each entrance's index in `entrances` is its index in campus.json. */
export interface IndoorInputs {
  readonly rooms: readonly { code: string; building: string; floor: number }[];
  readonly verticals: readonly { path: string; building: string; list: readonly VerticalSource[] }[];
  readonly entrances: readonly { building: string; kind: 'main' | 'side' | 'back'; point: Point }[];
}

const NO_INPUTS: IndoorInputs = { rooms: [], verticals: [], entrances: [] };

export interface IndoorResult {
  /** Empty whenever there are errors: nothing broken is ever written. */
  readonly buildings: Indoor[];
  readonly errors: string[];
  readonly notes: string[];
}

/** Above this, most of the outline has no wall near it: the corners were read wrong or the turn is. Spike: 0.6–1.2 m
 *  (PROJECT_FACTS). */
const GAP_CHECK = 1.5;
/** Slack when comparing heights that come from sums of storeys. */
const EPSILON = 0.01;

const pairs = (flat: readonly number[]): Point[] =>
  Array.from({ length: flat.length / 2 }, (_, i): Point => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);

/** What is wrong with a file's place on disk or its building, or null. */
function misplaced({ path, floor: f }: FloorFile, building: CampusBuilding | undefined): string | null {
  const [, folder, name] = /floors\/([^/]+)\/([^/]+)$/.exec(path) ?? [];
  if (folder !== f.building) return `${path}: says building ${f.building}, but sits in floors/${folder ?? '?'}/`;
  const expected = `${String(f.floor).padStart(2, '0')}.json`;
  if (name !== expected) return `${path}: says floor ${String(f.floor)}, but is named ${name ?? '?'}`;
  if (!building) return `${path}: ${f.building} is not a building in campus.json`;
  if (f.floor > building.levels) {
    return `${path}: ${f.building} has ${String(building.levels)} floors, not ${String(f.floor)}`;
  }
  return null;
}

/** The outline of the volume the floor's slab sits in; the largest when several do (an outline and its parts). */
function outlineAt(building: CampusBuilding, base: number): Point[] | null {
  const holding = building.volumes.filter((v) => v.base <= base + EPSILON && v.top > base + EPSILON);
  const rings = holding.map((v) => pairs(v.outline)).sort((a, b) => ringArea(b) - ringArea(a));
  return rings[0] ?? null;
}

/** Meters per storey: the top of the building's own outline (its first volume) over OSM's level count, which is that
 *  outline's. A part rising past it, like a stair tower or roof deck (Connon, LS, Yuchengco), would otherwise
 *  stretch every storey. */
const storeyHeight = (building: CampusBuilding): number => (building.volumes[0]?.top ?? 0) / building.levels;

const fitLine = (frame: Frame, line: readonly number[]): number[] =>
  pairs(line).flatMap(([x, y]) => fitPoint(frame, x, y).map(round));

interface Fitted {
  readonly floor: IndoorFloor;
  readonly labelled: LabelledFloor;
}

/** The floor's rooms and verticals in meters, with its fitted hallways. */
function labelsOf(path: string, f: FloorSource, frame: Frame, hallways: readonly number[][]): LabelledFloor {
  const at = ([x, y]: readonly [number, number]): Point => fitPoint(frame, x, y);
  return {
    path,
    floor: f.floor,
    hallways: hallways.map(pairs),
    ...(f.rooms && { rooms: f.rooms.map((r) => ({ codes: r.codes, label: at(r.label), doors: r.doors.map(at) })) }),
    ...(f.verticals && { verticals: f.verticals.map((v) => ({ id: v.id, point: at(v.point) })) }),
  };
}

function fitFloor(file: FloorFile, building: CampusBuilding, notes: string[]): Fitted | string {
  const f = file.floor;
  if (f.walls.length === 0) return `${file.path}: has no walls`;
  const height = storeyHeight(building);
  const base = (f.floor - 1) * height;
  const ring = outlineAt(building, base);
  if (!ring) return `${file.path}: no part of ${f.building} stands at floor ${String(f.floor)}`;
  const frame = fitFrame(ring, f.plan, f.fit.turn);
  const walls = f.walls.map((w) => fitLine(frame, w));
  const gap = outlineGap(ring, walls.map(pairs));
  const far = gap.p90 > GAP_CHECK;
  const sits = `sits ${String(round(gap.median))} m from its outline (90%: ${String(round(gap.p90))} m)`;
  // Checked means the owner saw it right in the preview: a gap now means the outline moved under it.
  if (far && f.checked) return `${file.path}: checked, but ${sits}: check its corners and turn`;
  notes.push(`floors: ${f.building} ${String(f.floor)} ${sits}${far ? ': check its corners and turn' : ''}`);
  const hallways = f.hallways.map((h) => fitLine(frame, h));
  const floor = { floor: f.floor, base: round(base), height: round(height), checked: f.checked, walls, hallways };
  return { floor, labelled: labelsOf(file.path, f, frame, hallways) };
}

/** One building's file: its floors, and its rooms, verticals and entrances on the indoor graph. */
function assemble(
  building: CampusBuilding,
  fitted: readonly Fitted[],
  inputs: IndoorInputs,
  result: IndoorResult,
): Indoor {
  const verticals = inputs.verticals.find((v) => v.building === building.slug);
  const linked = linkBuilding({
    slug: building.slug,
    levels: building.levels,
    floors: fitted.map((f) => f.labelled),
    verticals: verticals ?? { path: `data-src/floors/${building.slug}/verticals.json`, list: [] },
    rooms: inputs.rooms.filter((r) => r.building === building.slug),
    entrances: inputs.entrances.flatMap((e, index) => (e.building === building.slug ? [{ ...e, index }] : [])),
  });
  result.errors.push(...linked.errors);
  result.notes.push(...linked.notes);
  const { graph, rooms, verticals: vs, entrances } = linked;
  return { building: building.slug, floors: fitted.map((f) => f.floor), graph, rooms, verticals: vs, entrances };
}

/** Every floor file fitted and grouped by building, buildings by slug and floors lowest first. */
export function compileIndoor(
  files: readonly FloorFile[],
  buildings: readonly CampusBuilding[],
  inputs: IndoorInputs = NO_INPUTS,
): IndoorResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const bySlug = new Map(buildings.map((b) => [b.slug, b]));
  const fitted = new Map<string, Fitted[]>();
  // By path, so each building's floors come lowest first: names are zero-padded and must match the floor.
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const building = bySlug.get(file.floor.building);
    const wrong = misplaced(file, building);
    if (wrong !== null || !building) {
      errors.push(wrong ?? `${file.path}: no building`);
      continue;
    }
    const floor = fitFloor(file, building, notes);
    if (typeof floor === 'string') errors.push(floor);
    else fitted.set(file.floor.building, [...(fitted.get(file.floor.building) ?? []), floor]);
  }
  for (const v of inputs.verticals.filter((x) => !fitted.has(x.building))) {
    errors.push(`${v.path}: ${v.building} has no floor files`);
  }
  const result = { buildings: [], errors, notes };
  const out = [...fitted]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([slug, floors]) => {
      const building = bySlug.get(slug);
      return building ? [assemble(building, floors, inputs, result)] : [];
    });
  for (const b of out) {
    const checked = indoorSchema.safeParse(b);
    if (!checked.success) {
      errors.push(...checked.error.issues.map((i) => `buildings/${b.building}.json ${i.path.join('.')}: ${i.message}`));
    }
  }
  return { buildings: errors.length === 0 ? out : [], errors, notes };
}
