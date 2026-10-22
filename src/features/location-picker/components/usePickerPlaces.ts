import { useEffect, useState } from 'react';
import { loadCampus } from '@/shared/data/load';
import { pickerPlaces, type PickerPlaces } from '../places';

export type PlacesState = { status: 'loading' } | { status: 'ready'; places: PickerPlaces } | { status: 'failed' };

/** The buildings and gates Where are you offers, from campus.json (the same load as the map and search). */
export function usePickerPlaces(): PlacesState {
  const [state, setState] = useState<PlacesState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    void loadCampus().then((campus) => {
      if (live) setState(campus.ok ? { status: 'ready', places: pickerPlaces(campus.data) } : { status: 'failed' });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
