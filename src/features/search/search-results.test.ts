// Search has one right answer per thing typed, and a wrong one sends a student to the wrong room or building with no
// error anywhere. So each case asserts the exact list, in order, and one test proves every note, heading and row kind
// can actually be produced. Rules: user-flows §3.3, PRD §7 (strict), D18, D25, D38.
import { describe, expect, it } from 'vitest';
import { INDEX } from './search.fixture';
import { searchResults, type Hit, type SearchView } from './search-results';

const id = (hit: Hit) => (hit.kind === 'room' ? `room:${hit.code}` : `building:${hit.building.slug}`);

/** The view in short form: the note, the heading, the rows as `room:ST311` / `building:andrew`, and the Go-key match. */
function summary(view: SearchView) {
  return {
    note: view.note === undefined ? null : summaryNote(view.note),
    heading: view.heading ?? null,
    hits: view.hits.map(id),
    exact: view.exact === undefined ? null : id(view.exact),
  };
}

function summaryNote(note: NonNullable<SearchView['note']>) {
  switch (note.kind) {
    case 'not-in-list':
      return `not-in-list:${note.code}`;
    case 'unknown-prefix':
      return `unknown-prefix:${note.prefix}`;
    case 'no-room-list':
    case 'not-searchable':
      return `${note.kind}:${note.building.slug}`;
    case 'no-match':
      return `no-match:${note.typed}`;
  }
}

const search = (typed: string) => summary(searchResults(typed, INDEX));

const ALL_FULL = ['andrew', 'gokongwei', 'velasco', 'miguel', 'yuchengco', 'sj', 'ls', 'razon', 'mutien', 'strc'];

describe('a room code that is in the list', () => {
  it.each(['ST311', 'st 311', 'C311', 'C-311', 'c311', ' ST-311 '])('%s finds ST311 and Go opens it', (typed) => {
    expect(search(typed)).toStrictEqual({ note: null, heading: null, hits: ['room:ST311'], exact: 'room:ST311' });
  });

  it('carries the line the row shows: name, building and floor', () => {
    const view = searchResults('ST311', INDEX);
    expect(view.exact).toStrictEqual({
      kind: 'room',
      code: 'ST311',
      name: 'Surface Physics Lab',
      floor: 3,
      floorLabel: '3F',
      building: INDEX.bySlug.get('strc'),
    });
  });

  it('says "also written C311" only when typed with the alias', () => {
    const typedAs = (typed: string) => {
      const exact = searchResults(typed, INDEX).exact;
      return exact?.kind === 'room' ? exact.typedAs : 'not a room';
    };
    expect(typedAs('C311')).toBe('C311');
    expect(typedAs('c-311')).toBe('C311');
    expect(typedAs('ST311')).toBeUndefined();
  });

  it('reads a combined entry as its first number (D18)', () => {
    expect(search('ST404/406')).toStrictEqual({ note: null, heading: null, hits: ['room:ST404'], exact: 'room:ST404' });
  });

  it('labels floors as the signs do: G for the ground floor, a room-level label wins (D26)', () => {
    const label = (typed: string) => {
      const exact = searchResults(typed, INDEX).exact;
      return exact?.kind === 'room' ? exact.floorLabel : 'not a room';
    };
    expect(label('ST102')).toBe('G');
    expect(label('SJ201')).toBe('2F');
    expect(label('SM105')).toBe('G Mezz');
  });
});

describe('while still typing', () => {
  it('lists the rooms that start with a partial code, 8 at most, in code order', () => {
    expect(search('ST31')).toStrictEqual({
      note: null,
      heading: null,
      hits: [
        'room:ST310',
        'room:ST311',
        'room:ST312',
        'room:ST313',
        'room:ST314',
        'room:ST315A',
        'room:ST315B',
        'room:ST316',
      ],
      exact: null,
    });
  });

  it('completes a full number to its lettered rooms instead of rejecting it', () => {
    expect(search('SJ206')).toStrictEqual({
      note: null,
      heading: null,
      hits: ['room:SJ206A', 'room:SJ206B'],
      exact: null,
    });
  });

  it('completes from an alias prefix, shown in canonical form', () => {
    expect(search('c40')).toStrictEqual({ note: null, heading: null, hits: ['room:ST404'], exact: null });
  });

  it('shows nothing yet for one or two bare digits', () => {
    expect(search('30')).toStrictEqual({ note: null, heading: null, hits: [], exact: null });
  });

  it.each(['', '   '])('shows nothing for %j (the screen shows Recent instead)', (typed) => {
    expect(search(typed)).toStrictEqual({ note: null, heading: null, hits: [], exact: null });
  });
});

describe('a code that is not in the list (strict, PRD §7)', () => {
  it('ST350: rejected, with the rooms one typo away (D38)', () => {
    expect(search('ST350')).toStrictEqual({
      note: 'not-in-list:ST350',
      heading: 'did-you-mean',
      hits: ['room:ST305', 'room:ST310'],
      exact: null,
    });
  });

  it('names the code in canonical form when typed with the alias', () => {
    expect(search('C350').note).toBe('not-in-list:ST350');
  });

  it('C904 (STRC has no 9F): rejected, with suggestions', () => {
    expect(search('C904')).toStrictEqual({
      note: 'not-in-list:ST904',
      heading: 'did-you-mean',
      hits: ['room:ST304', 'room:ST404'],
      exact: null,
    });
  });

  it('suggests only rooms in the same building', () => {
    expect(search('VL306')).toStrictEqual({
      note: 'not-in-list:VL306',
      heading: 'did-you-mean',
      hits: ['room:VL305'],
      exact: null,
    });
  });

  it('rejects with no suggestions when nothing is one typo away', () => {
    expect(search('ST999')).toStrictEqual({ note: 'not-in-list:ST999', heading: null, hits: [], exact: null });
  });
});

describe('a building that has no room list yet (D38)', () => {
  it.each(['AG1104', 'AG110', 'AG1', 'ag 1104'])(
    '%s says so and offers Andrew Hall, but Go never opens it',
    (typed) => {
      expect(search(typed)).toStrictEqual({
        note: 'no-room-list:andrew',
        heading: null,
        hits: ['building:andrew'],
        exact: null,
      });
    },
  );
});

describe('prefixes printed on signs that are not ours (D25)', () => {
  it.each([
    ['VH501', 'room:VL501'],
    ['J-201', 'room:SJ201'],
  ])('%s: Did you mean %s, one tap accepts, Go does not', (typed, hit) => {
    expect(search(typed)).toStrictEqual({ note: null, heading: 'did-you-mean', hits: [hit], exact: null });
  });

  it('completes a partial sign code as Did you mean', () => {
    expect(search('VH5')).toStrictEqual({
      note: null,
      heading: 'did-you-mean',
      hits: ['room:VL501', 'room:VL502'],
      exact: null,
    });
  });

  it('rejects a sign code whose room is not in the list, in canonical form', () => {
    expect(search('VH599')).toStrictEqual({ note: 'not-in-list:VL599', heading: null, hits: [], exact: null });
  });
});

describe('other codes', () => {
  it('X305 (unknown prefix): says so, then every searchable building', () => {
    expect(search('X305')).toStrictEqual({
      note: 'unknown-prefix:X',
      heading: 'buildings',
      hits: ALL_FULL.map((slug) => `building:${slug}`),
      exact: null,
    });
  });

  it('305 (no prefix, as St. Miguel prints it): rooms numbered 305 in each building, Go opens none', () => {
    expect(search('305')).toStrictEqual({
      note: null,
      heading: null,
      hits: ['room:SJ305', 'room:SM305', 'room:ST305', 'room:VL305'],
      exact: null,
    });
  });

  it('a bare number nobody uses is rejected', () => {
    expect(search('999')).toStrictEqual({ note: 'not-in-list:999', heading: null, hits: [], exact: null });
  });
});

describe('buildings by name or prefix', () => {
  it.each(['Andrew', 'andrew', 'AG', 'Gonzalez Hall', 'Br. Andrew Gonzalez Hall'])('%s finds Andrew Hall', (typed) => {
    expect(search(typed)).toStrictEqual({
      note: null,
      heading: null,
      hits: ['building:andrew'],
      exact: 'building:andrew',
    });
  });

  it('matches the start of any word, an exact match first, the rest in campus order', () => {
    expect(search('st')).toStrictEqual({
      note: null,
      heading: null,
      hits: ['building:strc', 'building:miguel', 'building:sj', 'building:ls'],
      exact: 'building:strc',
    });
  });

  it.each([
    ['C', ['building:razon', 'building:strc']],
    ['G', ['building:andrew', 'building:gokongwei']],
  ])('a one-letter prefix (%s) lists, but Go opens nothing: it may be the start of a code', (typed, hits) => {
    expect(search(typed)).toStrictEqual({ note: null, heading: null, hits, exact: null });
  });

  it('a partial name lists without a Go match', () => {
    expect(search('vel')).toStrictEqual({ note: null, heading: null, hits: ['building:velasco'], exact: null });
  });

  it('ignores the dot in "St." either way', () => {
    expect(search('st joseph').exact).toBe('building:sj');
    expect(search('St. Joseph').exact).toBe('building:sj');
  });

  it.each([
    ['velsaco', 'velasco'],
    ['andrw', 'andrew'],
    ['gokongwie', 'gokongwei'],
    ['st joesph', 'sj'],
  ])('a misspelled name gets Did you mean, one typo per word (D38): %s', (typed, slug) => {
    expect(search(typed)).toStrictEqual({
      note: null,
      heading: 'did-you-mean',
      hits: [`building:${slug}`],
      exact: null,
    });
  });

  it('a word under 4 letters is never read as a typo', () => {
    expect(search('stc')).toStrictEqual({ note: 'no-match:stc', heading: null, hits: [], exact: null });
  });

  it('a block-tier building says it is not searchable yet (D20)', () => {
    expect(search('Henry Sy')).toStrictEqual({ note: 'not-searchable:henry-sy', heading: null, hits: [], exact: null });
  });

  it('room names are not searched in v1 (PRD §8, a Could)', () => {
    expect(search('Biology')).toStrictEqual({ note: 'no-match:Biology', heading: null, hits: [], exact: null });
  });
});

describe('reachability', () => {
  it('every note kind, heading and row kind is produced by some input', () => {
    const views = ['ST311', 'ST350', 'AG1104', 'X305', 'Henry Sy', 'Biology', 'VH501', 'Andrew'].map((t) =>
      searchResults(t, INDEX),
    );
    const notes = new Set(views.flatMap((v) => (v.note ? [v.note.kind] : [])));
    const headings = new Set(views.flatMap((v) => (v.heading ? [v.heading] : [])));
    const kinds = new Set(views.flatMap((v) => v.hits.map((h) => h.kind)));
    expect([...notes].sort()).toStrictEqual([
      'no-match',
      'no-room-list',
      'not-in-list',
      'not-searchable',
      'unknown-prefix',
    ]);
    expect([...headings].sort()).toStrictEqual(['buildings', 'did-you-mean']);
    expect([...kinds].sort()).toStrictEqual(['building', 'room']);
  });
});
