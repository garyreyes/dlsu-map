import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { MAP_PALETTES } from '@/shared/config/palette';
import type { Campus, CampusBuilding } from '@/shared/data/campus';
import type { Indoor, IndoorFloor } from '@/shared/data/indoor';
import { PreviewScene } from './PreviewScene';
import { RoutePicker } from './RoutePicker';
import { testRoute } from './test-route';
import { usePreviewData } from './usePreviewData';
import { floorName, mainEntrancePoint } from './view';

interface Pick {
  building?: string;
  floor?: number;
}

/** The pick as the URL asked for it (?building=strc&floor=2). What's shown is written back once it's resolved. */
function usePick(): [Pick, (building: string, floor: number) => void] {
  const [pick, setPick] = useState<Pick>(() => {
    const q = new URLSearchParams(location.search);
    const floor = Number(q.get('floor'));
    return {
      building: q.get('building') ?? undefined,
      floor: Number.isInteger(floor) && floor > 0 ? floor : undefined,
    };
  });
  return [
    pick,
    (building, floor) => {
      setPick({ building, floor });
    },
  ];
}

/** P1: pick a building and floor, see it in 3D in its outline, and tell Claude when it looks right. */
export function FloorPreview() {
  const data = usePreviewData();
  const [pick, setPick] = usePick();
  if (data.status === 'loading') return <Centre title="Loading floors…" />;
  if (data.status === 'failed')
    return (
      <Centre
        title={data.what === 'campus' ? "campus.json didn't load" : "A floor file didn't load"}
        line={`Reason: ${data.reason}. Run npm run build (it writes public/data/), then reload.`}
      />
    );
  // A pick that names nothing traced falls back to the first building with floors, then its lowest floor.
  const traced = data.campus.buildings.filter((b) => data.floors.has(b.slug));
  const building = traced.find((b) => b.slug === pick.building) ?? traced[0];
  const indoor = building && data.floors.get(building.slug);
  if (!building || !indoor)
    return (
      <Centre
        title="No floors traced yet"
        line="Trace one with npm run floor-extract, then npm run build, then reload."
      />
    );
  const current = indoor.floors.find((f) => f.floor === pick.floor) ?? indoor.floors[0];
  if (!current) return <Centre title={`${building.short} has a floor file with no floors`} />;
  return (
    <Page
      campus={data.campus}
      floors={data.floors}
      building={building}
      indoor={indoor}
      current={current}
      onPick={setPick}
    />
  );
}

interface PageProps {
  campus: Campus;
  floors: ReadonlyMap<string, Indoor>;
  building: CampusBuilding;
  indoor: Indoor;
  current: IndoorFloor;
  onPick: (building: string, floor: number) => void;
}

function Page({ campus, floors, building, indoor, current, onPick }: PageProps) {
  // The address bar always names what's on screen, fallbacks included, so a reload shows the same floor.
  useEffect(() => {
    history.replaceState(null, '', `?building=${building.slug}&floor=${String(current.floor)}`);
  }, [building.slug, current.floor]);
  const name = `${building.short} ${floorName(building, current.floor)}`;
  // The test route's room, kept per building so switching buildings doesn't route to a code it doesn't have.
  const [picked, setPicked] = useState<{ building: string; code: string }>({ building: '', code: '' });
  const to = picked.building === building.slug ? picked.code : '';
  const start = useMemo(() => mainEntrancePoint(campus, indoor), [campus, indoor]);
  const route = useMemo(() => {
    const room = indoor.rooms.find((r) => r.code === to);
    return room && start !== null ? testRoute(indoor.graph, start, room.doors) : null;
  }, [indoor, to, start]);
  return (
    <div className="fixed inset-0 flex flex-col bg-surface text-ink">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-4 py-3">
        <BuildingPicker
          campus={campus}
          floors={floors}
          value={building.slug}
          onChange={(slug) => {
            onPick(slug, floors.get(slug)?.floors[0]?.floor ?? 1);
          }}
        />
        <FloorChips
          building={building}
          indoor={indoor}
          floor={current.floor}
          onPick={(f) => {
            onPick(building.slug, f);
          }}
        />
        <RoutePicker
          building={building}
          indoor={indoor}
          to={to}
          route={route}
          canStart={start !== null}
          onPick={(code) => {
            setPicked({ building: building.slug, code });
          }}
        />
      </header>
      <Summary name={name} floor={current} />
      <div className="relative min-h-0 flex-1" role="img" aria-label={`3D view of ${name}`}>
        <Canvas flat camera={{ fov: 40, near: 0.5, far: 5000 }}>
          <PreviewScene
            campus={campus}
            building={building}
            indoor={indoor}
            floor={current.floor}
            base={current.base}
            palette={MAP_PALETTES.green}
            route={route}
          />
        </Canvas>
      </div>
    </div>
  );
}

interface PickerProps {
  campus: Campus;
  floors: ReadonlyMap<string, Indoor>;
  value: string;
  onChange: (slug: string) => void;
}

/** Every full-tier building; those with no floor file yet are listed but can't be picked. */
function BuildingPicker({ campus, floors, value, onChange }: PickerProps) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      Building
      <select
        className="h-10 rounded-tag border border-line bg-surface px-2 font-normal"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {campus.buildings
          .filter((b) => b.tier === 'full')
          .map((b) => (
            <option key={b.slug} value={b.slug} disabled={!floors.has(b.slug)}>
              {b.name}
              {floors.has(b.slug) ? '' : ' (no floors traced yet)'}
            </option>
          ))}
      </select>
    </label>
  );
}

/** What's shown, whether it's checked, and the one thing to do next. */
function Summary({ name, floor }: { name: string; floor: IndoorFloor }) {
  return (
    <p className="m-0 border-b border-line px-4 py-2 text-ink-2">
      <span className="font-semibold text-ink">{name}</span> · {floor.walls.length} walls ·{' '}
      {floor.checked ? 'checked' : 'not checked yet'}.{' '}
      {floor.checked
        ? 'It passed your check.'
        : `If the walls sit in the yellow outline, the blue hallway runs down the middle, each code sits in its room with a green dot at its door, stairs (orange) and elevator (violet) are where the sign has them, and the orange main-entrance pin is at the right end (the white arrow points north), tell Claude "${name} looks right".`}
    </p>
  );
}

interface ChipsProps {
  building: CampusBuilding;
  indoor: Indoor;
  floor: number;
  onPick: (floor: number) => void;
}

/** Every storey, lowest first: traced ones can be picked and show ✓ once checked; the rest are greyed out. A traced
 *  floor above OSM's level count still gets a chip. */
function FloorChips({ building, indoor, floor, onPick }: ChipsProps) {
  const top = Math.max(building.levels, ...indoor.floors.map((f) => f.floor));
  const storeys = Array.from({ length: top }, (_, i) => i + 1);
  return (
    <div role="group" aria-label="Floor" className="flex flex-wrap gap-2">
      {storeys.map((n) => {
        const f = indoor.floors.find((x) => x.floor === n);
        const on = n === floor;
        return (
          <button
            key={n}
            type="button"
            disabled={!f}
            title={f ? undefined : 'Not traced yet'}
            aria-pressed={on}
            onClick={() => {
              onPick(n);
            }}
            className={`h-10 min-w-12 cursor-pointer rounded-control border px-3 font-semibold disabled:cursor-default disabled:border-transparent disabled:text-ink-3 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink'}`}
          >
            {floorName(building, n)}
            {f?.checked ? ' ✓' : ''}
            {f ? '' : <span className="sr-only"> (not traced yet)</span>}
          </button>
        );
      })}
    </div>
  );
}

function Centre({ title, line }: { title: string; line?: string }) {
  return (
    <div role="status" className="fixed inset-0 grid place-items-center bg-surface px-8 text-center">
      <div className="max-w-md">
        <p className="m-0 text-lg font-[650] text-ink">{title}</p>
        {line && <p className="mt-1 mb-0 text-ink-2">{line}</p>}
      </div>
    </div>
  );
}
