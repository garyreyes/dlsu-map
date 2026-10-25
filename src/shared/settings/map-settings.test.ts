import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_SETTINGS, parseMapSettings } from './map-settings';

describe('parseMapSettings', () => {
  it('gives the defaults when nothing was saved', () => {
    expect(parseMapSettings(null)).toEqual({ colour: 'green', view: '3d', buildings: 'solid' });
    expect(DEFAULT_MAP_SETTINGS).toEqual({ colour: 'green', view: '3d', buildings: 'solid' });
  });

  it('gives the defaults for anything that is not a saved object', () => {
    for (const saved of ['', 'not json', '[]', '42', '"black"', 'null', '{']) {
      expect(parseMapSettings(saved)).toEqual(DEFAULT_MAP_SETTINGS);
    }
  });

  it('reads back every saved choice', () => {
    const saved = JSON.stringify({ colour: 'grey', view: '2d', buildings: 'see-through' });
    expect(parseMapSettings(saved)).toEqual({ colour: 'grey', view: '2d', buildings: 'see-through' });
  });

  it('accepts each colour mode', () => {
    for (const colour of ['green', 'black', 'grey'] as const) {
      expect(parseMapSettings(JSON.stringify({ colour })).colour).toBe(colour);
    }
  });

  it('fills a missing field with its default, keeping the rest', () => {
    expect(parseMapSettings(JSON.stringify({ colour: 'black' }))).toEqual({
      colour: 'black',
      view: '3d',
      buildings: 'solid',
    });
  });

  it('replaces only the unknown field, never the whole lot', () => {
    const saved = JSON.stringify({ colour: 'black', view: '4d', buildings: 7 });
    expect(parseMapSettings(saved)).toEqual({ colour: 'black', view: '3d', buildings: 'solid' });
  });

  it('is strict about spelling', () => {
    const saved = JSON.stringify({ colour: 'Black', view: '2D', buildings: 'see through' });
    expect(parseMapSettings(saved)).toEqual(DEFAULT_MAP_SETTINGS);
  });

  it('ignores fields it does not know', () => {
    const saved = JSON.stringify({ colour: 'grey', fog: 'none' });
    expect(parseMapSettings(saved)).toEqual({ colour: 'grey', view: '3d', buildings: 'solid' });
  });
});
