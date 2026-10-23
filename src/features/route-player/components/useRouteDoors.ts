import { useCallback, useMemo, useState } from 'react';
import type { Doors, From, To } from '@/shared/data/route';

/**
 * The door to leave From's building by, for this trip only (user-flows §3.6): a new From or To starts on Quickest again
 * (undefined), like `useRouteMode`.
 */
export function useRouteDoors(
  from: From | null,
  to: To | null,
): [Doors | undefined, (exit: number | undefined) => void] {
  const [chosen, setChosen] = useState<{ from: From | null; to: To | null; exit: number } | null>(null);
  const exit = chosen?.from === from && chosen.to === to ? chosen.exit : undefined;
  const choose = useCallback(
    (next: number | undefined) => {
      setChosen(next === undefined ? null : { from, to, exit: next });
    },
    [from, to],
  );
  // One object per choice, so the route isn't worked out again on every render.
  const doors = useMemo((): Doors | undefined => (exit === undefined ? undefined : { exit }), [exit]);
  return [doors, choose];
}
