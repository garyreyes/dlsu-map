import { ChevronLeft, Ellipsis, List, MapPinned, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Route } from '@/shared/data/route';
import { PrimaryButton } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { stepCard } from '../player';
import type { PlaceNames } from '../steps-list';
import { StepIcon } from './StepIcon';
import { useSwipe } from './useSwipe';

interface Props {
  route: Route;
  /** Buildings whose indoor map is still saving (offline), so their steps say so (O5). */
  stillSaving?: readonly string[];
  /** The buildings' floor labels, for "follow signs to G" on those steps. Without them the floor reads "3F". */
  names?: Pick<PlaceNames, 'floor'>;
  /** The step on the card, in `route.steps`. */
  current: number;
  onStep: (index: number) => void;
  /** "I'm here" on the last step: opens Arrived (S9). */
  onArrive: () => void;
  /** ⋯ Change where I am: reopens Where are you (S4). */
  onChangeFrom: () => void;
  /** ⋯ All steps: opens S8. */
  onAllSteps: () => void;
  onClose: () => void;
}

/**
 * S6 Steps (user-flows §3.7): one step at a time, Next under the thumb and Back beside it. A sideways swipe or ← →
 * does the same. ✕ ends the route at once, with no "Are you sure?"; ⋯ folds out the two ways off the route. Closes
 * with Escape too; the parent wires Back.
 */
export function StepPlayer({
  route,
  stillSaving,
  names,
  current,
  onStep,
  onArrive,
  onChangeFrom,
  onAllSteps,
  onClose,
}: Props) {
  const [menu, setMenu] = useState(false);
  const menuId = useId();
  const card = stepCard(route, current, stillSaving, names);
  const last = card?.last ?? true;
  const next = () => {
    if (!last) onStep(current + 1);
  };
  const back = () => {
    if (current > 0) onStep(current - 1);
  };
  // Arriving is said only by tapping "I'm here": a stray swipe or → on the last step does nothing.
  const swipe = useSwipe(next, back);
  useStepKeys(next, back, onClose);

  if (!card) return null;
  return (
    <section aria-label="Steps" className="touch-pan-y pb-2" {...swipe}>
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 font-semibold text-ink-2 tabular-nums" aria-live="polite">
          {card.counter}
        </p>
        <button
          type="button"
          aria-label="More"
          aria-expanded={menu}
          aria-controls={menuId}
          onClick={() => {
            setMenu((m) => !m);
          }}
          className="grid size-12 flex-none cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2"
        >
          <Ellipsis className="size-6" strokeWidth={2} aria-hidden />
        </button>
        <IconButton label="End route" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      <div id={menuId} hidden={!menu} className="-mx-2">
        <MenuRow icon={<MapPinned className="size-6" strokeWidth={2} aria-hidden />} onClick={onChangeFrom}>
          Change where I am
        </MenuRow>
        <MenuRow icon={<List className="size-6" strokeWidth={2} aria-hidden />} onClick={onAllSteps}>
          All steps
        </MenuRow>
      </div>
      <div className="mt-2 flex items-start gap-3.5">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-accent-wash text-accent">
          <StepIcon icon={card.icon} />
        </span>
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 className="text-[22px] leading-tight font-[650] text-ink">{card.title}</h2>
          {card.subtitle !== undefined && <p className="mt-1 text-ink-2 tabular-nums">{card.subtitle}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        {/* aria-disabled rather than disabled, so keyboard focus stays put when Back reaches step 1. */}
        <button
          type="button"
          aria-label="Back"
          aria-disabled={card.first}
          onClick={back}
          className="mt-2 grid h-13 w-16 flex-none cursor-pointer place-items-center rounded-pill border border-line text-accent hover:bg-surface-2 aria-disabled:cursor-default aria-disabled:opacity-45 aria-disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-6" strokeWidth={2.25} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <PrimaryButton onClick={last ? onArrive : next}>{last ? 'I’m here' : 'Next'}</PrimaryButton>
        </div>
      </div>
    </section>
  );
}

function MenuRow({ icon, onClick, children }: { icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-row px-2 text-left font-semibold text-ink hover:bg-surface-2"
    >
      <span className="text-ink-3">{icon}</span>
      {children}
    </button>
  );
}

/** ← and → step, Escape ends the route. Ignored while typing, and when an overlay on top already took the key. */
function useStepKeys(next: () => void, back: () => void, close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [next, back, close]);
}
