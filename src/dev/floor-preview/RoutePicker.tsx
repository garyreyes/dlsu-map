import type { CampusBuilding } from '@/shared/data/campus';
import type { Indoor } from '@/shared/data/indoor';
import type { TestRoute } from './test-route';
import { floorName } from './view';

interface Props {
  building: CampusBuilding;
  indoor: Indoor;
  to: string;
  route: TestRoute | null;
  /** False before G is traced: there's no main entrance to start from. */
  canStart: boolean;
  onPick: (code: string) => void;
}

/** "Test route to" a room, from the main entrance, and what the route does: its time and the floors it passes. */
export function RoutePicker({ building, indoor, to, route, canStart, onPick }: Props) {
  if (indoor.rooms.length === 0) return null;
  const floors = route ? passes(route, indoor).map((f) => floorName(building, f)) : [];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex items-center gap-2 font-semibold">
        Test route to
        <select
          className="h-10 rounded-tag border border-line bg-surface px-2 font-normal"
          value={to}
          disabled={!canStart}
          onChange={(e) => {
            onPick(e.target.value);
          }}
        >
          <option value="">No route</option>
          {indoor.rooms.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code}
            </option>
          ))}
        </select>
      </label>
      <span className="text-ink-2" role="status">
        {!canStart && 'No main entrance yet: trace G first.'}
        {canStart && to && !route && `Nothing joins the main entrance to ${to}.`}
        {route && `${String(Math.round(route.seconds))} s from the main entrance · ${floors.join(' → ')}`}
      </span>
    </div>
  );
}

/** The floors a route passes, in order, each once per visit. */
function passes(route: TestRoute, indoor: Indoor): number[] {
  return route.points.map((p) => indoor.graph.floors[p] ?? 0).filter((f, i, all) => i === 0 || f !== all[i - 1]);
}
