import type { CSSProperties } from 'react';

/** The OSM credit the data licence requires (D4), always on the map. 14px: a mark, not reading text (D30). The link's
 *  tap area reaches 48px past its small plate without changing how it looks. */
export function MapCredit({ position }: { position: CSSProperties }) {
  return (
    <div
      className="fixed z-3 rounded-tag bg-surface/92 px-1.5 py-0.5 text-sm text-ink-2 transition-[bottom] duration-260 ease-snap motion-reduce:transition-none"
      style={position}
    >
      ©{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="relative underline after:absolute after:-inset-x-2 after:-inset-y-3.75 after:content-['']"
      >
        OpenStreetMap
      </a>
    </div>
  );
}
