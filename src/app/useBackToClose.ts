import { useCallback, useEffect, useRef, useState } from 'react';

const MARK = 'dlsu-overlay';

/**
 * An overlay the phone's back button closes (user-flows §1): opening it adds a history entry, so Back pops that
 * entry instead of leaving the app. Closing it from the UI pops the same entry, so history never piles up.
 */
export function useBackToClose() {
  const [isOpen, setOpen] = useState(false);
  // Guards against a double tap or a held Escape: a second open would push a second entry, and a second close would
  // pop the page before ours and leave the app.
  const openRef = useRef(false);
  const closingRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      openRef.current = false;
      closingRef.current = false;
      setOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const open = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    window.history.pushState({ [MARK]: true }, '');
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current || closingRef.current) return;
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[MARK] === true) {
      closingRef.current = true;
      window.history.back(); // the popstate handler finishes closing
    } else {
      openRef.current = false;
      setOpen(false);
    }
  }, []);

  return { isOpen, open, close };
}
