/** Home's sheet at peek on first open: one line, no intro cards (user-flows §3.2). Recent rooms replace it in 3c.
 *  Tappable within thumb reach, but plain text rather than a second search box, so the pill stays the one primary
 *  action. The focus ring sits inside the row, because the sheet clips anything outside it. */
export function HomeHint({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] cursor-pointer items-center rounded-row px-2 text-left text-ink-2 focus-visible:-outline-offset-2"
    >
      <span>
        Type a room, like <b className="font-semibold text-ink tabular-nums">ST311</b>
      </span>
    </button>
  );
}
