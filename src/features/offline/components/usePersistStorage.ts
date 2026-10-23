import { useEffect, useRef } from 'react';

/**
 * Once the first offline copy is saved, ask the browser to keep it (D10): without this, a phone short on space may
 * clear the copy. Asked once per page, and only if it isn't already granted. The browser may say no; nothing to show.
 */
export function usePersistStorage(saved: boolean): void {
  const asked = useRef(false);
  useEffect(() => {
    if (!saved || asked.current) return;
    asked.current = true;
    // Older browsers lack these; the types say they always exist, so widen them to "maybe missing".
    const storage = navigator.storage as Partial<StorageManager> | undefined;
    const { persist, persisted } = storage ?? {};
    if (!persist || !persisted) return;
    persisted
      .call(storage)
      .then((already) => (already ? undefined : persist.call(storage)))
      .catch(() => {
        // Not granted or not supported here; the copy still works, it just isn't protected.
      });
  }, [saved]);
}
