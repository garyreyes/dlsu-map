import { useEffect, useRef } from 'react';
import { readDeepLink, resolveDeepLink, type DeepLink, type SearchData } from '@/features/search';

// Read once, when the app loads (D40). The dev link (`?from=…&to=…`, 5c) has its own reader and wins in dev.
const DEV_LINK = import.meta.env.DEV && new URLSearchParams(window.location.search).has('from');
const LINK = DEV_LINK ? null : readDeepLink(window.location.search);

/**
 * The deep link `?to=ST311` (user-flows §3.9, D40): taken out of the address bar at once, so a reload or a later
 * share starts clean, then opened once the room list is ready. If the list can't load, S2 opens with the text typed
 * and says so itself.
 */
export function useDeepLink(data: SearchData, open: (link: DeepLink) => void) {
  const pending = useRef(LINK);

  useEffect(() => {
    if (LINK === null) return;
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, '', pathname + hash);
  }, []);

  useEffect(() => {
    const text = pending.current;
    if (text === null || data.status === 'loading') return;
    pending.current = null;
    open(data.status === 'ready' ? resolveDeepLink(text, data.index) : { kind: 'search', text });
  }, [data, open]);
}
