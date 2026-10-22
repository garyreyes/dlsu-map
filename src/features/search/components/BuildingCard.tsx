import { X } from 'lucide-react';
import type { CampusBuilding } from '@/shared/data/campus';
import { PrimaryButton } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';

interface Props {
  building: Pick<CampusBuilding, 'short' | 'name' | 'tier'>;
  onDirections: () => void;
  onClose: () => void;
}

/**
 * S3 Building card (user-flows §3.1): the short name as the headline, the full name under it, and for buildings
 * without a room list a plain note that search can't find rooms there yet. Directions, to its main entrance, asks Where
 * are you (5a); a block-tier building has no entrances to route to yet (D20), so it has none.
 */
export function BuildingCard({ building, onDirections, onClose }: Props) {
  return (
    <section aria-label={building.short} className="pb-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-[28px] leading-[1.15] font-[750] tracking-[-0.01em] text-ink">{building.short}</h2>
          {building.name !== building.short && <p className="mt-1 text-lg font-semibold text-ink">{building.name}</p>}
          {building.tier === 'block' && (
            <p className="mt-2 text-ink-2">Not searchable yet. It has no room list in the app.</p>
          )}
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      {building.tier === 'full' && <PrimaryButton onClick={onDirections}>Directions</PrimaryButton>}
    </section>
  );
}

/** The building card cut to one line while Where are you is open under it (D42). */
export function BuildingLine({ building }: { building: Pick<CampusBuilding, 'short' | 'name'> }) {
  return <p className="min-w-0 flex-1 pt-3 font-semibold text-ink">{building.name}</p>;
}
