import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  line: string;
  /** The one thing to do about it, when there is one. */
  action?: { label: string; onClick: () => void };
}

/**
 * Why the map isn't there, centred where it would be (DESIGN.md, States): an icon, a Headline and one line, plus a
 * secondary button only when pressing it can help. The search pill and sheet stay usable around it, so taps outside
 * the button pass through.
 */
export function MapProblem({ icon, title, line, action }: Props) {
  return (
    <div
      role="alert"
      className="pointer-events-none fixed inset-0 z-2 flex flex-col items-center justify-center gap-3 px-8 text-center"
    >
      <span className="text-ink-3" aria-hidden>
        {icon}
      </span>
      <div className="max-w-sm">
        <p className="m-0 text-lg font-[650] text-balance text-ink">{title}</p>
        <p className="mt-1 mb-0 text-ink-2">{line}</p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="pointer-events-auto mt-1 h-12 cursor-pointer rounded-control border border-line px-4 font-semibold text-accent"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
