// Recent (user-flows §3.2, D38): the last 5 destinations, saved on this phone only. The list math has one right
// answer, and what comes back from storage can be anything (an old version, another app's key, hand edits), so both
// get exact-value tests. From is never a destination, so it can never reach this list (PRD §6).
import { describe, expect, it } from 'vitest';
import { INDEX } from './search.fixture';
import { addRecent, parseRecent, resolveRecent, type RecentEntry } from './recent';

const room = (code: string): RecentEntry => ({ kind: 'room', code });
const building = (slug: string): RecentEntry => ({ kind: 'building', slug });

describe('addRecent', () => {
  it('puts the newest first', () => {
    expect(addRecent([room('ST311')], building('andrew'))).toStrictEqual([building('andrew'), room('ST311')]);
  });

  it('moves a repeat to the front instead of listing it twice', () => {
    const list = [room('ST311'), room('ST404'), building('andrew')];
    expect(addRecent(list, room('ST404'))).toStrictEqual([room('ST404'), room('ST311'), building('andrew')]);
  });

  it('keeps 5 at most, dropping the oldest', () => {
    const list = ['ST301', 'ST302', 'ST303', 'ST304', 'ST305'].map(room);
    expect(addRecent(list, room('ST306'))).toStrictEqual(['ST306', 'ST301', 'ST302', 'ST303', 'ST304'].map(room));
  });

  it('never changes the list it was given', () => {
    const list = Object.freeze([room('ST311')]);
    addRecent(list, room('ST404'));
    expect(list).toStrictEqual([room('ST311')]);
  });
});

describe('parseRecent', () => {
  it('reads back what was saved', () => {
    const saved = JSON.stringify([room('ST311'), building('andrew')]);
    expect(parseRecent(saved)).toStrictEqual([room('ST311'), building('andrew')]);
  });

  it.each([
    ['nothing saved', null],
    ['not JSON', '{oops'],
    ['not a list', '{"kind":"room","code":"ST311"}'],
    ['JSON null', 'null'],
  ])('%s gives an empty list', (_, saved) => {
    expect(parseRecent(saved)).toStrictEqual([]);
  });

  it('drops entries of the wrong shape and keeps the rest', () => {
    const saved = JSON.stringify([
      room('ST311'),
      { kind: 'room' },
      { kind: 'from', code: 'AG1104' },
      42,
      building('sj'),
    ]);
    expect(parseRecent(saved)).toStrictEqual([room('ST311'), building('sj')]);
  });

  it('drops repeats and keeps 5 at most', () => {
    const saved = JSON.stringify(['ST301', 'ST302', 'ST301', 'ST303', 'ST304', 'ST305', 'ST306'].map(room));
    expect(parseRecent(saved)).toStrictEqual(['ST301', 'ST302', 'ST303', 'ST304', 'ST305'].map(room));
  });
});

describe('resolveRecent', () => {
  it('turns entries into rows, in order', () => {
    const hits = resolveRecent([building('andrew'), room('ST311')], INDEX);
    expect(hits.map((h) => (h.kind === 'room' ? h.code : h.building.slug))).toStrictEqual(['andrew', 'ST311']);
  });

  it('drops rooms and buildings that are no longer in the data, or no longer searchable', () => {
    const hits = resolveRecent([room('ST999'), building('henry-sy'), building('gone'), room('ST404')], INDEX);
    expect(hits.map((h) => (h.kind === 'room' ? h.code : h.building.slug))).toStrictEqual(['ST404']);
  });

  it('shows a room without "also written", since Recent stores the canonical code', () => {
    const [hit] = resolveRecent([room('ST311')], INDEX);
    expect(hit?.kind === 'room' && hit.typedAs).toBe(undefined);
  });
});
