/**
 * O4: "Map updated. Reload" (user-flows §4). A toast (DESIGN.md) that, unlike the others, stays until tapped, because
 * the student decides when a reload is safe. Deep Ink box, centred `bottom` px above the bottom safe area (the caller
 * lifts it above the sheet on phones), 420px at most. It rises 8px and fades in over 160ms; with reduced motion it
 * just appears. The status wrapper stays mounted so a screen reader announces the box when it arrives; the caller
 * decides when `show` is true.
 */
export function UpdateToast({ show, bottom, onReload }: { show: boolean; bottom: number; onReload: () => void }) {
  return (
    <div
      role="status"
      style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${String(bottom)}px)` }}
      className="pointer-events-none fixed inset-x-0 z-10 flex justify-center px-(--gutter-l)"
    >
      {show && (
        <div className="pointer-events-auto flex w-full max-w-105 items-center justify-between gap-3 rounded-row bg-ink pl-4 text-base text-surface shadow-float transition-[opacity,translate] duration-160 ease-snap starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none">
          <span>Map updated.</span>
          <button type="button" onClick={onReload} className="min-h-12 px-4 font-semibold text-surface underline">
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
