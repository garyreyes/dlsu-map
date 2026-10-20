import { Search } from 'lucide-react';

/** The screen's primary action at home: a white 52px pill that opens search (DESIGN.md, Search pill). The Beta
 *  tag stays in it until public launch (D19). The ⓘ button joins it with the info sheet (10b). */
export function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-13 items-center rounded-pill bg-surface shadow-float">
      <button
        type="button"
        aria-label="Search for a room or building"
        onClick={onOpen}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-pill pl-4 text-left"
      >
        <Search className="size-6 flex-none text-accent" strokeWidth={2} aria-hidden />
        <span className="truncate text-ink-2">Where to?</span>
      </button>
      <span className="mr-3 ml-2 rounded-tag bg-accent-wash px-1.5 py-0.5 text-sm font-semibold tracking-[0.02em] text-accent">
        Beta
      </span>
    </div>
  );
}
