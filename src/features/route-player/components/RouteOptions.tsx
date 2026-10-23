import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { Entrance } from '@/shared/data/campus';
import type { Doors, FloorMode, From, Route } from '@/shared/data/route';
import { Chip } from '@/shared/ui/Button';
import { Segmented } from '@/shared/ui/Segmented';
import { exitChoices, takenLine, type ExitChoices } from '../exits';
import type { PlaceNames } from '../steps-list';

const MODES = [
  { value: 'stairs', label: 'Stairs' },
  { value: 'auto', label: 'Auto' },
  { value: 'elevator', label: 'Elevator' },
] as const;

interface Props {
  route: Route;
  from: From;
  names: PlaceNames;
  entrances: readonly Entrance[];
  mode: FloorMode;
  onMode: (mode: FloorMode) => void;
  doors: Doors | undefined;
  onExit: (exit: number | undefined) => void;
}

/**
 * Route options (user-flows §3.6), folded away until wanted. Shown when the route changes floor (Stairs, Auto,
 * Elevator) or has an exit choice (which door to leave by). A choice re-routes at once.
 */
export function RouteOptions({ route, from, names, entrances, mode, onMode, doors, onExit }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const floors = route.legs.some((l) => l.kind === 'floors');
  const exits = exitChoices(route, from, entrances);
  if (!floors && exits === null) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="-mx-2 flex h-12 cursor-pointer items-center gap-1 rounded-row px-2 font-semibold text-ink-2 hover:bg-surface-2"
      >
        Route options
        <ChevronDown className={`size-5 ${open ? 'rotate-180' : ''}`} strokeWidth={2} aria-hidden />
      </button>
      <div id={panel} hidden={!open} className="pt-1">
        {floors && (
          <>
            <Segmented label="Stairs or elevator" options={MODES} value={mode} onChange={onMode} />
            <p className="mt-2 text-ink-2">Auto takes the elevator for 3 or more floors.</p>
          </>
        )}
        {exits && <ExitChips choices={exits} names={names} exit={doors?.exit} onExit={onExit} />}
      </div>
    </div>
  );
}

interface ExitProps {
  choices: ExitChoices;
  names: PlaceNames;
  exit: number | undefined;
  onExit: (exit: number | undefined) => void;
}

/** "Leave Velasco by": Quickest, then one chip per door. Exactly one is pressed. */
function ExitChips({ choices, names, exit, onExit }: ExitProps) {
  const taken = takenLine(choices, exit);
  return (
    <div className="mt-2">
      <h3 className="pt-2 pb-1 font-semibold text-ink-2">Leave {names.short(choices.building)} by</h3>
      <div className="flex flex-wrap gap-2">
        <Chip
          pressed={exit === undefined}
          onClick={() => {
            onExit(undefined);
          }}
        >
          Quickest
        </Chip>
        {choices.doors.map((d) => (
          <Chip
            key={d.entrance}
            pressed={exit === d.entrance}
            onClick={() => {
              onExit(d.entrance);
            }}
          >
            {d.label}
          </Chip>
        ))}
      </div>
      {taken !== null && <p className="mt-2 text-ink-2">{taken}</p>}
    </div>
  );
}
