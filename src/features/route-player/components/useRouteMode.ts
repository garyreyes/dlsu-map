import { useCallback, useState } from 'react';
import type { FloorMode, From, To } from '@/shared/data/route';

/**
 * Stairs, Auto or Elevator for this trip only (user-flows §3.6): a new From or To starts on Auto again. The saved
 * avoid-stairs setting is a separate thing, for later (PLAN §6.4).
 */
export function useRouteMode(from: From | null, to: To | null): [FloorMode, (mode: FloorMode) => void] {
  const [chosen, setChosen] = useState<{ from: From | null; to: To | null; mode: FloorMode } | null>(null);
  const mode = chosen?.from === from && chosen.to === to ? chosen.mode : 'auto';
  const choose = useCallback(
    (next: FloorMode) => {
      setChosen({ from, to, mode: next });
    },
    [from, to],
  );
  return [mode, choose];
}
