import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  CircleDot,
  CornerUpLeft,
  CornerUpRight,
  DoorOpen,
  Footprints,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { StepIconKey } from '../steps-list';

const LUCIDE: Record<Exclude<StepIconKey, `${'stairs' | 'elevator'}-${'up' | 'down'}`>, LucideIcon> = {
  start: CircleDot,
  'slight-left': ArrowUpLeft,
  left: CornerUpLeft,
  'sharp-left': ArrowDownLeft,
  'slight-right': ArrowUpRight,
  right: CornerUpRight,
  'sharp-right': ArrowDownRight,
  cross: Footprints,
  enter: DoorOpen,
  arrive: MapPin,
};

/** A step's 24px icon (S6, S8). lucide has no stairs or elevator, so those two are drawn here in its style: 2px
 *  round strokes on a 24px grid. Colour comes from the parent's text colour. */
export function StepIcon({ icon }: { icon: StepIconKey }) {
  if (icon in LUCIDE) {
    const Icon = LUCIDE[icon as keyof typeof LUCIDE];
    return <Icon className="size-6 flex-none" strokeWidth={2} aria-hidden />;
  }
  const up = icon.endsWith('-up');
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 flex-none"
      aria-hidden
    >
      {icon.startsWith('stairs') ? (
        <>
          <path d="M3 21h5v-4.5h5V12h5V7.5h3" />
          <path d={up ? 'M6 12V3M3 6l3-3 3 3' : 'M6 3v9M3 9l3 3 3-3'} />
        </>
      ) : (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d={up ? 'M12 16V8M8.5 11.5 12 8l3.5 3.5' : 'M12 8v8M8.5 12.5 12 16l3.5-3.5'} />
        </>
      )}
    </svg>
  );
}
