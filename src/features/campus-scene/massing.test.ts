// The massing model's geometry. A wall facing inward or a roof wound the wrong way doesn't crash: the building just
// renders inside out or vanishes from above. A wrong triangle → building table opens the wrong card on a tap. So
// each case pins exact values.
import { describe, expect, it } from 'vitest';
import {
  buildMassing,
  campusGroups,
  FOOT_HEIGHT,
  FOOT_SHADE,
  ownerOf,
  selectionGroups,
  stumpBlocks,
  type Massing,
  type Owner,
} from './massing';

/** A 10 m square around (0, 0) in data coordinates (x east, y north), anticlockwise. */
const SQUARE_CCW = [-5, -5, 5, -5, 5, 5, -5, 5];
/** The same square drawn clockwise. */
const SQUARE_CW = [-5, -5, -5, 5, 5, 5, 5, -5];

const triangles = (m: Massing) => m.positions.length / 9;

/** Vertex `v` of triangle `t` as [x, y, z]. */
const vertex = (a: Float32Array, t: number, v: number) => {
  const i = (t * 3 + v) * 3;
  return [a[i] ?? NaN, a[i + 1] ?? NaN, a[i + 2] ?? NaN] as const;
};

/** The triangle's facing from its winding (anticlockwise seen from the front, as three.js draws). */
function windingNormal(m: Massing, t: number) {
  const [a, b, c] = [0, 1, 2].map((v) => vertex(m.positions, t, v));
  if (!a || !b || !c) throw new Error('missing vertex');
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  return [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]] as const;
}

const isRoof = (m: Massing, t: number) => vertex(m.normals, t, 0)[1] === 1;

describe('buildMassing', () => {
  it.each([
    ['anticlockwise', SQUARE_CCW],
    ['clockwise', SQUARE_CW],
  ])('makes walls in two bands plus a roof (%s outline)', (_label, outline) => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline, base: 0, top: 12 }] }]);
    // 4 walls × 2 bands (0–6 m darkening, 6–12 m) × 2 triangles, plus 2 for the square roof.
    expect(triangles(m)).toBe(18);
  });

  it.each([
    ['anticlockwise', SQUARE_CCW],
    ['clockwise', SQUARE_CW],
  ])('points every wall away from the middle and winds it to face that way (%s outline)', (_label, outline) => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline, base: 0, top: 12 }] }]);
    for (let t = 0; t < triangles(m); t++) {
      const n = vertex(m.normals, t, 0);
      const w = windingNormal(m, t);
      expect(n[0] * w[0] + n[1] * w[1] + n[2] * w[2], `triangle ${String(t)} faces its normal`).toBeGreaterThan(0);
      if (isRoof(m, t)) continue;
      // The wall's midpoint, pushed along its normal, moves away from the building's middle (0, 0).
      const mid = [0, 1, 2]
        .map((v) => vertex(m.positions, t, v))
        .reduce<[number, number]>((s, p) => [s[0] + p[0], s[1] + p[2]], [0, 0]);
      const before = Math.hypot(mid[0] / 3, mid[1] / 3);
      const after = Math.hypot(mid[0] / 3 + n[0], mid[1] / 3 + n[2]);
      expect(after, `triangle ${String(t)} points outward`).toBeGreaterThan(before);
    }
  });

  it('puts the roof at the top, facing straight up, at full brightness', () => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline: SQUARE_CCW, base: 0, top: 12 }] }]);
    const roofs = [...Array(triangles(m)).keys()].filter((t) => isRoof(m, t));
    expect(roofs).toHaveLength(2);
    for (const t of roofs) {
      for (const v of [0, 1, 2]) {
        expect(vertex(m.positions, t, v)[1]).toBe(12);
        expect(vertex(m.normals, t, v)).toStrictEqual([0, 1, 0]);
        expect(vertex(m.colors, t, v)).toStrictEqual([1, 1, 1]);
      }
    }
  });

  it('turns north into -z, so the map is not mirrored', () => {
    // A thin block well to the north (y 100–110) and east (x 20–30).
    const m = buildMassing([
      { id: 'a', volumes: [{ outline: [20, 100, 30, 100, 30, 110, 20, 110], base: 0, top: 3 }] },
    ]);
    const zs = [...Array(triangles(m) * 3).keys()].map((i) => m.positions[i * 3 + 2] ?? NaN);
    const xs = [...Array(triangles(m) * 3).keys()].map((i) => m.positions[i * 3] ?? NaN);
    expect(Math.min(...zs)).toBe(-110);
    expect(Math.max(...zs)).toBe(-100);
    expect(Math.min(...xs)).toBe(20);
    expect(Math.max(...xs)).toBe(30);
  });
});

describe('wall-foot darkening', () => {
  /** Every wall vertex's shade, keyed by its height. */
  function shadesByHeight(m: Massing) {
    const out = new Map<number, Set<number>>();
    for (let t = 0; t < triangles(m); t++) {
      if (isRoof(m, t)) continue;
      for (const v of [0, 1, 2]) {
        const y = Math.round(vertex(m.positions, t, v)[1] * 1000) / 1000;
        const c = vertex(m.colors, t, v);
        expect(c[0], 'shades are grey').toBe(c[1]);
        expect(c[1], 'shades are grey').toBe(c[2]);
        const set = out.get(y) ?? new Set<number>();
        set.add(Math.round(c[0] * 1000) / 1000);
        out.set(y, set);
      }
    }
    return out;
  }

  it('uses the DESIGN.md values: the bottom 6 m, darkened to 70%', () => {
    expect(FOOT_HEIGHT).toBe(6);
    expect(FOOT_SHADE).toBe(0.7);
  });

  it('darkens the foot of the wall and grades to full brightness 6 m up', () => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline: SQUARE_CCW, base: 0, top: 12 }] }]);
    expect(shadesByHeight(m)).toStrictEqual(
      new Map([
        [0, new Set([0.7])],
        [6, new Set([1])],
        [12, new Set([1])],
      ]),
    );
  });

  it('stops part way on a wall shorter than 6 m', () => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline: SQUARE_CCW, base: 0, top: 3 }] }]);
    expect(shadesByHeight(m)).toStrictEqual(
      new Map([
        [0, new Set([0.7])],
        [3, new Set([0.85])],
      ]),
    );
  });

  it("measures from the volume's own base, so a tower sits on its podium", () => {
    const m = buildMassing([{ id: 'a', volumes: [{ outline: SQUARE_CCW, base: 6.8, top: 20 }] }]);
    expect(shadesByHeight(m)).toStrictEqual(
      new Map([
        [6.8, new Set([0.7])],
        [12.8, new Set([1])],
        [20, new Set([1])],
      ]),
    );
  });
});

describe('ownerOf', () => {
  const m = buildMassing([
    { id: 'strc', volumes: [{ outline: SQUARE_CCW, base: 0, top: 12 }] },
    {
      id: 'henry-sy',
      volumes: [
        { outline: SQUARE_CCW, base: 0, top: 6 },
        { outline: SQUARE_CCW, base: 6, top: 50 },
      ],
    },
    { id: 'connon', volumes: [{ outline: SQUARE_CCW, base: 0, top: 3 }] },
  ]);
  // strc: 18 triangles (0–17). henry-sy: 10 for the 6 m podium (one band) + 18 for the tower = 28 (18–45).
  // connon: 10 (46–55).

  it.each([
    [0, 'strc'],
    [17, 'strc'],
    [18, 'henry-sy'],
    [30, 'henry-sy'],
    [45, 'henry-sy'],
    [46, 'connon'],
    [55, 'connon'],
  ])('triangle %i belongs to %s', (face, id) => {
    expect(ownerOf(m.owners, face)).toBe(id);
  });

  it('has the expected triangle count, so the ranges above are real', () => {
    expect(triangles(m)).toBe(56);
  });

  it.each([[-1], [56], [1000], [0.5]])('answers undefined for triangle %s, which no building has', (face) => {
    expect(ownerOf(m.owners, face)).toBeUndefined();
  });

  it('answers undefined for every triangle when nothing is owned', () => {
    expect(ownerOf([], 0)).toBeUndefined();
  });
});

// The selected building is drawn with the tinted material through draw groups. A wrong range tints the wrong
// building, or half of one, and still renders without complaint.
describe('selectionGroups', () => {
  const owners: Owner[] = [
    { id: 'strc', first: 0, count: 18 },
    { id: 'henry-sy', first: 18, count: 28 },
    { id: 'connon', first: 46, count: 10 },
  ];
  const total = 56;

  it('draws everything with material 0 when nothing is selected', () => {
    expect(selectionGroups(owners, null, total)).toStrictEqual([{ start: 0, count: 168, materialIndex: 0 }]);
  });

  it('gives a middle building material 1, in vertices, with the rest either side on material 0', () => {
    expect(selectionGroups(owners, 'henry-sy', total)).toStrictEqual([
      { start: 0, count: 54, materialIndex: 0 },
      { start: 54, count: 84, materialIndex: 1 },
      { start: 138, count: 30, materialIndex: 0 },
    ]);
  });

  it('leaves out an empty group when the selection is first or last', () => {
    expect(selectionGroups(owners, 'strc', total)).toStrictEqual([
      { start: 0, count: 54, materialIndex: 1 },
      { start: 54, count: 114, materialIndex: 0 },
    ]);
    expect(selectionGroups(owners, 'connon', total)).toStrictEqual([
      { start: 0, count: 138, materialIndex: 0 },
      { start: 138, count: 30, materialIndex: 1 },
    ]);
  });

  it('draws everything plainly for a slug with no triangles', () => {
    expect(selectionGroups(owners, 'velasco', total)).toStrictEqual([{ start: 0, count: 168, materialIndex: 0 }]);
  });
});

// The cutaway swaps one building's full volume for a stump up to the cut floor's slab. A wrong cut leaves a gap or a
// tower poking through the floor; a wrong group list makes a tap on one building select another.
describe('stumpBlocks', () => {
  const podium = { outline: SQUARE_CCW, base: 0, top: 12 };
  const tower = { outline: SQUARE_CCW, base: 12, top: 60 };

  it('keeps only the podium, cut to the slab, when the slab is inside it', () => {
    expect(stumpBlocks([podium, tower], 8)).toStrictEqual([{ outline: SQUARE_CCW, base: 0, top: 8 }]);
  });

  it('cuts the tower at the slab when the slab is above the podium', () => {
    expect(stumpBlocks([podium, tower], 20)).toStrictEqual([
      { outline: SQUARE_CCW, base: 0, top: 12 },
      { outline: SQUARE_CCW, base: 12, top: 20 },
    ]);
  });

  it('is empty at slab 0', () => {
    expect(stumpBlocks([podium, tower], 0)).toStrictEqual([]);
  });

  it('drops a block whose cut height is under 1 cm', () => {
    expect(stumpBlocks([podium], 0.005)).toStrictEqual([]);
  });
});

describe('campusGroups', () => {
  const block = { outline: SQUARE_CCW, base: 0, top: 12 };
  const buildings = ['first', 'mid', 'last'].map((slug) => ({ slug, volumes: [block] }));

  it('leaves out the cut building and keeps the tap table pointing at the right slugs', () => {
    const m = buildMassing(campusGroups(buildings, 'mid'));
    expect(m.owners.map((o) => o.id)).toStrictEqual(['first', 'last']);
    // first owns triangles 0–17, so the building that came after mid starts at 18.
    expect(ownerOf(m.owners, 18)).toBe('last');
    expect(ownerOf(m.owners, 35)).toBe('last');
    expect(ownerOf(m.owners, 36)).toBeUndefined();
  });

  it('keeps every building when nothing is cut', () => {
    const m = buildMassing(campusGroups(buildings, null));
    expect(m.owners.map((o) => o.id)).toStrictEqual(['first', 'mid', 'last']);
    expect(ownerOf(m.owners, 18)).toBe('mid');
  });
});
