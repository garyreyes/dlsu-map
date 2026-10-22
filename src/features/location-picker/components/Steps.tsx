import { HitList, type Hit } from '@/features/search';
import { Chip, SecondaryButton } from '@/shared/ui/Button';
import type { PickerBuilding, PickerGate } from '../places';

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
  onFloor: (floor: number) => void;
  onBack: () => void;
}

/**
 * The floor step: the building's floors as chips, with the labels on its signs. Spot isn't asked (PRD UC2); the
 * line under the chips says where each floor starts, and Change spot comes in 8c (D42).
 */
export function FloorStep({ building, onFloor, onBack }: FloorStepProps) {
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
      <p className="mt-3 text-ink-2">{ground} starts at the main entrance; other floors at the elevator lobby.</p>
      <div className="mt-3">
        <SecondaryButton onClick={onBack}>Pick another building</SecondaryButton>
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
