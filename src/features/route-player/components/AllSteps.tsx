import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { From, Route, To } from '@/shared/data/route';
import { SecondaryButton } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { emptyRouteLine, stepGroups, totalsLine, tripLine, type PlaceNames } from '../steps-list';
import { StepIcon } from './StepIcon';

interface Props {
  route: Route;
  from: From;
  to: To;
  names: PlaceNames;
  /** The step the player is on, in `route.steps`. */
  current: number;
  onPick: (index: number) => void;
  /** "Change where I am": reopens Where are you (S4). Shown only when given. */
  onChangeFrom?: (() => void) | undefined;
  onClose: () => void;
}

/**
 * S8 All steps (user-flows §3.7), which is also the text-only mode's list (S11): the trip and its totals, then every
 * step grouped by place. Tapping a step makes it the current one. Closes with ✕ or Escape; the parent wires Back.
 * No three.js here, so it works when 3D doesn't.
 */
export function AllSteps({ route, from, to, names, current, onPick, onChangeFrom, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An overlay on top (search, in 5d) that handles Escape prevents its default, so only the top one closes.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const groups = stepGroups(route, names);
  return (
    <section aria-label="All steps" className="pb-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-lg font-[650] text-ink">All steps</h2>
          <p className="mt-1 font-semibold text-ink tabular-nums">{tripLine(from, to, names)}</p>
          {groups.length > 0 && <p className="text-ink-2 tabular-nums">{totalsLine(route)}</p>}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      {onChangeFrom && (
        <div className="mt-2">
          <SecondaryButton onClick={onChangeFrom}>Change where I am</SecondaryButton>
        </div>
      )}
      {groups.length === 0 ? (
        <p className="mt-4 text-ink-2">{emptyRouteLine(to, names)}</p>
      ) : (
        // Phones: the sheet sizes to its content, so a long route scrolls inside the list instead.
        <div className="-mx-2 mt-2 max-h-[55dvh] overflow-y-auto md:max-h-none">
          {groups.map((group) => (
            <div key={group.rows[0]?.index} role="group" aria-label={group.label}>
              <p className="px-2 pt-2 pb-1 font-semibold text-ink-2 tabular-nums" aria-hidden>
                {group.label}
              </p>
              {/* Safari drops list semantics from an unstyled list unless the role is set again. */}
              <ol role="list" className="list-none">
                {group.rows.map((row) => {
                  const isCurrent = row.index === current;
                  return (
                    <li key={row.index}>
                      <button
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        onClick={() => {
                          onPick(row.index);
                        }}
                        className={`flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-row px-2 py-1.5 text-left hover:bg-surface-2 ${isCurrent ? 'bg-surface-2' : ''}`}
                      >
                        <span className={isCurrent ? 'text-accent' : 'text-ink-3'}>
                          <StepIcon icon={row.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-ink">{row.title}</span>
                          {row.subtitle !== undefined && (
                            <span className="block text-ink-2 tabular-nums">{row.subtitle}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
