import { useCallback, useEffect, useRef, useState } from 'react';
import { addRecent, parseRecent, recentEntry, type RecentEntry } from '../recent';
import type { Hit } from '../search-index';

/** localStorage key. Destinations only, never From (PRD §6); the format is in PROJECT_FACTS. */
const KEY = 'dlsu-map.recent';

// Storage can be missing or throw (private modes, cleared or blocked site data). Recent is a convenience, so a failure
// only means an empty list or a tap that isn't remembered.
function read(): RecentEntry[] {
  try {
    return parseRecent(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(entries: readonly RecentEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Not remembered this time; the list in memory still updates.
  }
}

/** Recent destinations (user-flows §3.2, D38), newest first, and `add` for a tapped search result. */
export function useRecent() {
  const [entries, setEntries] = useState(read);
  // Saved after a change, outside the state update (which React may run twice); not on first read.
  const changed = useRef(false);
  useEffect(() => {
    if (changed.current) write(entries);
  }, [entries]);
  const add = useCallback((hit: Hit) => {
    changed.current = true;
    setEntries((prev) => addRecent(prev, recentEntry(hit)));
  }, []);
  return { entries, add };
}
