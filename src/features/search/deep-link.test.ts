// A deep link has one right answer, and a wrong one sends a student who followed a friend's link to the wrong room
// with no error anywhere. So each case names the exact card or the exact text S2 opens with (user-flows §3.9, D40).
import { describe, expect, it } from 'vitest';
import { readDeepLink, resolveDeepLink, type DeepLink } from './deep-link';
import { INDEX } from './search.fixture';
import { shareLink, shareTitle } from './share';

/** The result in short form: `room:ST311`, `building:andrew` or `search:ST350`. */
function summary(link: DeepLink) {
  if (link.kind === 'search') return `search:${link.text}`;
  return link.hit.kind === 'room' ? `room:${link.hit.code}` : `building:${link.hit.building.slug}`;
}

const open = (search: string) => {
  const text = readDeepLink(search);
  return text === null ? null : summary(resolveDeepLink(text, INDEX));
};

describe('readDeepLink', () => {
  it('reads ?to=', () => {
    expect(readDeepLink('?to=ST311')).toBe('ST311');
  });

  it('decodes what a share sheet or chat app encoded', () => {
    expect(readDeepLink('?to=St.%20Joseph')).toBe('St. Joseph');
    expect(readDeepLink('?to=ST404%2F406')).toBe('ST404/406');
    expect(readDeepLink('?to=st+311')).toBe('st 311');
  });

  it('trims spaces around it', () => {
    expect(readDeepLink('?to=%20ST311%20')).toBe('ST311');
  });

  it.each(['', '?', '?to=', '?to=%20%20', '?from=AG1104', '?q=ST311'])('%s is not a deep link', (search) => {
    expect(readDeepLink(search)).toBeNull();
  });

  it('keeps 40 characters at most, so a pasted paragraph never fills the search box', () => {
    expect(readDeepLink(`?to=${'A'.repeat(100)}`)).toBe('A'.repeat(40));
  });

  it('reads only to=, never from=: a link never carries where someone is (PRD §6)', () => {
    expect(readDeepLink('?from=AG1104&to=ST311')).toBe('ST311');
  });
});

describe('resolveDeepLink: what Go would open, opens', () => {
  it.each([
    ['ST311', 'room:ST311'],
    ['st 311', 'room:ST311'],
    ['C311', 'room:ST311'],
    ['ST404/406', 'room:ST404'],
    ['SM105', 'room:SM105'],
    ['Andrew', 'building:andrew'],
    ['strc', 'building:strc'],
    ['St. Joseph', 'building:sj'],
  ])('%s opens %s', (to, expected) => {
    expect(open(`?to=${encodeURIComponent(to)}`)).toBe(expected);
  });

  it('keeps "also written C311" for a link typed with the alias', () => {
    const link = resolveDeepLink('C311', INDEX);
    expect(link.kind === 'open' && link.hit.kind === 'room' && link.hit.typedAs).toBe('C311');
  });

  it('a canonical link has no "also written"', () => {
    const link = resolveDeepLink('ST311', INDEX);
    expect(link.kind === 'open' && link.hit.kind === 'room' && link.hit.typedAs).toBe(undefined);
  });

  it('carries the whole room, so the card has its name, building and floor', () => {
    const link = resolveDeepLink('ST311', INDEX);
    expect(link).toStrictEqual({ kind: 'open', hit: INDEX.byCode.get('ST311') });
  });
});

describe('resolveDeepLink: anything else opens S2 with the text typed', () => {
  it.each([
    ['ST350', 'not in the list: S2 says so with Did you mean'],
    ['AG1104', 'a building with no room list yet'],
    ['VH501', 'a sign prefix is only ever suggested (D25)'],
    ['X305', 'an unknown prefix'],
    ['305', 'a bare number matches a room in several buildings'],
    ['ST31', 'a partial code'],
    ['G', 'a one-letter prefix is not exact'],
    ['velsaco', 'a typo is only Did you mean'],
    ['Henry Sy', 'a block-tier building'],
    ['Biology', 'room names are not searched'],
  ])('%s → S2 (%s)', (to) => {
    expect(open(`?to=${encodeURIComponent(to)}`)).toBe(`search:${to}`);
  });
});

describe('every result kind can be produced', () => {
  it('room, building and search', () => {
    const kinds = ['ST311', 'Andrew', 'ST350'].map((t) => {
      const link = resolveDeepLink(t, INDEX);
      return link.kind === 'search' ? 'search' : link.hit.kind;
    });
    expect(kinds).toStrictEqual(['room', 'building', 'search']);
  });
});

describe('shareLink', () => {
  it('is the app address with only the destination', () => {
    expect(shareLink('https://dlsu-map.pages.dev', 'ST311')).toBe('https://dlsu-map.pages.dev/?to=ST311');
  });

  it('works on localhost with a port', () => {
    expect(shareLink('http://localhost:5173', 'ST315A')).toBe('http://localhost:5173/?to=ST315A');
  });

  it('never has from in it (PRD §6)', () => {
    expect(shareLink('https://dlsu-map.pages.dev', 'ST311')).not.toMatch(/from/i);
  });

  it('opens the same room it shares', () => {
    const url = new URL(shareLink('https://dlsu-map.pages.dev', 'ST315A'));
    expect(open(url.search)).toBe('room:ST315A');
  });
});

describe('shareTitle', () => {
  it('is the card line: code, name, building and floor', () => {
    const room = INDEX.byCode.get('ST311');
    expect(room && shareTitle(room)).toBe('ST311 · Surface Physics Lab · STRC 3F');
  });

  it('uses the floor as the building signs it', () => {
    const room = INDEX.byCode.get('SM105');
    expect(room && shareTitle(room)).toBe('SM105 · Registrar · Miguel G Mezz');
  });
});
