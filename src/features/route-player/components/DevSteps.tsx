import { useState } from 'react';
import { parseDevLink } from '../dev-link';
import { RouteSteps } from './RouteSteps';
import { useRoute } from './useRoute';

/**
 * Dev only (5c), never in the shipped app: `?from=…&to=…` shows that route's all-steps list on Auto, so routes can be
 * checked without tapping through search and Where are you. From: `gate-1`, `strc@3` or `AG1104`.
 */
export function DevSteps({ onClose }: { onClose: () => void }) {
  const [trip] = useState(() => parseDevLink(window.location.search));
  const state = useRoute(trip?.from ?? null, trip?.to ?? null, 'auto');
  if (trip === null || state === null) {
    return <p className="py-2 text-ink-2">Dev link: use ?from=gate-1&to=ST311 (From may also be strc@3 or AG1104).</p>;
  }
  return <RouteSteps state={state} from={trip.from} to={trip.to} onClose={onClose} />;
}
