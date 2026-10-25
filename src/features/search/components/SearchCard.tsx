import { useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useIsWide, useReducedMotion } from '@/shared/ui/useMediaQuery';
import { useVisibleArea, type VisibleArea } from '@/shared/ui/useVisibleArea';
import { cardTop } from '../card-top';

/** A double tap on the pill lands its second tap on the dim; taps in the first 350ms after opening are ignored. */
const TAP_GUARD_MS = 350;

/** The card eases up from below, like the bottom sheet (--ease-snap). The dim fades in with it. */
const SLIDE = { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' } as const;

/** Wide: the panel's top (md:top-18) and the gap it keeps above the visible bottom (a keyboard on a landscape phone). */
const WIDE_TOP = 72;
const WIDE_GAP = 16;

/** Phone: on the keyboard, its top a third down the visible area, and never under the notch. */
function phoneStyle(area: VisibleArea): CSSProperties {
  return {
    top: `max(env(safe-area-inset-top, 0px), ${String(area.top + cardTop(area.height))}px)`,
    bottom: area.inset,
    paddingBottom: area.inset === 0 ? 'env(safe-area-inset-bottom, 0px)' : 0,
  };
}

/** Wide: at most 70% of the screen, and never under the keyboard. */
function wideStyle(area: VisibleArea): CSSProperties {
  return { maxHeight: `min(70vh, ${String(area.top + area.height - WIDE_TOP - WIDE_GAP)}px)` };
}

/**
 * Search's frame (D55): a light dim over the map, which closes search when tapped, and a card over it. On a phone the
 * card sits on top of the keyboard with a fixed top edge; on wide screens it floats under the search pill. It only
 * draws; the dialog, focus and keys belong to SearchScreen. The dim is aria-hidden and unfocusable: Back is the
 * accessible close.
 */
export function SearchCard({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const wide = useIsWide();
  const reduced = useReducedMotion();
  const area = useVisibleArea();
  const dim = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const firstLook = useRef({ wide, reduced });

  // Once, before the first paint: a later rotation or resize across the wide breakpoint doesn't replay it.
  useLayoutEffect(() => {
    openedAt.current = performance.now();
    if (firstLook.current.reduced) return;
    const isWide = firstLook.current.wide;
    dim.current?.animate([{ opacity: 0 }, { opacity: 1 }], SLIDE);
    card.current?.animate(
      [
        { transform: isWide ? 'translateY(-8px)' : 'translateY(100%)', opacity: isWide ? 0 : 1 },
        { transform: 'none', opacity: 1 },
      ],
      SLIDE,
    );
  }, []);

  // The tap's own time, not when it's handled: a busy first moment can't let a queued second tap close search.
  const onDimTap = (e: MouseEvent) => {
    if (e.timeStamp - openedAt.current > TAP_GUARD_MS) onClose();
  };

  return (
    <>
      {/* black at 20%: enough to say "map is behind this" while still showing it */}
      <div ref={dim} aria-hidden="true" onClick={onDimTap} className="absolute inset-0 bg-black/20" />
      <div
        ref={card}
        style={wide ? wideStyle(area) : phoneStyle(area)}
        className="absolute inset-x-0 flex flex-col overflow-hidden rounded-t-sheet bg-surface shadow-sheet md:inset-x-auto md:top-18 md:bottom-auto md:left-(--gutter-l) md:w-100 md:max-w-[calc(100%-2*var(--gutter-l))] md:rounded-sheet"
      >
        {children}
      </div>
    </>
  );
}
