import { X } from 'lucide-react';
import type { CampusBuilding } from '@/shared/data/campus';
import { IconButton } from '@/shared/ui/IconButton';

interface Props {
  building: Pick<CampusBuilding, 'short' | 'name' | 'tier'>;
  onClose: () => void;
}

/**
 * S3 Building card (user-flows §3.1): the short name as the headline, the full name under it, and for buildings
 * without a room list a plain note that search can't find rooms there yet. Directions arrive with routing (5a).
 */
export function BuildingCard({ building, onClose }: Props) {
  return (
    <section aria-label={building.short} className="flex items-start gap-2 pb-2">
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
    </section>
  );
}
