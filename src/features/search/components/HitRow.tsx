import { Building2, DoorOpen, History } from 'lucide-react';
import { useId } from 'react';
import type { Hit, SearchNote } from '../search-results';

const hitKey = (hit: Hit) => (hit.kind === 'room' ? `room:${hit.code}` : `building:${hit.building.slug}`);

interface ListProps {
  /** The section label above the rows ("Recent", "Did you mean"), if any. */
  heading?: string | undefined;
  hits: readonly Hit[];
  /** Recent rows get the clock icon. */
  recent?: boolean;
  onPick: (hit: Hit) => void;
}

/**
 * Rows of results (DESIGN.md, Lists and rows): 56px buttons under a 16px Mid Ink label, bleeding 8px past the gutter
 * so the hover fill lines up with the text, no dividers. The focus ring sits inside the row, where nothing clips it.
 */
export function HitList({ heading, hits, recent = false, onPick }: ListProps) {
  const id = useId();
  return (
    <section aria-labelledby={heading === undefined ? undefined : id}>
      {heading !== undefined && (
        <h2 id={id} className="pt-2 pb-1 font-semibold text-ink-2">
          {heading}
        </h2>
      )}
      <ul role="list" className="-mx-2 list-none">
        {hits.map((hit) => (
          <li key={hitKey(hit)}>
            <button
              type="button"
              data-hit
              onClick={() => {
                onPick(hit);
              }}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-row px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:-outline-offset-2"
            >
              <HitContent hit={hit} recent={recent} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One result's insides: a Soft Ink icon, a semibold title over a Mid Ink line, and for a building its prefix as a
 * code tag at the end. A room typed with an alias says so ("Also written C311"). Recent rows get the clock icon.
 */
function HitContent({ hit, recent = false }: { hit: Hit; recent?: boolean }) {
  const Icon = recent ? History : hit.kind === 'room' ? DoorOpen : Building2;
  return (
    <>
      <Icon className="size-6 flex-none text-ink-3" strokeWidth={2} aria-hidden />
      {hit.kind === 'room' ? (
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink tabular-nums">{hit.code}</span>
          <span className="block text-ink-2 tabular-nums">
            {hit.name} · {hit.building.short} {hit.floorLabel}
          </span>
          {hit.typedAs && <span className="block text-ink-3 tabular-nums">Also written {hit.typedAs}</span>}
        </span>
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{hit.building.short}</span>
            {hit.building.name !== hit.building.short && <span className="block text-ink-2">{hit.building.name}</span>}
          </span>
          <span className="flex-none rounded-tag bg-surface-2 px-[7px] py-0.5 font-bold text-ink-2">
            {hit.building.prefix}
          </span>
        </>
      )}
    </>
  );
}

/** A note's words, shared by the line on screen and the screen-reader status. */
export function noteText(note: SearchNote): string {
  switch (note.kind) {
    case 'not-in-list':
      return `${note.code} isn’t in our list.`;
    case 'unknown-prefix':
      return `No building uses ${note.prefix}.`;
    case 'no-room-list':
      return `${note.building.name}’s rooms aren’t in the app yet.`;
    case 'not-searchable':
      return `${note.building.name} isn’t in search yet.`;
    case 'no-match':
      return `Nothing matches “${note.typed}”. Search by room code, like ST311, or a building.`;
  }
}

/** The one line above the rows, when there is one. Rejected codes are Signal Red (DESIGN.md); the rest Mid Ink. */
export function NoteLine({ note }: { note: SearchNote }) {
  const rejected = note.kind === 'not-in-list' || note.kind === 'unknown-prefix';
  return (
    <p className={`py-3 tabular-nums ${rejected ? 'font-semibold text-danger' : 'text-ink-2'}`}>{noteText(note)}</p>
  );
}
