import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { Entrance } from '@/shared/data/campus';
import type { Doors, FloorMode, From, Route } from '@/shared/data/route';
import type { OnSpotLabels } from '@/shared/data/spot-labels';
import { Chip } from '@/shared/ui/Button';
import { Segmented } from '@/shared/ui/Segmented';
import { exitChips, exitChoices, type ExitChoices } from '../exits';
import { exitSpotLabels } from '../spot-labels';
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
  /** The doors the exit chips offer, to be named on the map while they show; [] when they don't (8▸ critique). */
  onSpotLabels?: OnSpotLabels;
}

/**
 * Route options (user-flows §3.6), folded away until wanted. Shown when the route changes floor (Stairs, Auto,
 * Elevator) or has an exit choice (which door to leave by). A choice re-routes at once.
 */
export function RouteOptions({ route, from, names, entrances, mode, onMode, doors, onExit, onSpotLabels }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const floors = route.legs.some((l) => l.kind === 'floors');
  const exits = useMemo(() => exitChoices(route, from, entrances), [route, from, entrances]);
  // The quickest door is the one the route takes while Quickest is chosen; remember it once another door is picked.
  // It's per mode: after Stairs → Elevator with another door picked, it's unknown and a plain Quickest chip shows.
  const [seen, setSeen] = useState<{ mode: FloorMode; door: number | undefined } | null>(null);
  if (exits !== null && doors?.exit === undefined && (seen?.mode !== mode || seen.door !== exits.taken))
    setSeen({ mode, door: exits.taken });
  const quickest = seen?.mode === mode ? seen.door : undefined;
  // The chips are only on screen while the panel is open; the map names their doors for as long (8▸ critique, P2).
  const labels = useMemo(() => (open && exits ? exitSpotLabels(exits) : []), [open, exits]);
  useEffect(() => {
    onSpotLabels?.(labels);
    return () => {
      onSpotLabels?.([]);
    };
  }, [labels, onSpotLabels]);
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
        {exits && <ExitChips choices={exits} quickest={quickest} names={names} exit={doors?.exit} onExit={onExit} />}
      </div>
    </div>
  );
}

interface ExitProps {
  choices: ExitChoices;
  quickest: number | undefined;
  names: PlaceNames;
  exit: number | undefined;
  onExit: (exit: number | undefined) => void;
}

/** "Leave Velasco by": one chip per door, the quickest marked. Exactly one is pressed. */
function ExitChips({ choices, quickest, names, exit, onExit }: ExitProps) {
  return (
    <div className="mt-2">
      <h3 className="pt-2 pb-1 font-semibold text-ink-2">Leave {names.short(choices.building)} by</h3>
      <div className="flex flex-wrap gap-2">
        {exitChips(choices, quickest, exit).map((chip) => (
          <Chip
            key={chip.key}
            pressed={chip.pressed}
            onClick={() => {
              onExit(chip.pick);
            }}
          >
            {chip.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
