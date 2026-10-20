import { LocateFixed } from 'lucide-react';
import { MapButton } from '@/shared/ui/MapButton';
import { showCompass } from '../gestures';
import { useHeading } from './headingStore';

interface Props {
  onCompass: () => void;
  onRecenter: () => void;
  /** Distance from the bottom of the screen: just above the sheet on phones. */
  bottom: number | string;
}

/** Compass (only while the map is turned) above recenter, at the right gutter (DESIGN.md, Map button, Compass). */
export function MapButtons({ onCompass, onRecenter, bottom }: Props) {
  const heading = useHeading((s) => s.deg);
  return (
    <div
      className="fixed right-(--gutter-r) z-3 flex flex-col gap-3 transition-[bottom] duration-260 ease-snap motion-reduce:transition-none"
      style={{ bottom }}
    >
      {showCompass(heading) && (
        <MapButton label="Turn the map back to its usual direction" onClick={onCompass}>
          {/* The needle's green tip points where "up" usually is: the map turned by `heading`, so it did too. */}
          <svg viewBox="0 0 24 24" className="size-6" style={{ transform: `rotate(${String(heading)}deg)` }}>
            <path d="M12 3 8.5 12h7z" className="fill-accent stroke-accent" strokeWidth={1.5} />
            <path d="M12 21l3.5-9h-7z" className="fill-surface-2 stroke-ink-3" strokeWidth={1.5} />
          </svg>
        </MapButton>
      )}
      <MapButton label="Show the whole campus" onClick={onRecenter}>
        <LocateFixed className="size-6" strokeWidth={2} />
      </MapButton>
    </div>
  );
}
