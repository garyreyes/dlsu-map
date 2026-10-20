import { ArrowLeft, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/shared/ui/IconButton';
import { useModal } from '@/shared/ui/useModal';

/**
 * Full-screen search (S2), the frame only: a 64px bar with back and clear over a results area. 3c fills in the
 * results (room codes, "Did you mean", Recent). Closes with its back arrow, Escape or the phone's back button.
 * Modal: the map and chrome behind it are inert while it's open, and focus returns to the opener on close.
 */
export function SearchScreen({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModal(dialogRef);

  useEffect(() => {
    input.current?.focus(); // the student tapped search, so the keyboard should come up
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const clear = () => {
    setQuery('');
    input.current?.focus();
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-10 flex flex-col bg-surface pt-[env(safe-area-inset-top,0px)]"
    >
      {/* Focus shows as a green underline on the bar rather than a ring round the field, which read as an alert. */}
      <div className="flex h-16 flex-none items-center gap-1 border-b border-line pr-(--gutter-r) pl-2 has-[input:focus-visible]:shadow-[inset_0_-2px_0_var(--color-accent)]">
        <IconButton label="Back to the map" onClick={onClose}>
          <ArrowLeft className="size-6" strokeWidth={2} />
        </IconButton>
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          type="text"
          placeholder="Room code or building"
          aria-label="Room code or building"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          className="h-12 min-w-0 flex-1 rounded-row bg-transparent px-2 text-lg font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
        />
        {query !== '' && (
          <IconButton label="Clear" onClick={clear}>
            <X className="size-6" strokeWidth={2} />
          </IconButton>
        )}
      </div>
      <div className="overflow-y-auto pt-2 pr-(--gutter-r) pl-(--gutter-l)">
        <p className="py-4 text-ink-2">
          {query.trim() === '' ? (
            <>
              Type a room, like <b className="font-semibold text-ink tabular-nums">ST311</b>, or a building.
            </>
          ) : (
            'Room search is coming in a later beta.'
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}
