import { describe, expect, it } from 'vitest';
import { RAIL_ROWS, type RailRow } from './cutaway';
import { railRows } from './floor-rail';

/** Compact form: label, `*` on the current floor, `~` on an untraced floor, `⋮` for a gap. */
function show(rows: readonly RailRow[]): string[] {
  return rows.map((r) => (r.kind === 'gap' ? '⋮' : `${r.label}${r.current ? '*' : ''}${r.traced ? '' : '~'}`));
}

function floorsOf(rows: readonly RailRow[]): number[] {
  return rows.flatMap((r) => (r.kind === 'floor' ? [r.floor] : []));
}

const all = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('railRows', () => {
  it('lists every floor of a short building, highest first', () => {
    const rows = railRows(4, { '1': 'G' }, [1, 2, 3, 4], 3);
    expect(show(rows)).toEqual(['4F', '3F*', '2F', 'G']);
  });

  it('marks floors without a floor file as untraced', () => {
    const rows = railRows(4, undefined, [1, 2], 2);
    expect(show(rows)).toEqual(['4F~', '3F~', '2F*', '1F']);
  });

  it('windows a tall building around the step floor', () => {
    expect(show(railRows(20, { '1': 'G' }, all(20), 7))).toEqual(['20F', '⋮', '9F', '8F', '7F*', '6F', '5F', '⋮', 'G']);
  });

  it('gives the spare rows to the far side at the top and bottom', () => {
    expect(show(railRows(20, { '1': 'G' }, all(20), 20))).toEqual([
      '20F*',
      '19F',
      '18F',
      '17F',
      '16F',
      '15F',
      '14F',
      '⋮',
      'G',
    ]);
    expect(show(railRows(20, { '1': 'G' }, all(20), 1))).toEqual([
      '20F',
      '⋮',
      '7F',
      '6F',
      '5F',
      '4F',
      '3F',
      '2F',
      'G*',
    ]);
  });

  it('handles the floors next to the ends', () => {
    const second = show(railRows(20, { '1': 'G' }, all(20), 2));
    expect(second[0]).toBe('20F');
    expect(second.at(-1)).toBe('G');
    expect(second).toContain('2F*');
    const nearTop = show(railRows(20, { '1': 'G' }, all(20), 19));
    expect(nearTop[0]).toBe('20F');
    expect(nearTop).toContain('19F*');
    expect(nearTop.at(-1)).toBe('G');
  });

  it('clamps a current floor outside the building', () => {
    expect(show(railRows(3, undefined, [1, 2, 3], 9))).toEqual(['3F*', '2F', '1F']);
    expect(show(railRows(3, undefined, [1, 2, 3], 0))).toEqual(['3F', '2F', '1F*']);
  });

  it('keeps every invariant for every building height and floor', () => {
    for (const levels of [1, 2, 4, 9, 10, 11, 12, 20]) {
      for (let current = 1; current <= levels; current++) {
        const rows = railRows(levels, { '1': 'G' }, all(levels), current);
        const floors = floorsOf(rows);
        expect(rows.length).toBeLessThanOrEqual(RAIL_ROWS);
        expect(rows.filter((r) => r.kind === 'floor' && r.current)).toHaveLength(1);
        expect(floors).toContain(current);
        expect(floors[0]).toBe(levels);
        expect(floors.at(-1)).toBe(1);
        expect(rows[0]?.kind).toBe('floor');
        expect(rows.at(-1)?.kind).toBe('floor');
        // Strictly descending, a gap exactly where floors are skipped and nowhere else.
        rows.forEach((r, i) => {
          const prev = rows[i - 1];
          const next = rows[i + 1];
          if (r.kind === 'gap') {
            expect(prev?.kind).toBe('floor');
            expect(next?.kind).toBe('floor');
            if (prev?.kind === 'floor' && next?.kind === 'floor') expect(prev.floor - next.floor).toBeGreaterThan(1);
          } else if (prev?.kind === 'floor') {
            expect(prev.floor - r.floor).toBe(1);
          }
        });
      }
    }
  });
});
