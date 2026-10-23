import { HitList, type Hit } from '@/features/search';
import { Chip, SecondaryButton } from '@/shared/ui/Button';
import type { PickerBuilding, PickerGate } from '../places';
import type { SpotChoice } from '../spots';

/** The 16px Mid Ink label a group of choices sits under (DESIGN.md, Lists and rows). */
export const GroupLabel = ({ text }: { text: string }) => (
  <h3 className="pt-2 pb-1 font-semibold text-ink-2">{text}</h3>
);

// Search's rows, so a building looks the same here as in S2: short name over full name, prefix tag at the end.
const toHit = (b: PickerBuilding): Hit => ({ kind: 'building', building: { ...b, hasRooms: true } });

interface BuildingRowsProps {
  heading: string;
  buildings: readonly PickerBuilding[];
  onPick: (slug: string) => void;
}

export function BuildingRows({ heading, buildings, onPick }: BuildingRowsProps) {
  return (
    <HitList
      heading={heading}
      hits={buildings.map(toHit)}
      onPick={(hit) => {
        if (hit.kind === 'building') onPick(hit.building.slug);
      }}
    />
  );
}

interface FloorStepProps {
  building: PickerBuilding;
  /** Whether the building has a real choice of spot; if not, Change spot isn't shown. */
  offersSpot: boolean;
  /** Change spot is on: a floor tap asks where on it. */
  choosing: boolean;
  onChoosing: (choosing: boolean) => void;
  onFloor: (floor: number) => void;
  onBack: () => void;
}

/**
 * The floor step: the building's floors as chips, with the labels on its signs. A tap sets From at once, at the
 * usual spot (PRD UC2). Change spot, in the line under the chips, makes the tap ask where on the floor (D42).
 */
export function FloorStep({ building, offersSpot, choosing, onChoosing, onFloor, onBack }: FloorStepProps) {
  const ground = building.floors[0]?.label ?? 'G';
  return (
    <div role="group" aria-label={`${building.name}: which floor?`}>
      <GroupLabel text={`${building.short}: which floor?`} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2">
        {building.floors.map((f) => (
          <Chip
            key={f.floor}
            onClick={() => {
              onFloor(f.floor);
            }}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      <p className="mt-3 text-ink-2">
        {choosing
          ? 'Pick a floor, then where on it.'
          : `${ground} starts at the main entrance; other floors at the elevator lobby.`}
        {offersSpot && (
          <>
            {' '}
            <button
              type="button"
              aria-pressed={choosing}
              onClick={() => {
                onChoosing(!choosing);
              }}
              className="-my-2.5 inline-block min-h-11 cursor-pointer rounded-row px-1 py-2.5 font-semibold text-accent"
            >
              {choosing ? 'Use the usual spot' : 'Change spot'}
            </button>
          </>
        )}
      </p>
      <div className="mt-3">
        <SecondaryButton onClick={onBack}>Pick another building</SecondaryButton>
      </div>
    </div>
  );
}

interface SpotStepProps {
  building: PickerBuilding;
  /** The floor chip's label, e.g. `G` or `3F`. */
  floorLabel: string;
  /** Null while the building file loads on an upper floor. */
  choices: readonly SpotChoice[] | null;
  onSpot: (choice: SpotChoice) => void;
  /** No spot to choose after all (the file didn't load): start at the usual one. */
  onUsual: () => void;
  onBack: () => void;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Change spot's second step: where on the floor, as chips like the gates. */
export function SpotStep({ building, floorLabel, choices, onSpot, onUsual, onBack }: SpotStepProps) {
  const title = `${building.short} ${floorLabel}: where on the floor?`;
  return (
    <div role="group" aria-label={title}>
      <GroupLabel text={title} />
      {choices === null && <p className="py-3 text-ink-2">Loading the floor…</p>}
      {choices !== null && choices.length < 2 && (
        <>
          <p className="pb-3 text-ink-2">
            {building.short}&rsquo;s indoor map isn&rsquo;t saved yet, so {floorLabel} starts at the elevator lobby.
          </p>
          <Chip onClick={onUsual}>Elevator lobby</Chip>
        </>
      )}
      {choices !== null && choices.length >= 2 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
          {choices.map((c) => (
            <Chip
              key={c.label}
              onClick={() => {
                onSpot(c);
              }}
            >
              {capital(c.label)}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-3">
        <SecondaryButton onClick={onBack}>Pick another floor</SecondaryButton>
      </div>
    </div>
  );
}

interface OutsideStepProps {
  gates: readonly PickerGate[];
  buildings: readonly PickerBuilding[];
  onGate: (id: string) => void;
  onNextTo: (slug: string) => void;
  onBack: () => void;
}

/** I'm outside: a gate, or next to a building, which starts at its main entrance. */
export function OutsideStep({ gates, buildings, onGate, onNextTo, onBack }: OutsideStepProps) {
  return (
    <>
      <div role="group" aria-label="At a gate">
        <GroupLabel text="At a gate" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {gates.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              onClick={() => {
                onGate(g.id);
              }}
            >
              {g.chip}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <BuildingRows heading="Next to a building" buildings={buildings} onPick={onNextTo} />
      </div>
      <div className="mt-2">
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
      </div>
    </>
  );
}
