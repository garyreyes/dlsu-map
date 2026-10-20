/** A one-line state centred over the map, in Mid Ink (DESIGN.md, States): "Loading the campus…". Failures use
 *  MapProblem instead, so they never look like loading. */
export function MapMessage({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-0 z-2 grid place-items-center px-8 text-center text-ink-2"
    >
      {text}
    </div>
  );
}

export const LOADING_MAP = 'Loading the campus…';
