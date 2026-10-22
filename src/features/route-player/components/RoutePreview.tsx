import { ArrowRight, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { FloorMode, From, Route, To } from '@/shared/data/route';
import { Chip, PrimaryButton, SecondaryButton } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Segmented } from '@/shared/ui/Segmented';
import { noElevatorLines, noIndoorMapLines, notOkLine, summaryLine } from '../preview';
import { fromName, toName, type PlaceNames } from '../steps-list';
import { usePlaceNames } from './usePlaceNames';
import type { RouteState } from './useRoute';

const MODES = [
  { value: 'stairs', label: 'Stairs' },
  { value: 'auto', label: 'Auto' },
  { value: 'elevator', label: 'Elevator' },
] as const;

interface Props {
  /** The card cut to one line, shown above so the destination's building and floor stay on screen (D43). */
  line: ReactNode;
  state: RouteState;
  from: From;
  to: To;
  mode: FloorMode;
  onMode: (mode: FloorMode) => void;
  /** The From chip: reopens Where are you (S4). */
  onChangeFrom: () => void;
  /** The To chip: reopens search (S2). */
  onChangeTo: () => void;
  onStart: () => void;
  onClose: () => void;
}

/**
 * S5 Route preview, the confirm screen (user-flows §3.6): From → To as chips, the time, distance and how the floors
 * are taken, then Start, the one primary action. Route options stay folded away until wanted. Closes with ✕ or
 * Escape; the parent wires Back.
 */
export function RoutePreview({
  line,
  state,
  from,
  to,
  mode,
  onMode,
  onChangeFrom,
  onChangeTo,
  onStart,
  onClose,
}: Props) {
  const loadedNames = usePlaceNames();
  const names = state.status === 'ready' ? state.names : loadedNames;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <section aria-label="Your route" className="pb-2">
      <div className="flex items-start gap-1">
        {line}
        <IconButton label="Close Your route" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      <h2 className="mt-2 text-lg font-[650] text-ink">Your route</h2>
      {names && <Ends from={from} to={to} names={names} onChangeFrom={onChangeFrom} onChangeTo={onChangeTo} />}
      <Body state={state} from={from} to={to} mode={mode} onMode={onMode} onStart={onStart} />
    </section>
  );
}

interface EndsProps {
  from: From;
  to: To;
  names: PlaceNames;
  onChangeFrom: () => void;
  onChangeTo: () => void;
}

/** The two ends as chips, each led by a quiet "From" or "To" (DESIGN.md, Chips). They wrap when names run long. */
function Ends({ from, to, names, onChangeFrom, onChangeTo }: EndsProps) {
  const [a, b] = [fromName(from, names), toName(to, names)];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip label={`From ${a}. Change where you are`} onClick={onChangeFrom}>
        <span className="mr-1.5 font-normal text-ink-2">From</span>
        {a}
      </Chip>
      <ArrowRight className="size-5 shrink-0 text-ink-3" strokeWidth={2} aria-hidden />
      <Chip label={`To ${b}. Change where to`} onClick={onChangeTo}>
        <span className="mr-1.5 font-normal text-ink-2">To</span>
        {b}
      </Chip>
    </div>
  );
}

interface BodyProps {
  state: RouteState;
  from: From;
  to: To;
  mode: FloorMode;
  onMode: (mode: FloorMode) => void;
  onStart: () => void;
}

/** Everything under the chips, by how far the route has got. Loading keeps Start in place, so nothing jumps. */
function Body({ state, from, to, mode, onMode, onStart }: BodyProps) {
  if (state.status === 'loading') {
    return (
      <>
        <p className="mt-3 text-ink-2">Finding the route…</p>
        <PrimaryButton disabled onClick={onStart}>
          Start
        </PrimaryButton>
      </>
    );
  }
  if (state.status === 'failed') {
    return (
      <div className="mt-3">
        <p className="text-ink-2">The map couldn&rsquo;t load.</p>
        <div className="mt-2">
          <SecondaryButton
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </SecondaryButton>
        </div>
      </div>
    );
  }
  if (!state.result.ok)
    return <p className="mt-3 text-ink-2">{notOkLine(state.result.reason, from, to, state.names)}</p>;
  const { route } = state.result;
  return (
    <>
      <p className="mt-3 text-ink tabular-nums">{summaryLine(route)}</p>
      {[...noElevatorLines(route, state.names), ...noIndoorMapLines(route, state.names, state.stillSaving)].map(
        (note) => (
          <p key={note} className="mt-1 text-ink-2">
            {note}
          </p>
        ),
      )}
      <PrimaryButton onClick={onStart}>Start</PrimaryButton>
      {hasFloors(route) && <RouteOptions mode={mode} onMode={onMode} />}
    </>
  );
}

/** Stairs or elevator only matters when the route changes floor. */
const hasFloors = (route: Route) => route.legs.some((l) => l.kind === 'floors');

/** Route options (user-flows §3.6), folded away until wanted. A choice re-routes at once. */
function RouteOptions({ mode, onMode }: { mode: FloorMode; onMode: (mode: FloorMode) => void }) {
  const [open, setOpen] = useState(false);
  const panel = useId();
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
        <Segmented label="Stairs or elevator" options={MODES} value={mode} onChange={onMode} />
        <p className="mt-2 text-ink-2">Auto takes the elevator for 3 or more floors.</p>
      </div>
    </div>
  );
}
