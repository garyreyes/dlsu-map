import { useEffect, useState } from 'react';
import { loadCampus } from '@/shared/data/load';
import { placeNames, type PlaceNames } from '../steps-list';

/** How buildings, floors and gates are named, from campus.json (the same load as the map), or null until it's in.
 *  The route preview's chips use it, so they don't wait for the building files the route needs. */
export function usePlaceNames(): PlaceNames | null {
  const [names, setNames] = useState<PlaceNames | null>(null);
  useEffect(() => {
    let live = true;
    void loadCampus().then((campus) => {
      if (live && campus.ok) setNames(placeNames(campus.data));
    });
    return () => {
      live = false;
    };
  }, []);
  return names;
}
