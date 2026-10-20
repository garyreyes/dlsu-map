import { Check, CloudOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OfflineView } from '../status';

const plate = 'inline-flex items-start gap-1.5 rounded-label bg-surface px-2 py-0.5 text-ink-2 shadow-float';
const icon = 'mt-0.5 size-4 flex-none';

/** The words for each line. "Ready offline" is the one confirmation; the rest say what isn't saved and what happens. */
const LINES: Partial<Record<OfflineView, { text: string; mark?: ReactNode }>> = {
  saving: { text: 'Saving for offline…' },
  'saving-paused': {
    text: "Saving paused. It finishes when you're back online.",
    mark: <CloudOff className={`${icon} text-ink-3`} strokeWidth={2} aria-hidden />,
  },
  'ready-offline': {
    text: 'Ready offline',
    mark: <Check className={`${icon} text-accent`} strokeWidth={2.5} aria-hidden />,
  },
  'not-saved': {
    text: 'Not saved for offline. It tries again next time you open it.',
    mark: <CloudOff className={`${icon} text-ink-3`} strokeWidth={2} aria-hidden />,
  },
  'cannot-save': {
    text: "This browser can't save the map for offline. Open it in a normal (not private) Safari or Chrome tab.",
    mark: <CloudOff className={`${icon} text-ink-3`} strokeWidth={2} aria-hidden />,
  },
};

/**
 * O2 and its failures: one line under the search pill (user-flows §4). "Saving for offline…", then "✓ Ready offline"
 * for 3 s; or, when the copy isn't made, a line that stays and says so. On a surface plate so it reads over any map
 * colour. The live region stays mounted, so screen readers hear each change. Taps pass through to the map. On wide
 * screens the side panel sits right under the pill, so the line moves to the pill's right, over the open map.
 */
export function SavingLine({ view }: { view: OfflineView }) {
  const line = LINES[view];
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-full left-0 mt-2 md:top-1/2 md:left-full md:mt-0 md:ml-3 md:w-80 md:-translate-y-1/2"
    >
      {line && (
        <span className={plate}>
          {line.mark}
          {line.text}
        </span>
      )}
    </div>
  );
}
