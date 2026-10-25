// The map's saved choices (v2-0; D57 colour mode, D58 2D/3D, D60 see-through). Both lanes read them: Lane A for the
// palette, blocks and see-through, Lane B for the 2D camera. Saved on this phone only.
// Pure: the localStorage read and write live in useMapSettings.ts. Tests: map-settings.test.ts.
import { z } from '@/shared/data/zod';

export const COLOUR_MODES = ['green', 'black', 'grey'] as const;
export const MAP_VIEWS = ['3d', '2d'] as const;
export const BUILDING_LOOKS = ['solid', 'see-through'] as const;

export type ColourMode = (typeof COLOUR_MODES)[number];
export type MapView = (typeof MAP_VIEWS)[number];
export type BuildingLook = (typeof BUILDING_LOOKS)[number];

export type MapSettings = {
  readonly colour: ColourMode;
  readonly view: MapView;
  readonly buildings: BuildingLook;
};

/** A change to some of the settings. A field can be left out but never set to undefined, which would wipe it. */
export type SettingsPatch<K extends keyof MapSettings> = Pick<MapSettings, K>;

export const DEFAULT_MAP_SETTINGS: MapSettings = { colour: 'green', view: '3d', buildings: 'solid' };

// Each field falls back on its own, so one bad value never resets the other two.
const settingsSchema = z.object({
  colour: z.enum(COLOUR_MODES).catch(DEFAULT_MAP_SETTINGS.colour),
  view: z.enum(MAP_VIEWS).catch(DEFAULT_MAP_SETTINGS.view),
  buildings: z.enum(BUILDING_LOOKS).catch(DEFAULT_MAP_SETTINGS.buildings),
});

/** The settings with a patch applied. A field set to undefined anyway (a cast, plain JS) is left as it was. */
export function applyPatch<K extends keyof MapSettings>(settings: MapSettings, patch: SettingsPatch<K>): MapSettings {
  const defined = Object.entries(patch).filter(([, value]) => value !== undefined);
  return { ...settings, ...Object.fromEntries(defined) };
}

/** What was saved, as settings: anything missing or unreadable is its default, never thrown. */
export function parseMapSettings(saved: string | null): MapSettings {
  if (saved === null) return DEFAULT_MAP_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    return DEFAULT_MAP_SETTINGS;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_MAP_SETTINGS;
  return settingsSchema.parse(data);
}
