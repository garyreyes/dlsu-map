import { useEffect, useState } from 'react';
import type { Indoor } from '@/shared/data/indoor';
import { loadIndoor, type LoadFailure } from '@/shared/data/load';

export type IndoorState =
  { status: 'loading' } | { status: 'ready'; indoor: Indoor } | { status: 'failed'; reason: LoadFailure };

type Settled = Exclude<IndoorState, { status: 'loading' }>;

/** Loads one building's floor file. Switching buildings reads as loading until the new file has arrived. No slug
 *  loads nothing and stays loading. */
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
  return slug !== null && settled?.slug === slug ? settled.state : { status: 'loading' };
}
