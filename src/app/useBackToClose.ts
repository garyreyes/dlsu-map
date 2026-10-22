import { useCallback, useEffect, useId, useRef, useState } from 'react';

const MARK = 'dlsu-overlay';
const DEPTH = 'dlsu-depth';

const state = () => window.history.state as Record<string, unknown> | null;
/** The overlay whose history entry is current, if any. */
const currentEntry = () => state()?.[MARK];
/** How many overlay entries deep history is now: 0 on the page's own entry. */
const currentDepth = () => {
  const depth = state()?.[DEPTH];
  return typeof depth === 'number' ? depth : 0;
};

/**
 * An overlay the phone's back button closes (user-flows §1): opening it adds a history entry, so Back pops that
 * entry instead of leaving the app. Closing it from the UI pops the same entry, so history never piles up. Each
 * overlay marks its entry with its own id, so with two open (search over a building card) Back closes only the top
 * one: the one whose entry was just left. Entries carry their depth too, so an overlay opened while another's Back is
 * still being handled (search closing, then a card and Where are you opening, 5a) isn't taken for the one that closed.
 */
export function useBackToClose() {
  const id = useId();
  const [isOpen, setOpen] = useState(false);
  // Guards against a double tap or a held Escape: a second open would push a second entry, and a second close would
  // pop the page before ours and leave the app.
  const openRef = useRef(false);
  // How deep our entry sits, counted from the page's own entry.
  const depthRef = useRef(0);
  const closingRef = useRef(false);
  // What closeThen runs once our entry has really been popped.
  const thenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onPop = () => {
      // Still at or above our entry means an overlay over this one closed, or one opened; this one stays.
      if (!openRef.current || currentDepth() >= depthRef.current) return;
      openRef.current = false;
      closingRef.current = false;
      setOpen(false);
      const then = thenRef.current;
      thenRef.current = null;
      then?.();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [id]);

  const open = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    depthRef.current = currentDepth() + 1;
    window.history.pushState({ [MARK]: id, [DEPTH]: depthRef.current }, '');
    setOpen(true);
  }, [id]);

  const close = useCallback(() => {
    if (!openRef.current || closingRef.current) return;
    if (currentEntry() === id) {
      closingRef.current = true;
      window.history.back(); // the popstate handler finishes closing
    } else {
      openRef.current = false;
      setOpen(false);
    }
  }, [id]);

  /**
   * Close, then run `then` once this overlay's history entry is gone. history.back() lands later, so an overlay
   * opened straight after close() would push its entry first and be the one that Back pops (search → a card, 3c).
   * While a close is already on its way (a double tap, a held key), further calls are ignored: the first one wins.
   */
  const closeThen = useCallback(
    (then: () => void) => {
      if (closingRef.current) return;
      if (openRef.current && currentEntry() === id) thenRef.current = then;
      close();
      if (thenRef.current !== then) then();
    },
    [id, close],
  );

  return { isOpen, open, close, closeThen };
}
