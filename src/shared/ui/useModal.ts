import { useEffect, type RefObject } from 'react';

/**
 * Makes a full-screen dialog really modal: everything else on the page is `inert` (no Tab, no screen reader) while it
 * is open, and focus goes back to whatever opened it when it closes. The dialog must be a direct child of <body>
 * (render it through a portal).
 */
export function useModal(dialogRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const others = [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== dialog && !el.inert,
    );
    for (const el of others) el.inert = true;
    return () => {
      for (const el of others) el.inert = false;
      opener?.focus();
    };
  }, [dialogRef]);
}
