import type { ReactNode, Ref } from 'react';

interface Props {
  label: string;
  onClick: () => void;
  children: ReactNode;
  /** For a button that opens something: whether it is open, and the id of what it opens. */
  expanded?: boolean;
  controls?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** A 48px white circle floating over the map (DESIGN.md, Map button). */
export function MapButton({ label, onClick, children, expanded, controls, ref }: Props) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className="grid size-12 cursor-pointer place-items-center rounded-full bg-surface text-ink shadow-float"
    >
      {children}
    </button>
  );
}
