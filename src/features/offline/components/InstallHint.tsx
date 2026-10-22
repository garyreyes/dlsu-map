import { Share, X } from 'lucide-react';

const plate = 'inline-flex items-start gap-1.5 rounded-label bg-surface pl-2 text-ink-2 shadow-float';

/**
 * The iPhone/iPad "Add to Home Screen" line (user-flows §4), shown after the first save until the student closes
 * it, in the same spot and plate as SavingLine. Only the Close button takes taps; the rest of the plate and the
 * wrapper around it let taps pass through to the map.
 */
export function InstallHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <span className={plate}>
      <span className="py-0.5">
        Add to Home Screen: tap Share
        <Share className="mx-1 inline size-4 align-text-bottom" strokeWidth={2} aria-hidden />, then Add to Home Screen
      </span>
      <button
        type="button"
        aria-label="Close"
        onClick={onDismiss}
        className="pointer-events-auto -my-3 flex size-12 flex-none items-center justify-center text-ink-3"
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}
