import { X } from 'lucide-react';
import { IconButton } from '@/shared/ui/IconButton';
import type { RoomHit } from '../search-results';

/**
 * S3 Room card, the 3c version (D38): the code as the headline, the room's name, and its building and floor. That
 * is the answer most students need (PRD §5, building and floor in 10 s). 3d adds the floor band, the floor chip and
 * Share; Directions arrive with routing (5a).
 */
export function RoomCard({ room, onClose }: { room: RoomHit; onClose: () => void }) {
  return (
    <section aria-label={room.code} className="flex items-start gap-2 pb-2">
      <div className="min-w-0 flex-1 pt-1">
        <h2 className="text-[28px] leading-[1.15] font-[750] tracking-[-0.01em] text-ink tabular-nums">{room.code}</h2>
        <p className="mt-1 text-lg font-semibold text-ink">{room.name}</p>
        <p className="mt-1 text-ink-2 tabular-nums">
          {room.building.short} · {room.floorLabel}
        </p>
      </div>
      <IconButton label="Close" onClick={onClose}>
        <X className="size-6" strokeWidth={2} />
      </IconButton>
    </section>
  );
}
