import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Sheet } from 'react-modal-sheet';
import { useReducedMotion } from './useMediaQuery';

interface Props {
  label: string;
  children: ReactNode;
  /** The sheet's visible height in px, so map buttons, the credit and the camera framing can sit above it. */
  onVisibleHeight: (px: number) => void;
}

const SNAP = { ease: [0.16, 1, 0.3, 1] as const, duration: 0.26 };
const noop = () => undefined;

/**
 * The phone bottom sheet (DESIGN.md, Sheet snaps). Always open and never dismissed: it is the screen's navigation.
 * It sizes to its content (Home's peek is one hint row). With one snap there is nothing to drag between, so dragging
 * stays off until half and full arrive with the screens that need them (3d).
 */
export function BottomSheet({ label, children, onVisibleHeight }: Props) {
  const reduced = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const report = () => {
      onVisibleHeight(el.getBoundingClientRect().height);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [onVisibleHeight]);

  return (
    <Sheet
      isOpen
      onClose={noop}
      disableDismiss
      disableDrag
      disableScrollLocking
      detent="content"
      snapPoints={[0, 1]}
      initialSnap={1}
      prefersReducedMotion={reduced}
      tweenConfig={SNAP}
      style={{ zIndex: 4 }}
    >
      <Sheet.Container ref={container} unstyled aria-label={label} className="rounded-t-sheet bg-surface shadow-sheet">
        {/* The 24px handle zone. A plain spacer for now: Sheet.Header with no children draws the library's own grab
            bar, and with dragging off (until 3d) that would promise a drag that does nothing. */}
        <div className="h-6" aria-hidden />
        <Sheet.Content
          unstyled
          className="px-(--gutter-r) pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pl-(--gutter-l)"
        >
          {children}
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

/** Wide screens: the same content in a 400px card at the left, 72px from the top (DESIGN.md, Layout). */
export function SidePanel({ label, children }: Omit<Props, 'onVisibleHeight'>) {
  return (
    <section
      aria-label={label}
      className="fixed top-18 left-(--gutter-l) z-4 max-h-[calc(100%-88px)] w-100 overflow-y-auto rounded-sheet bg-surface px-4 pt-3 pb-4 shadow-float"
    >
      {children}
    </section>
  );
}
