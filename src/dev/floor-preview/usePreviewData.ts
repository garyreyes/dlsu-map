import { useEffect, useState } from 'react';
import type { Campus } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import { loadCampus, loadIndoor, type LoadFailure } from '@/shared/data/load';

export type PreviewData =
  | { status: 'loading' }
  | { status: 'failed'; what: 'campus' | 'floors'; reason: LoadFailure }
  | { status: 'ready'; campus: Campus; floors: ReadonlyMap<string, Indoor> };

/** A building with no floor files has no buildings/<slug>.json: the dev server answers 404, or its index.html. */
const NO_FILE: readonly LoadFailure[] = ['http', 'not-json'];

/** Loads campus.json, then every full-tier building's floor file at once. Buildings with none are left out. */
export function usePreviewData(): PreviewData {
  const [data, setData] = useState<PreviewData>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void (async () => {
      const campus = await loadCampus();
      if (!campus.ok) return { status: 'failed', what: 'campus', reason: campus.reason } as const;
      const slugs = campus.data.buildings.filter((b) => b.tier === 'full').map((b) => b.slug);
      const results = await Promise.all(slugs.map(async (s) => [s, await loadIndoor(s)] as const));
      const broken = results.find(([, r]) => !r.ok && !NO_FILE.includes(r.reason));
      if (broken && !broken[1].ok) return { status: 'failed', what: 'floors', reason: broken[1].reason } as const;
      const floors = new Map(results.flatMap(([s, r]) => (r.ok ? [[s, r.data] as const] : [])));
      return { status: 'ready', campus: campus.data, floors } as const;
    })().then((next) => {
      if (live) setData(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return data;
}
