import { Check, Share2, X } from 'lucide-react';
import { PrimaryButton } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { floorWords } from '../floor-words';
import type { RoomHit } from '../search-results';
import { useShare, type ShareStatus } from './useShare';

const SAID: Record<ShareStatus, string> = { idle: '', copied: 'Link copied', failed: "Couldn't copy the link" };

/**
 * S3 Room card (DESIGN.md, Room card): the code as the headline, the room's name, then its building and floor with
 * the floor words in green, the only green text here. "Also written C311" when it was typed that way. Share and close
 * sit top right; the map shows the floor band (3d). Directions, the card's one button, asks Where are you (5a).
 */
export function RoomCard({
  room,
  onDirections,
  onClose,
}: {
  room: RoomHit;
  onDirections: () => void;
  onClose: () => void;
}) {
  const { status, share } = useShare(room);
  return (
    <section aria-label={room.code} className="pb-2">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="text-[28px] leading-[1.15] font-[750] tracking-[-0.01em] text-ink tabular-nums">
            {room.code}
          </h2>
          <p className="mt-1 text-lg font-semibold text-ink">{room.name}</p>
          <p className="mt-1 text-ink-2 tabular-nums">
            {room.building.short} ·{' '}
            <strong className="font-semibold text-accent">{floorWords(room.floor, room.floorLabel)}</strong>
          </p>
          {room.typedAs && <p className="text-ink-3 tabular-nums">Also written {room.typedAs}</p>}
          <p aria-live="polite" className={status === 'failed' ? 'text-danger' : 'text-ink-2'}>
            {SAID[status]}
          </p>
        </div>
        <IconButton label="Share" onClick={() => void share()}>
          {status === 'copied' ? (
            <Check className="size-6" strokeWidth={2} />
          ) : (
            <Share2 className="size-6" strokeWidth={2} />
          )}
        </IconButton>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-6" strokeWidth={2} />
        </IconButton>
      </div>
      <PrimaryButton onClick={onDirections}>Directions</PrimaryButton>
    </section>
  );
}

/**
 * The room card cut to one line while Where are you is open under it (user-flows §3.4, D42): code, building and
 * floor, so the student never has to remember where they're going.
 */
export function RoomLine({ room }: { room: RoomHit }) {
  return (
    <p className="min-w-0 flex-1 pt-3 font-semibold text-ink tabular-nums">
      {room.code} · {room.building.short} ·{' '}
      <span className="text-accent">{floorWords(room.floor, room.floorLabel)}</span>
    </p>
  );
}
