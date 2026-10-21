import { resolveRecent, type RecentEntry } from '../recent';
import type { Hit } from '../search-results';
import { HitList } from './HitRow';
import { HomeHint } from './HomeHint';
import type { SearchData } from './useSearchData';

interface Props {
  data: SearchData;
  recent: readonly RecentEntry[];
  onPick: (hit: Hit) => void;
  onOpenSearch: () => void;
}

/**
 * Home's sheet (user-flows §3.2): Recent once there is any, each row one tap from its card; the first-open hint
 * until then. The rows are plain buttons, so the search pill stays the one place to type.
 */
export function HomeRecent({ data, recent, onPick, onOpenSearch }: Props) {
  const rows = data.status === 'ready' ? resolveRecent(recent, data.index) : [];
  if (rows.length === 0) return <HomeHint onOpen={onOpenSearch} />;
  return <HitList heading="Recent" hits={rows} recent onPick={onPick} />;
}
