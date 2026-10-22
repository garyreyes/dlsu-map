import { useState } from 'react';
import { parseDevLink } from '../dev-link';
import { RouteSteps } from './RouteSteps';

/**
 * Dev only (5c), never in the shipped app: `?from=…&to=…` shows that route's all-steps list, so routes can be
 * checked before the route preview (5b) exists. From: `gate-1`, `strc@3` or `AG1104`.
 */
export function DevSteps({ onClose }: { onClose: () => void }) {
  const [trip] = useState(() => parseDevLink(window.location.search));
  if (trip === null) {
    return <p className="py-2 text-ink-2">Dev link: use ?from=gate-1&to=ST311 (From may also be strc@3 or AG1104).</p>;
  }
  return <RouteSteps from={trip.from} to={trip.to} onClose={onClose} />;
}
