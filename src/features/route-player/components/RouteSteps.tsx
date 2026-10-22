import { useState } from 'react';
import type { From, To } from '@/shared/data/route';
import { notOkLine } from '../preview';
import { AllSteps } from './AllSteps';
import type { RouteState } from './useRoute';

interface Props {
  /** The trip's route, worked out by whoever opened the list: the preview's Start, or the dev link. */
  state: RouteState;
  from: From;
  to: To;
  onClose: () => void;
}

/**
 * A trip's all-steps list (S8). Until the step player (5d) exists, the route preview's Start opens it (D43), and it is
 * what the dev link (5c) shows.
 */
export function RouteSteps({ state, from, to, onClose }: Props) {
  const [current, setCurrent] = useState(0);
  if (state.status === 'loading') return <Note text="Finding the route…" />;
  if (state.status === 'failed') return <Note text="The map couldn’t load. Reload." />;
  if (!state.result.ok) return <Note text={notOkLine(state.result.reason, from, to, state.names)} />;
  return (
    <AllSteps
      route={state.result.route}
      from={from}
      to={to}
      names={state.names}
      current={current}
      onPick={setCurrent}
      onClose={onClose}
    />
  );
}

const Note = ({ text }: { text: string }) => <p className="py-2 text-ink-2">{text}</p>;
