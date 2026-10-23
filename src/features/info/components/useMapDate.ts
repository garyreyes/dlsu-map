import { useEffect, useState } from 'react';
import { loadCampus } from '@/shared/data/load';

/** The OSM snapshot date of the map on this phone (`YYYY-MM-DD`), or null until campus.json has loaded or if it
 *  can't. It shares the app's one campus.json load. */
export function useMapDate(): string | null {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void loadCampus().then((campus) => {
      if (live && campus.ok) setDate(campus.data.snapshot);
    });
    return () => {
      live = false;
    };
  }, []);
  return date;
}
