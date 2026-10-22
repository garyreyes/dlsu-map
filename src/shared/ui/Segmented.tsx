interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  /** What the group is for, for screen readers: "Stairs or elevator". */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * One of a few choices that apply at once (DESIGN.md, Segmented control): a Pale Leaf track with 4px padding holding
 * 48px segments. The chosen one turns Sheet White with Deep Ink text and the Float shadow.
 */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-segmented bg-surface-2 p-1">
      {options.map((o) => {
        const chosen = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={chosen}
            onClick={() => {
              onChange(o.value);
            }}
            className={`h-12 flex-1 cursor-pointer rounded-segment font-semibold ${
              chosen ? 'bg-surface text-ink shadow-float' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
