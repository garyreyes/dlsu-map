import { CircleCheck } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { Route, To } from '@/shared/data/route';
import { PrimaryButton, SecondaryButton } from '@/shared/ui/Button';
import { arrivedHeading, indoorMapComing } from '../player';
import type { PlaceNames } from '../steps-list';

interface Props {
  route: Route;
  to: To;
  names: PlaceNames;
  /** The card cut to one line ("ST311 · STRC · 3rd floor (3F)"), under the heading. */
  line: ReactNode;
  /** The room's building and floor, for O5. Null for a building. */
  room: { code: string; building: string; floor: number } | null;
  /** Find next room: search (S2) with From set to here. */
  onNext: () => void;
  /** Done: back to the map (S1). From stays set. */
  onDone: () => void;
  /** Escape: back to the last step. The parent wires the phone's Back. */
  onBack: () => void;
}

/** S9 Arrived (user-flows §3.8): where the student is, then the next room is one tap away. */
export function Arrived({ route, to, names, line, room, onNext, onDone, onBack }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onBack]);

  const coming = room && indoorMapComing(route, room, names);
  return (
    <section aria-label="Arrived" className="pb-2">
      <div className="flex items-center gap-2.5 pt-1">
        <CircleCheck className="size-7 flex-none text-accent" strokeWidth={2.25} aria-hidden />
        <h2 className="text-[28px] leading-[1.15] font-[750] tracking-[-0.01em] text-ink tabular-nums">
          {arrivedHeading(route, to, names)}
        </h2>
      </div>
      <div className="mt-1">{line}</div>
      {coming && <p className="mt-2 text-ink-2">{coming}</p>}
      <PrimaryButton onClick={onNext}>Find next room</PrimaryButton>
      <div className="mt-2 flex justify-center">
        <SecondaryButton onClick={onDone}>Done</SecondaryButton>
      </div>
    </section>
  );
}
