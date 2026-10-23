import { useEffect, useState } from 'react';
import type { Indoor } from '@/shared/data/indoor';
import { loadIndoor } from '@/shared/data/load';

/** The building file while Change spot needs its stairs and elevators: loading, or missing (offline, no file yet). */
export type SpotFile = { status: 'loading' } | { status: 'ready'; file: Indoor } | { status: 'missing' };

/** Loads one building's file when the floor step opens (the same shared load the indoor view and router use). */
export function useBuildingSpots(slug: string): SpotFile {
  const [state, setState] = useState<{ slug: string; result: SpotFile } | null>(null);
  useEffect(() => {
    let live = true;
    void loadIndoor(slug).then((r) => {
      if (live) setState({ slug, result: r.ok ? { status: 'ready', file: r.data } : { status: 'missing' } });
    });
    return () => {
      live = false;
    };
  }, [slug]);
  return state?.slug === slug ? state.result : { status: 'loading' };
}
