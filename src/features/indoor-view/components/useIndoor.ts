import { useEffect, useState } from 'react';
import type { Indoor } from '@/shared/data/indoor';
import { loadIndoor, peekIndoor, type LoadFailure } from '@/shared/data/load';

export type IndoorState =
  { status: 'loading' } | { status: 'ready'; indoor: Indoor } | { status: 'failed'; reason: LoadFailure };

type Settled = Exclude<IndoorState, { status: 'loading' }>;

/** Loads one building's floor file. A file that's already loaded (or preloaded) is ready on the same render; else
 *  switching buildings reads as loading until the new file has arrived. No slug loads nothing and stays loading. */
export function useIndoor(slug: string | null): IndoorState {
  const [settled, setSettled] = useState<{ slug: string; state: Settled }>();
  useEffect(() => {
    if (slug === null) return;
    let live = true;
    void loadIndoor(slug).then((result) => {
      if (!live) return;
      const state: Settled = result.ok
        ? { status: 'ready', indoor: result.data }
        : { status: 'failed', reason: result.reason };
      setSettled({ slug, state });
    });
    return () => {
      live = false;
    };
  }, [slug]);
  if (slug === null) return { status: 'loading' };
  const loaded = peekIndoor(slug);
  if (loaded) return { status: 'ready', indoor: loaded };
  return settled?.slug === slug ? settled.state : { status: 'loading' };
}
