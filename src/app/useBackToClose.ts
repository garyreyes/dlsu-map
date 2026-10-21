import { useCallback, useEffect, useId, useRef, useState } from 'react';

const MARK = 'dlsu-overlay';

/** The overlay whose history entry is current, if any. */
const currentEntry = () => (window.history.state as Record<string, unknown> | null)?.[MARK];

/**
 * An overlay the phone's back button closes (user-flows §1): opening it adds a history entry, so Back pops that
 * entry instead of leaving the app. Closing it from the UI pops the same entry, so history never piles up. Each
 * overlay marks its entry with its own id, so with two open (search over a building card) Back closes only the top
 * one: the one whose entry was just left.
 */
export function useBackToClose() {
  const id = useId();
  const [isOpen, setOpen] = useState(false);
  // Guards against a double tap or a held Escape: a second open would push a second entry, and a second close would
  // pop the page before ours and leave the app.
  const openRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      // Back to our own entry means an overlay above this one closed; this one stays.
      if (!openRef.current || currentEntry() === id) return;
      openRef.current = false;
      closingRef.current = false;
      setOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, [id]);

  const open = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    window.history.pushState({ [MARK]: id }, '');
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

  return { isOpen, open, close };
}
