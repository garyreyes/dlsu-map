import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
}

/**
 * The sheet's one primary action (DESIGN.md, Buttons): a full-width Campus Green pill, 52px, white 17px bold label.
 * Pressed darkens to 94%. One per sheet: Directions on a card, Start on the route preview. `disabled` while what it
 * acts on is still loading: it stays in place, faded, so nothing moves when it's ready.
 */
export function PrimaryButton({ children, onClick, disabled = false }: ButtonProps & { disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-2 h-13 w-full cursor-pointer rounded-pill bg-accent text-[17px] font-bold text-on-accent active:brightness-94 disabled:cursor-default disabled:opacity-45 disabled:active:brightness-100"
    >
      {children}
    </button>
  );
}

/** A quieter way on or back (DESIGN.md, Buttons): a 48px pill with a hairline and green semibold text, no fill. */
export function SecondaryButton({ children, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 cursor-pointer rounded-control border border-line px-4 font-semibold text-accent hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

interface ChipProps extends ButtonProps {
  /** What a screen reader hears, when the chip shows a short form: "Gate 1 (South)" for "Gate 1". */
  label?: string;
}

/** A choice in a grid (DESIGN.md, Chips): a 48px pill with a hairline, 16px semibold Deep Ink text, no fill. */
export function Chip({ children, label, onClick }: ChipProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-12 min-w-15 cursor-pointer rounded-control border border-line px-3 font-semibold text-ink tabular-nums hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
