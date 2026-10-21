// The floor band answers "which floor" on the map, so a band one storey off is a wrong answer that looks right. Each
// case asserts exact heights and points (DESIGN.md, Floor band; 3d).
import { describe, expect, it } from 'vitest';
import { bandSamples, bestHeading, chipAnchor, floorBand, headingCandidates, offsetOutline } from './floor-band';

/** A 10 × 20 m box, anticlockwise (x east, y north). */
const BOX = [0, 0, 10, 0, 10, 20, 0, 20];
const STRC = { levels: 4, volumes: [{ outline: BOX, base: 0, top: 13.6 }] };

const rounded = (a: readonly number[]) => a.map((v) => Math.round(v * 1000) / 1000);

describe('floorBand: one storey tall, inset 0.1 m', () => {
  it('STRC 3F is 6.9 m to 10.1 m', () => {
    const band = floorBand(STRC, 3);
    expect(band && [band.bottom, band.top].map((v) => Math.round(v * 1000) / 1000)).toStrictEqual([6.9, 10.1]);
  });

  it('G (floor 1) starts just above the ground', () => {
    const band = floorBand(STRC, 1);
    expect(band && [band.bottom, band.top].map((v) => Math.round(v * 1000) / 1000)).toStrictEqual([0.1, 3.3]);
  });

  it('the top floor ends just under the roof', () => {
    const band = floorBand(STRC, 4);
    expect(band && Math.round(band.top * 1000) / 1000).toBe(13.5);
  });

  it.each([0, 5, -1, 2.5])('floor %s is not a storey of a 4-level building: no band', (floor) => {
    expect(floorBand(STRC, floor)).toBeNull();
  });

  it('the storey height comes from the first volume, which `levels` counts', () => {
    const raised = { levels: 2, volumes: [{ outline: BOX, base: 4, top: 12 }] };
    const band = floorBand(raised, 2);
    expect(band && [band.bottom, band.top].map((v) => Math.round(v * 1000) / 1000)).toStrictEqual([8.1, 11.9]);
  });

  it('pushes the outline 0.6 m out from the walls', () => {
    const band = floorBand(STRC, 3);
    expect(band && band.outlines.map(rounded)).toStrictEqual([[-0.6, -0.6, 10.6, -0.6, 10.6, 20.6, -0.6, 20.6]]);
  });
});

describe('floorBand on a building of several volumes', () => {
  // Yuchengco's shape: a 9-level tower, a one-storey podium, and a top block over part of it.
  const tower = { outline: BOX, base: 0, top: 30.6 };
  const podium = { outline: [20, 0, 30, 0, 30, 10, 20, 10], base: 0, top: 3.4 };
  const crown = { outline: [40, 0, 50, 0, 50, 10, 40, 10], base: 23.8, top: 30.6 };
  const yuchengco = { levels: 9, volumes: [tower, podium, crown] };

  it('wraps every volume that holds the whole storey: floor 1 is the tower and the podium', () => {
    const band = floorBand(yuchengco, 1);
    expect(band?.outlines.map((o) => o[0])).toStrictEqual([-0.6, 19.4]);
  });

  it('floor 8 (23.8 m to 27.2 m) is the tower and the top block, not the podium', () => {
    const band = floorBand(yuchengco, 8);
    expect(band?.outlines.map((o) => o[0])).toStrictEqual([-0.6, 39.4]);
  });

  it('every storey has at least the first volume, so a band is never empty and the chip always has a band', () => {
    for (let floor = 1; floor <= 9; floor++) {
      expect(floorBand(yuchengco, floor)?.outlines[0]?.[0]).toBe(-0.6);
    }
  });

  it('floor 4 is the tower alone', () => {
    expect(floorBand(yuchengco, 4)?.outlines).toHaveLength(1);
  });
});

describe('offsetOutline', () => {
  it('moves outward whichever way the outline runs', () => {
    const clockwise = [0, 0, 0, 20, 10, 20, 10, 0];
    expect(rounded(offsetOutline(clockwise, 0.6))).toStrictEqual([-0.6, -0.6, -0.6, 20.6, 10.6, 20.6, 10.6, -0.6]);
  });

  it('caps a sharp corner instead of shooting a spike out', () => {
    // A thin wedge: its tip turns almost all the way back.
    const wedge = [0, 0, 100, 1, 0, 2];
    const tip = offsetOutline(wedge, 0.6).slice(2, 4);
    const [x = 0, y = 0] = tip;
    expect(Math.hypot(x - 100, y - 1)).toBeLessThanOrEqual(0.6 / 0.35 + 1e-9);
  });
});

describe('bandSamples: where the chip may sit and what the camera must see', () => {
  it('each corner and the middle of each wall, at the band’s mid-height', () => {
    const band = { outlines: [[0, 0, 10, 0, 10, 20, 0, 20]], bottom: 6.9, top: 10.1 };
    expect(bandSamples(band).map((p) => [p.x, p.y, Math.round(p.h * 1000) / 1000])).toStrictEqual([
      [0, 0, 8.5],
      [5, 0, 8.5],
      [10, 0, 8.5],
      [10, 10, 8.5],
      [10, 20, 8.5],
      [5, 20, 8.5],
      [0, 20, 8.5],
      [0, 10, 8.5],
    ]);
  });
});

describe('chipAnchor: the right-most stretch of band the camera can see', () => {
  const view = { left: 0, top: 60, right: 390, bottom: 500 };
  const at = (x: number, y: number, visible = true) => ({ x, y, visible });
  const anchor = (points: readonly ReturnType<typeof at>[]) =>
    chipAnchor(points, view, (i) => points[i]?.visible ?? false);

  it('picks the right-most visible point', () => {
    expect(anchor([at(100, 200), at(250, 210), at(180, 205)])).toBe(1);
  });

  it('skips a point a building hides, even if it is further right', () => {
    expect(anchor([at(100, 200), at(250, 210, false)])).toBe(0);
  });

  it('leaves room for the chip at the right edge', () => {
    expect(anchor([at(100, 200), at(330, 200)])).toBe(0);
  });

  it('skips points under the search pill or the sheet', () => {
    expect(anchor([at(100, 40), at(120, 520), at(80, 300)])).toBe(2);
  });

  it('none visible: no chip', () => {
    expect(anchor([at(100, 200, false)])).toBeNull();
    expect(anchor([])).toBeNull();
  });

  it('asks about visibility right-most first and stops at the first yes', () => {
    const asked: number[] = [];
    const points = [at(100, 200), at(250, 210), at(180, 205), at(200, 200)];
    chipAnchor(points, view, (i) => {
      asked.push(i);
      return i === 3;
    });
    expect(asked).toStrictEqual([1, 3]);
  });
});

describe('headings to try for a view that sees the band', () => {
  it('starts from the current heading, then swings out both ways, then turns around', () => {
    const degrees = headingCandidates(0).map((a) => Math.round((a * 180) / Math.PI));
    expect(degrees).toStrictEqual([0, 30, -30, 60, -60, 90, -90, 135, -135, 180]);
  });

  it('is relative to where the student has turned the map', () => {
    expect(headingCandidates(1)[0]).toBe(1);
  });
});

describe('bestHeading', () => {
  it('the first heading that sees every point wins, so the camera turns as little as it can', () => {
    const seen = new Map([
      [0, 3],
      [1, 5],
      [2, 5],
    ]);
    expect(bestHeading([0, 1, 2], (a) => seen.get(a) ?? 0, 5)).toBe(1);
  });

  it('when none sees all, the one that sees most; the earlier one on a tie', () => {
    const seen = new Map([
      [0, 2],
      [1, 4],
      [2, 4],
    ]);
    expect(bestHeading([0, 1, 2], (a) => seen.get(a) ?? 0, 5)).toBe(1);
  });

  it('stops checking once one sees everything', () => {
    const checked: number[] = [];
    bestHeading(
      [0, 1, 2],
      (a) => {
        checked.push(a);
        return 5;
      },
      5,
    );
    expect(checked).toStrictEqual([0]);
  });

  it('nothing to try keeps the current heading', () => {
    expect(bestHeading([], () => 0, 5)).toBeNull();
  });
});
