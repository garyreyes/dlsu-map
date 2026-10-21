// The dev-only link `?from=…&to=…` (5c) picks a route to check before Where are you (5a) exists. It never ships, but
// a wrong reading would check the wrong route without anyone noticing, so each shape is pinned here.
import { describe, expect, it } from 'vitest';
import { parseDevLink } from './dev-link';

describe('parseDevLink', () => {
  it('reads a gate to a room', () => {
    expect(parseDevLink('?from=gate-1&to=ST311')).toEqual({
      from: { kind: 'gate', gate: 'gate-1' },
      to: { kind: 'room', code: 'ST311' },
    });
  });

  it('reads a building and floor to a room', () => {
    expect(parseDevLink('?from=strc@3&to=ST311')).toEqual({
      from: { kind: 'building', building: 'strc', floor: 3 },
      to: { kind: 'room', code: 'ST311' },
    });
  });

  it('reads a room to a building', () => {
    expect(parseDevLink('?to=strc&from=AG1104')).toEqual({
      from: { kind: 'room', code: 'AG1104' },
      to: { kind: 'building', building: 'strc' },
    });
  });

  it('reads a room code with a letter', () => {
    expect(parseDevLink('?from=agno&to=ST315A')?.to).toEqual({ kind: 'room', code: 'ST315A' });
  });

  it('is null without both ends', () => {
    expect(parseDevLink('')).toBeNull();
    expect(parseDevLink('?from=gate-1')).toBeNull();
    expect(parseDevLink('?to=ST311')).toBeNull();
    expect(parseDevLink('?from=&to=ST311')).toBeNull();
  });

  it('rejects ends that aren’t a gate, a building spot or a room code', () => {
    for (const from of ['strc@0', 'strc@x', 'strc@03', 'strc@', '@3', 'Gate 1', 'ST 311', 'st-311@2@3']) {
      expect(parseDevLink(`?from=${encodeURIComponent(from)}&to=ST311`), from).toBeNull();
    }
    for (const to of ['strc@3', 'ST 311', 'St311', '311']) {
      expect(parseDevLink(`?from=gate-1&to=${encodeURIComponent(to)}`), to).toBeNull();
    }
  });
});
