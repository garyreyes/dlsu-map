import { useState } from 'react';
import type { From, RouteResult, To } from '@/shared/data/route';
import { AllSteps } from './AllSteps';
import { useRoute } from './useRoute';

/** Why a trip routed to nothing, in words. `same-room` and `no-route` follow S4 and S5's copy. */
const NOT_OK: Record<Exclude<RouteResult, { ok: true }>['reason'], string> = {
  'same-room': 'From and To are the same room.',
  'unknown-place': 'A place on this route isn’t in the map data.',
  'no-route': 'We can’t find a way between these yet.',
};

interface Props {
  from: From;
  to: To;
  /** Reopens Where are you. Left out on the dev link, which has nowhere to go back to. */
  onChangeFrom?: () => void;
  onClose: () => void;
}

/**
 * A trip's all-steps list (S8). Until the route preview (5b) exists it stands in for it once From is set (D42), and
 * it is what the dev link (5c) shows. `from` and `to` must keep their identity between renders, or it routes again.
 */
export function RouteSteps({ from, to, onChangeFrom, onClose }: Props) {
  const state = useRoute(from, to);
  const [current, setCurrent] = useState(0);
  if (state.status === 'loading') return <Note text="Loading the route…" />;
  if (state.status === 'failed') return <Note text={`The map couldn’t load (${state.reason}). Reload.`} />;
  if (!state.result.ok) return <Note text={NOT_OK[state.result.reason]} />;
  return (
    <AllSteps
      route={state.result.route}
      from={from}
      to={to}
      names={state.names}
      current={current}
      onPick={setCurrent}
      onChangeFrom={onChangeFrom}
      onClose={onClose}
    />
  );
}

const Note = ({ text }: { text: string }) => <p className="py-2 text-ink-2">{text}</p>;
