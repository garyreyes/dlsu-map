import { Search } from 'lucide-react';

/** Home's sheet at peek on first open: one line, no intro cards (user-flows §3.2). Recent rooms replace it in 3c. */
export function HomeHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3 text-left text-ink-2"
    >
      <Search className="size-6 flex-none text-ink-3" strokeWidth={2} aria-hidden />
      <span>
        Type a room, like <b className="font-semibold text-ink tabular-nums">ST311</b>
      </span>
    </button>
  );
}
