import { useCallback, useMemo, useState } from 'react';
import type { Route } from '@/shared/data/route';
import { clampStep, stepFocus } from '../player';
import type { RouteState } from './useRoute';

/**
 * The step the player is on, and where the map looks for it (D44). The step belongs to its route: ✕ back to the
 * preview and Start again resumes it, while a new From, To or route option is a new route and starts at step 1.
 */
export function useStep(state: RouteState | null) {
  const route = state?.status === 'ready' && state.result.ok ? state.result.route : null;
  const [at, setAt] = useState<{ route: Route | null; index: number }>({ route: null, index: 0 });
  const index = route && at.route === route ? clampStep(route, at.index) : 0;
  const setIndex = useCallback(
    (next: number) => {
      setAt({ route, index: next });
    },
    [route],
  );
  const focus = useMemo(() => (route ? stepFocus(route, index) : null), [route, index]);
  return { route, index, setIndex, focus };
}
