import { Check } from 'lucide-react';
import type { OfflineView } from '../status';

const plate = 'inline-flex items-center gap-1.5 rounded-label bg-surface px-2 py-0.5 text-ink-2 shadow-float';

/**
 * O2: a thin line under the search pill while the first copy saves, then "✓ Ready offline" for 3 s (user-flows §4).
 * On a surface plate so it reads over any map colour. The live region stays mounted, so screen readers hear each
 * change. Taps pass through to the map. On wide screens the side panel sits right under the pill, so the line moves
 * to the pill's right, over the open map.
 */
export function SavingLine({ view }: { view: OfflineView }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-full left-0 mt-2 whitespace-nowrap md:top-1/2 md:left-full md:mt-0 md:ml-3 md:-translate-y-1/2"
    >
      {view === 'saving' && <span className={plate}>Saving for offline…</span>}
      {view === 'ready-offline' && (
        <span className={plate}>
          <Check className="size-4 flex-none text-accent" strokeWidth={2.5} aria-hidden />
          Ready offline
        </span>
      )}
    </div>
  );
}
