import type { ReactNode } from 'react';

interface Props {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

/** A 48px white circle floating over the map (DESIGN.md, Map button). */
export function MapButton({ label, onClick, children }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-12 cursor-pointer place-items-center rounded-full bg-surface text-ink shadow-float"
    >
      {children}
    </button>
  );
}
