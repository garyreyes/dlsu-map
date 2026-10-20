// How tall each block is drawn, from OSM tags. A wrong rule makes Andrew a 3-storey building or floats Henry Sy in
// the air without any error, so each tag combination asserts exact meters. Rules: OSM Simple 3D Buildings, with
// 3.4 m per level as the prototype used.
import { describe, expect, it } from 'vitest';
import { heightOf, unreadHeightTags } from './heights.ts';

describe('heightOf', () => {
  it.each([
    ['levels only', { 'building:levels': '4' }, { base: 0, top: 13.6 }],
    ['height wins over levels', { 'building:levels': '20', height: '90' }, { base: 0, top: 90 }],
    ['height with a unit', { height: '53.6 m' }, { base: 0, top: 53.6 }],
    ['min_level lifts the base', { 'building:levels': '7', 'building:min_level': '6' }, { base: 20.4, top: 23.8 }],
    [
      'min_height wins over min_level',
      { height: '15', min_height: '5', 'building:min_level': '2' },
      { base: 5, top: 15 },
    ],
    [
      'Henry Sy: on stilts',
      { 'building:levels': '15', 'building:min_level': '2', height: '53.6' },
      { base: 6.8, top: 53.6 },
    ],
    ['no height tags: the default 9 m', { building: 'yes' }, { base: 0, top: 9 }],
    ['nonsense levels: the default 9 m', { 'building:levels': 'many' }, { base: 0, top: 9 }],
  ])('%s', (_label, tags, expected) => {
    expect(heightOf(tags)).toStrictEqual(expected);
  });

  it('reports a block whose base is not below its top instead of drawing it', () => {
    expect(heightOf({ 'building:levels': '2', 'building:min_level': '2' })).toBeNull();
  });
});

describe('unreadHeightTags', () => {
  it('is empty when every height tag reads as meters or a level count', () => {
    expect(
      unreadHeightTags({ height: '53.6 m', min_height: '5', 'building:levels': '15', 'building:min_level': '2' }),
    ).toStrictEqual([]);
    expect(unreadHeightTags({ building: 'yes' })).toStrictEqual([]);
  });

  it.each([
    [{ height: '12 ft' }, ['height="12 ft"']],
    [{ height: "40'" }, ['height="40\'"']],
    [{ height: '12,5' }, ['height="12,5"']],
    [{ min_height: '-3' }, ['min_height="-3"']],
    [{ 'building:levels': '3;4' }, ['building:levels="3;4"']],
    [{ 'building:levels': '2.5' }, ['building:levels="2.5"']],
    [{ 'building:min_level': 'many', height: '1e2' }, ['height="1e2"', 'building:min_level="many"']],
  ])('names %j', (tags, unread) => {
    expect(unreadHeightTags(tags)).toStrictEqual(unread);
  });
});
