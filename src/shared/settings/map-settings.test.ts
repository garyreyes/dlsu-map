import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  DEFAULT_MAP_SETTINGS,
  parseMapSettings,
  type MapSettings,
  type SettingsPatch,
} from './map-settings';

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

describe('SettingsPatch', () => {
  // Checked by the typecheck, not at run time: a patch can leave a field out but never set it to undefined.
  const patch = <K extends keyof MapSettings>(p: SettingsPatch<K>) => p;

  it('takes any mix of real values', () => {
    expect(patch({ colour: 'black' })).toEqual({ colour: 'black' });
    expect(patch({ view: '2d', buildings: 'see-through' })).toEqual({ view: '2d', buildings: 'see-through' });
  });

  it('rejects undefined', () => {
    // @ts-expect-error a field set to undefined would wipe the saved value
    expect(patch({ view: undefined })).toEqual({ view: undefined });
  });
});

describe('applyPatch', () => {
  it('changes only the fields in the patch', () => {
    expect(applyPatch(DEFAULT_MAP_SETTINGS, { colour: 'grey' })).toEqual({
      colour: 'grey',
      view: '3d',
      buildings: 'solid',
    });
  });

  it('ignores a field set to undefined, from a cast or plain JS', () => {
    const patch = { view: undefined, colour: 'black' } as unknown as SettingsPatch<'colour'>;
    expect(applyPatch(DEFAULT_MAP_SETTINGS, patch)).toEqual({ colour: 'black', view: '3d', buildings: 'solid' });
  });
});
