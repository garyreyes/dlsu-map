import type { ReactNode } from 'react';

interface Props {
  label: string;
  onClick: () => void;
  children: ReactNode;
}

/** A 48px round icon button in Mid Ink with a Pale Leaf hover (DESIGN.md, Icon button). */
export function IconButton({ label, onClick, children }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-12 flex-none cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
