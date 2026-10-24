import { Search, Trees, X } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { HitList, NoteLine, searchResults, type Hit, type SearchData, type SearchView } from '@/features/search';
import type { From, To } from '@/shared/data/route';
import type { OnSpotLabels } from '@/shared/data/spot-labels';
import { IconButton } from '@/shared/ui/IconButton';
import { atFloor, atGate, atSpot, chooseEnter, chooseHit, nextTo, type Choice } from '../choose';
import type { PickerBuilding, PickerPlaces } from '../places';
import { spotLabelsOf } from '../spot-labels';
import { offersSpot, spotChoices } from '../spots';
import { BuildingRows, FloorStep, OutsideStep, SpotStep } from './Steps';
import { useBuildingSpots } from './useBuildingSpots';
import { usePickerPlaces } from './usePickerPlaces';

type Step =
  | { kind: 'start' }
  | { kind: 'floors'; slug: string }
  | { kind: 'spot'; slug: string; floor: number }
  | { kind: 'outside' };

interface Props {
  /** The card cut to one line, shown above so the destination stays on screen (user-flows §3.4). */
  line: ReactNode;
  search: SearchData;
  to: To;
  /** A building tapped on the map while this is open: a new object for every tap, so the same building twice counts. */
  mapPick: { slug: string } | null;
  /** The building whose floors or spots are showing, or null: the map tints it so the pick is visible there too. */
  onBuilding?: (slug: string | null) => void;
  /** The spots the Change spot step offers, to be named on the map while it shows; [] when it doesn't (8▸ critique). */
  onSpotLabels?: OnSpotLabels;
  onFrom: (from: From) => void;
  onClose: () => void;
}

/**
 * S4 Where are you? (user-flows §3.5, D23, D42): the code box on top, I'm outside under it, then the buildings. A
 * building goes on to its floors; From is set by a room, a floor, a gate or next to a building. No autofocus: a
 * student who only wanted the floor closes it without the keyboard in the way.
 */
export function WhereAreYou({ line, search, to, mapPick, onBuilding, onSpotLabels, onFrom, onClose }: Props) {
  const places = usePickerPlaces();
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [query, setQuery] = useState('');
  const [same, setSame] = useState<string | null>(null);
  // A map tap picks that building, as its row would (adjusting state to a prop, without an effect).
  const [seenPick, setSeenPick] = useState(mapPick);
  if (mapPick !== seenPick) {
    setSeenPick(mapPick);
    if (mapPick) setStep({ kind: 'floors', slug: mapPick.slug });
  }

  const building = step.kind === 'floors' || step.kind === 'spot' ? step.slug : null;
  useEffect(() => {
    onBuilding?.(building);
    return () => {
      onBuilding?.(null);
    };
  }, [building, onBuilding]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const apply = (choice: Choice) => {
    if (choice.kind === 'from') onFrom(choice.from);
    else if (choice.kind === 'same') setSame(choice.code);
    else setStep({ kind: 'floors', slug: choice.building });
  };
  const toStart = () => {
    setStep({ kind: 'start' });
  };

  return (
    // Phones: the whole section stays inside the half snap (54dvh, DESIGN.md Sheet snaps) less the sheet's 24px handle
    // and 16px foot; the building list scrolls inside it. md+ is the side panel, which caps itself.
    <section aria-label="Where are you?" className="flex max-h-[calc(54dvh-40px)] flex-col pb-2 md:max-h-none">
      <div className="flex items-start gap-1">
        <span className="mt-3.5 flex-none font-normal text-ink-2">To</span>
        {line}
        <IconButton label="Close Where are you" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      <h2 className="mt-2 text-lg font-[650] text-ink">Where are you?</h2>
      {places.status === 'loading' && <p className="py-3 text-ink-2">Loading the buildings…</p>}
      {places.status === 'failed' && (
        <p className="py-3 text-ink-2">The map couldn&rsquo;t load. Check your connection, then reload.</p>
      )}
      {places.status === 'ready' && (
        <Body
          places={places.places}
          step={step}
          search={search}
          query={query}
          same={same}
          to={to}
          onQuery={(q) => {
            setQuery(q);
            setSame(null);
          }}
          onChoice={apply}
          onStep={setStep}
          onSpotLabels={onSpotLabels}
          onFrom={onFrom}
          onBack={toStart}
        />
      )}
    </section>
  );
}

interface BodyProps {
  places: PickerPlaces;
  step: Step;
  search: SearchData;
  query: string;
  same: string | null;
  to: To;
  onQuery: (query: string) => void;
  onChoice: (choice: Choice) => void;
  onStep: (step: Step) => void;
  onSpotLabels?: OnSpotLabels;
  onFrom: (from: From) => void;
  onBack: () => void;
}

const scroll = (children: ReactNode) => (
  <div className="-mx-2 mt-1 min-h-0 flex-1 overflow-y-auto px-2">{children}</div>
);

/** The step on screen. Phones: the choices scroll inside the sheet, which sizes to its content, like All steps. */
function Body({ places, step, onStep, onSpotLabels, onFrom, onBack, ...start }: BodyProps) {
  if (step.kind === 'floors' || step.kind === 'spot') {
    const building = places.buildings.find((b) => b.slug === step.slug);
    if (building) {
      return scroll(
        <BuildingSteps
          key={building.slug}
          building={building}
          step={step}
          onStep={onStep}
          onSpotLabels={onSpotLabels}
          onFrom={onFrom}
          onBack={onBack}
        />,
      );
    }
  }
  if (step.kind === 'outside') {
    return scroll(
      <OutsideStep
        gates={places.gates}
        buildings={places.buildings}
        onGate={(id) => {
          onFrom(atGate(id));
        }}
        onNextTo={(slug) => {
          onFrom(nextTo(slug));
        }}
        onBack={onBack}
      />,
    );
  }
  return <StartStep places={places} onStep={onStep} {...start} />;
}

interface BuildingStepsProps {
  building: PickerBuilding;
  step: Extract<Step, { kind: 'floors' | 'spot' }>;
  onStep: (step: Step) => void;
  onSpotLabels?: OnSpotLabels;
  onFrom: (from: From) => void;
  onBack: () => void;
}

/** A building's floors, and with Change spot on, where on the chosen floor. The spot choices need its file. */
function BuildingSteps({ building, step, onStep, onSpotLabels, onFrom, onBack }: BuildingStepsProps) {
  const spots = useBuildingSpots(building.slug);
  const file = spots.status === 'ready' ? spots.file : null;
  // Lives here, not in FloorStep, so Pick another floor comes back with Change spot still on.
  const [choosing, setChoosing] = useState(false);
  // Every floor waits for the file, G too: its stairs join its doors. Null means still loading.
  const choicesAt = (floor: number) => (spots.status === 'loading' ? null : spotChoices(building.doors, floor, file));

  // While the spot step shows its choices, the map names them (8▸ critique, P2); it stops when the step goes.
  const spotFloor = step.kind === 'spot' ? step.floor : null;
  const labels = useMemo(
    () =>
      spotFloor === null || spots.status === 'loading'
        ? []
        : spotLabelsOf(building.slug, spotFloor, spotChoices(building.doors, spotFloor, file)),
    [building.slug, building.doors, spotFloor, spots.status, file],
  );
  useEffect(() => {
    onSpotLabels?.(labels);
    return () => {
      onSpotLabels?.([]);
    };
  }, [labels, onSpotLabels]);

  if (step.kind === 'spot') {
    const { floor } = step;
    return (
      <SpotStep
        building={building}
        floor={floor}
        floorLabel={building.floors.find((f) => f.floor === floor)?.label ?? `${String(floor)}F`}
        choices={choicesAt(floor)}
        onSpot={(c) => {
          onFrom(atSpot(building.slug, floor, c.spot));
        }}
        onUsual={() => {
          onFrom(atFloor(building.slug, floor));
        }}
        onBack={() => {
          onStep({ kind: 'floors', slug: building.slug });
        }}
      />
    );
  }
  return (
    <FloorStep
      building={building}
      offersSpot={offersSpot(building.doors, file)}
      choosing={choosing}
      onChoosing={setChoosing}
      onFloor={(floor) => {
        // With Change spot on, the spot step always opens, and says so when the floor has nothing else to pick.
        if (choosing) onStep({ kind: 'spot', slug: building.slug, floor });
        else onFrom(atFloor(building.slug, floor));
      }}
      onBack={onBack}
    />
  );
}

type StartProps = Pick<BodyProps, 'places' | 'search' | 'query' | 'same' | 'to' | 'onQuery' | 'onChoice' | 'onStep'>;

/** The code box, then what was typed matches, or the buildings and I'm outside when nothing is typed. */
function StartStep({ places, search, query, same, to, onQuery, onChoice, onStep }: StartProps) {
  const view = useMemo(
    () => (search.status === 'ready' && query.trim() !== '' ? searchResults(query, search.index) : null),
    [search, query],
  );
  const typed = query.trim() !== '';
  return (
    <>
      <CodeBox query={query} onQuery={onQuery} onEnter={() => chooseEnter(view, to)} onChoice={onChoice} />
      {same && (
        <p role="status" className="py-3 font-semibold text-ink tabular-nums">
          You&rsquo;re already at {same}.
        </p>
      )}
      {!typed && (
        <OutsideRow
          onClick={() => {
            onStep({ kind: 'outside' });
          }}
        />
      )}
      {scroll(
        view ? (
          <Results view={view} to={to} onChoice={onChoice} />
        ) : (
          <>
            {typed && search.status === 'loading' && <p className="py-3 text-ink-2">Loading rooms…</p>}
            {typed && search.status === 'failed' && (
              <p className="py-3 text-ink-2">The rooms couldn&rsquo;t load. Pick a building instead.</p>
            )}
            <BuildingRows
              heading="Or pick a building"
              buildings={places.buildings}
              onPick={(slug) => {
                onStep({ kind: 'floors', slug });
              }}
            />
          </>
        ),
      )}
    </>
  );
}

interface CodeBoxProps {
  query: string;
  onQuery: (query: string) => void;
  /** What Enter picks, if anything. */
  onEnter: () => Choice | null;
  onChoice: (choice: Choice) => void;
}

/** The same code box as To (D23), as a Pale Leaf field (DESIGN.md, Inputs). Enter takes only an exact match (D38). */
function CodeBox({ query, onQuery, onEnter, onChoice }: CodeBoxProps) {
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (e.repeat) return;
    const choice = onEnter();
    if (choice) onChoice(choice);
    else e.currentTarget.blur(); // hides the phone keyboard so the whole list shows
  };
  return (
    <div className="mt-2 flex h-13 items-center gap-2 rounded-row bg-surface-2 pr-1 pl-3 has-[input:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-accent)]">
      <Search className="size-6 flex-none text-ink-3" strokeWidth={2} aria-hidden />
      <input
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
        }}
        onKeyDown={onKey}
        type="text"
        placeholder="I’m in room… like AG1104"
        aria-label="The room you’re in"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="go"
        className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink caret-accent outline-none placeholder:text-ink-3"
      />
      {query !== '' && (
        <IconButton
          label="Clear"
          onClick={() => {
            onQuery('');
          }}
        >
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      )}
    </div>
  );
}

const HEADINGS = { 'did-you-mean': 'Did you mean', buildings: 'Or pick a building' } as const;

interface ResultsProps {
  view: SearchView;
  to: To;
  onChoice: (choice: Choice) => void;
}

/** What S2 would show for the code, as rows to pick from (D38): rooms set From, buildings go on to their floors. */
function Results({ view, to, onChoice }: ResultsProps) {
  const pick = (hit: Hit) => {
    onChoice(chooseHit(hit, to));
  };
  return (
    <>
      {view.note && <NoteLine note={view.note} />}
      {view.hits.length > 0 && (
        <HitList heading={view.heading ? HEADINGS[view.heading] : undefined} hits={view.hits} onPick={pick} />
      )}
    </>
  );
}

/** I'm outside, right under the code box so it never sits below the fold, with what it leads to under it. */
function OutsideRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-2 mt-1 flex min-h-14 w-[calc(100%+1rem)] flex-none cursor-pointer items-center gap-3.5 rounded-row px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:-outline-offset-2"
    >
      <Trees className="size-6 flex-none text-ink-3" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">I&rsquo;m outside</span>
        <span className="block text-ink-2">At a gate, or next to a building</span>
      </span>
    </button>
  );
}
