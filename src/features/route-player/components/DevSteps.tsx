import { useState } from 'react';
import type { RouteResult } from '@/shared/data/route';
import { parseDevLink, type DevTrip } from '../dev-link';
import { AllSteps } from './AllSteps';
import { useDevRoute } from './useDevRoute';

/** Why a dev link routed to nothing, in words. `same-room` and `no-route` follow S4 and S5's copy. */
const NOT_OK: Record<Exclude<RouteResult, { ok: true }>['reason'], string> = {
  'same-room': 'From and To are the same room.',
  'unknown-place': 'A place in this link isn’t in the data.',
  'no-route': 'We can’t find a way between these yet.',
};

/**
 * Dev only (5c), never in the shipped app: `?from=…&to=…` shows that route's all-steps list, so routes can be
 * checked before Where are you (5a) and the route preview (5b) exist. From: `gate-1`, `strc@3` or `AG1104`.
 */
export function DevSteps({ onClose }: { onClose: () => void }) {
  const [trip] = useState(() => parseDevLink(window.location.search));
  if (trip === null) return <DevNote text="Dev link: use ?from=gate-1&to=ST311 (From may also be strc@3 or AG1104)." />;
  return <DevRoute trip={trip} onClose={onClose} />;
}

function DevRoute({ trip, onClose }: { trip: DevTrip; onClose: () => void }) {
  const state = useDevRoute(trip);
  const [current, setCurrent] = useState(0);
  if (state.status === 'loading') return <DevNote text="Loading the route…" />;
  if (state.status === 'failed') return <DevNote text={`The map couldn’t load (${state.reason}). Reload.`} />;
  if (!state.result.ok) return <DevNote text={NOT_OK[state.result.reason]} />;
  return (
    <AllSteps
      route={state.result.route}
      from={trip.from}
      to={trip.to}
      names={state.names}
      current={current}
      onPick={setCurrent}
      onClose={onClose}
    />
  );
}

const DevNote = ({ text }: { text: string }) => <p className="py-2 text-ink-2">{text}</p>;
