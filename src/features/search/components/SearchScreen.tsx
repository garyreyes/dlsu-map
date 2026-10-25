import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/shared/ui/IconButton';
import { useModal } from '@/shared/ui/useModal';
import { resolveRecent, type RecentEntry } from '../recent';
import { searchResults, type Hit, type SearchView } from '../search-results';
import { HitList, NoteLine, noteText } from './HitRow';
import { SearchCard } from './SearchCard';
import type { SearchData } from './useSearchData';

interface Props {
  data: SearchData;
  recent: readonly RecentEntry[];
  /** What the field starts with: a deep link's text it couldn't open as a card (D40), else empty. */
  initialQuery?: string;
  /** A row was tapped, or Go pressed on an exact match. */
  onPick: (hit: Hit) => void;
  onClose: () => void;
}

/**
 * Search (S2, user-flows §3.3, D55): a card over a dimmed map (SearchCard) holding a 64px bar with back and clear over
 * a list that updates as you type.
 * Tapping a row is how you pick; the keyboard's Go key opens only an exact room or building, never a suggestion
 * (D38). On a keyboard, Down moves from the field into the rows and Up/Down through them. Closes with its back
 * arrow, Escape or the phone's back button. Modal: the map and chrome behind it are inert while it's open, and focus
 * returns to the opener on close.
 */
export function SearchScreen({ data, recent, initialQuery = '', onPick, onClose }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModal(dialogRef);

  useEffect(() => {
    input.current?.focus(); // the student tapped search, so the keyboard should come up
    // Escape closes only search, never the sheet under it (S4, the route preview, the steps): it's heard in the
    // capture phase, before their listeners, and marked handled, which they check.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const view = useMemo(
    () => (data.status === 'ready' && query.trim() !== '' ? searchResults(query, data.index) : null),
    [data, query],
  );

  const clear = () => {
    setQuery('');
    input.current?.focus();
  };
  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.repeat) return; // a held key would pick again while search is closing
    if (view?.exact) onPick(view.exact);
    else list.current?.focus(); // hides the phone keyboard so the whole list shows; Down reaches the first row
  };
  const onArrow = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-hit]') ?? []);
    if (rows.length === 0) return;
    e.preventDefault();
    const at = rows.findIndex((row) => row === document.activeElement); // -1: the field
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : at - 1;
    (next < 0 ? input.current : rows[next])?.focus();
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onArrow}
      className="fixed inset-0 z-10"
    >
      <SearchCard onClose={onClose}>
        {/* Focus shows as a green underline on the bar rather than a ring round the field, which read as an alert. */}
        <div className="flex h-16 flex-none items-center gap-1 border-b border-line pr-(--gutter-r) pl-2 has-[input:focus-visible]:shadow-[inset_0_-2px_0_var(--color-accent)]">
          <IconButton label="Back to the map" onClick={onClose}>
            <ArrowLeft className="size-6" strokeWidth={2} />
          </IconButton>
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={onFieldKey}
            type="text"
            placeholder="Room code or building"
            aria-label="Room code or building"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            className="h-12 min-w-0 flex-1 rounded-row bg-transparent px-2 text-lg font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
          />
          {query !== '' && (
            <IconButton label="Clear" onClick={clear}>
              <X className="size-6" strokeWidth={2} />
            </IconButton>
          )}
        </div>
        {/* What the list now says, for screen readers: the note, then how many rows. */}
        <p role="status" className="sr-only">
          {view ? statusLine(view) : ''}
        </p>
        <div
          ref={list}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none pt-2 pr-(--gutter-r) pl-(--gutter-l)"
        >
          {/* Wide screens: rows stop at a reading width, so a building's prefix tag stays next to its name. */}
          <div className="md:max-w-140">
            <Body data={data} query={query} view={view} recent={recent} onPick={onPick} />
          </div>
        </div>
      </SearchCard>
    </div>,
    document.body,
  );
}

interface BodyProps {
  data: SearchData;
  query: string;
  view: SearchView | null;
  recent: readonly RecentEntry[];
  onPick: (hit: Hit) => void;
}

const HINT = (
  <p className="py-4 text-ink-2">
    Type a room, like <b className="font-semibold text-ink tabular-nums">ST311</b>, or a building.
  </p>
);

const HEADINGS = { 'did-you-mean': 'Did you mean', buildings: 'Or pick a building' } as const;

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** "ST350 isn't in our list. 2 suggestions." */
function statusLine(view: SearchView): string {
  const rows = view.hits.length;
  const count = rows === 0 ? '' : plural(rows, view.heading === 'did-you-mean' ? 'suggestion' : 'result') + '.';
  return [view.note ? noteText(view.note) : '', count].filter((part) => part !== '').join(' ');
}

/** What's under the bar: Recent or the hint when nothing is typed, then loading, failure, or the results. */
function Body({ data, query, view, recent, onPick }: BodyProps) {
  if (data.status === 'failed') {
    return (
      <div className="py-4">
        <p className="text-ink-2">The rooms couldn&rsquo;t load. Check your connection, then reload.</p>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="mt-3 h-12 cursor-pointer rounded-control border border-line px-4 font-semibold text-accent"
        >
          Reload
        </button>
      </div>
    );
  }
  if (query.trim() === '') {
    const rows = data.status === 'ready' ? resolveRecent(recent, data.index) : [];
    return rows.length > 0 ? <HitList heading="Recent" hits={rows} recent onPick={onPick} /> : HINT;
  }
  if (data.status === 'loading' || !view) return <p className="py-4 text-ink-2">Loading rooms…</p>;
  if (!view.note && view.hits.length === 0) return HINT;
  return (
    <>
      {view.note && <NoteLine note={view.note} />}
      {view.hits.length > 0 && (
        <HitList heading={view.heading ? HEADINGS[view.heading] : undefined} hits={view.hits} onPick={onPick} />
      )}
    </>
  );
}
