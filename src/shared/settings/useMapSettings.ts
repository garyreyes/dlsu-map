import { create } from 'zustand';
import {
  applyPatch,
  DEFAULT_MAP_SETTINGS,
  parseMapSettings,
  type MapSettings,
  type SettingsPatch,
} from './map-settings';

/** localStorage key. The format is in PROJECT_FACTS. */
const KEY = 'dlsu-map.map-settings';

// Storage can be missing or throw (private modes, cleared or blocked site data). A failure only means the defaults,
// or a choice that lasts until the app closes.
function read(): MapSettings {
  try {
    return parseMapSettings(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_MAP_SETTINGS;
  }
}

function write(settings: MapSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not remembered this time; the store in memory still updates.
  }
}

/**
 * The map's saved choices (D57, D58, D60), read once on load. A store rather than React state so the map options
 * sheet, the scene and the camera all see one value, and a change re-renders only what reads it.
 */
export const useMapSettings = create<{
  settings: MapSettings;
  set: <K extends keyof MapSettings>(patch: SettingsPatch<K>) => void;
  /** One setting by name, for a sheet that loops over the keys (a computed `{ [key]: value }` won't typecheck). */
  setOne: <K extends keyof MapSettings>(key: K, value: MapSettings[K]) => void;
}>((set, get) => ({
  settings: read(),
  set: (patch) => {
    set({ settings: applyPatch(get().settings, patch) });
    write(get().settings);
  },
  setOne: (key, value) => {
    get().set({ [key]: value } as SettingsPatch<typeof key>);
  },
}));
