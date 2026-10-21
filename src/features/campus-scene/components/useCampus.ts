import { useEffect, useState } from 'react';
import type { Campus } from '@/shared/data/campus';
import { loadCampus, type LoadFailure } from '@/shared/data/load';

export type CampusState =
  { status: 'loading' } | { status: 'ready'; campus: Campus } | { status: 'failed'; reason: LoadFailure };

/** Loads campus.json once. The map shows nothing of the campus until the whole file has arrived and checked out. */
export function useCampus(): CampusState {
  const [state, setState] = useState<CampusState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void loadCampus().then((result) => {
      if (!live) return;
      setState(result.ok ? { status: 'ready', campus: result.data } : { status: 'failed', reason: result.reason });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
