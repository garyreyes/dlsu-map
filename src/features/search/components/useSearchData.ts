import { useEffect, useState } from 'react';
import { loadCampus, loadRooms } from '@/shared/data/load';
import { buildSearchIndex, type SearchIndex } from '../search-index';

export type SearchData = { status: 'loading' } | { status: 'ready'; index: SearchIndex } | { status: 'failed' };

/**
 * Loads rooms.json and campus.json's buildings for search, at app start rather than when search opens, so Recent
 * shows on home and S2 is ready by the first tap (user-flows §3.2). The map shares the same campus.json load.
 */
export function useSearchData(): SearchData {
  const [data, setData] = useState<SearchData>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void Promise.all([loadRooms(), loadCampus()]).then(([rooms, campus]) => {
      if (!live) return;
      setData(
        rooms.ok && campus.ok
          ? { status: 'ready', index: buildSearchIndex(rooms.data.rooms, campus.data.buildings) }
          : { status: 'failed' },
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return data;
}
