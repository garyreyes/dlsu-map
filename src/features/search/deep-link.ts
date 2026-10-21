// The deep link `?to=ST311` (3d, user-flows §3.9, D40): opens the card for what the link names, the same rule as the
// keyboard's Go key (D38), and anything less certain opens S2 with the text typed. Only `to` is read: a link never
// carries where someone is (PRD §6). Pure: no React, no fetch. Tests: deep-link.test.ts.
import type { Hit, SearchIndex } from './search-index';
import { searchResults } from './search-results';

export type DeepLink =
  /** Exactly one room or building: its card opens. */
  | { readonly kind: 'open'; readonly hit: Hit }
  /** Anything else: S2 opens with this text typed, and shows what it would for it (Did you mean, a note…). */
  | { readonly kind: 'search'; readonly text: string };

/** Longer than any code or building name; a pasted paragraph is cut here rather than filling the search box. */
const MAX_TEXT = 40;

/** The text after `?to=`, decoded and trimmed, or null when there's none. */
export function readDeepLink(search: string): string | null {
  const to = new URLSearchParams(search).get('to')?.trim().slice(0, MAX_TEXT);
  return to === undefined || to === '' ? null : to;
}

export function resolveDeepLink(text: string, index: SearchIndex): DeepLink {
  const exact = searchResults(text, index).exact;
  return exact ? { kind: 'open', hit: exact } : { kind: 'search', text };
}
