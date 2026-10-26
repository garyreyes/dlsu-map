import { Layers, X } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { COLOUR_MODES, MAP_VIEWS, type ColourMode, type MapView } from '@/shared/settings/map-settings';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { IconButton } from '@/shared/ui/IconButton';
import { MapButton } from '@/shared/ui/MapButton';
import { Segmented } from '@/shared/ui/Segmented';

const COLOUR_LABELS: Record<ColourMode, string> = { green: 'Green', black: 'Black', grey: 'Grey' };
const VIEW_LABELS: Record<MapView, string> = { '3d': '3D', '2d': '2D' };

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

/** Closes on Escape and on a press outside the card that isn't on the toggle button (which closes it itself). The
 *  card is on top, so its Escape is caught first and goes no further: the sheet under it (the step player, a card)
 *  would otherwise close too. */
function useDismiss(open: boolean, close: () => void, inside: (t: Node) => boolean) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !inside(e.target)) close();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close, inside]);
}

/** The card's tallest: from the button's bottom up to `top`, measured on open and again when the window resizes. */
function useMaxHeight(open: boolean, button: RefObject<HTMLButtonElement | null>, top: number) {
  const [maxHeight, setMaxHeight] = useState<number>();
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      setMaxHeight((button.current?.getBoundingClientRect().bottom ?? 0) - top);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [open, button, top]);
  return maxHeight;
}

interface Props {
  /** The card never reaches above this, in px from the top of the screen: the map's top inset, under the pill. */
  top: number;
}

/** The map options button and its floating card (DESIGN.md, Map options): the saved choices, applied at once. */
export function MapOptions({ top }: Props) {
  const [open, setOpen] = useState(false);
  const settings = useMapSettings((s) => s.settings);
  const setOne = useMapSettings.getState().setOne;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cardId = useId();

  // The card opens upward from the button, so it never covers the sheet below; it scrolls if the screen is short.
  const maxHeight = useMaxHeight(open, buttonRef, top);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);
  const isInside = useCallback(
    (t: Node) => cardRef.current?.contains(t) === true || buttonRef.current?.contains(t) === true,
    [],
  );
  useDismiss(open, close, isInside);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  return (
    <div className="relative">
      <MapButton
        ref={buttonRef}
        label="Map options"
        expanded={open}
        controls={cardId}
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        <Layers className="size-6" strokeWidth={2} />
      </MapButton>
      {open && (
        <div
          ref={cardRef}
          id={cardId}
          role="dialog"
          aria-labelledby={`${cardId}-title`}
          style={{ maxHeight }}
          // Focus moving to something else (search opened from the keyboard) closes it, without taking focus back.
          onBlur={(e) => {
            if (e.relatedTarget instanceof Node && !isInside(e.relatedTarget)) setOpen(false);
          }}
          className="absolute right-full bottom-0 mr-3 flex w-78 max-w-[calc(100vw-var(--gutter-l)-var(--gutter-r)-60px)] flex-col overflow-y-auto gap-4 rounded-sheet bg-surface p-4 shadow-float transition-[opacity,translate] duration-160 ease-snap starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none"
        >
          <div className="flex items-center justify-between">
            <h2 id={`${cardId}-title`} ref={titleRef} tabIndex={-1} className="text-[17px] font-semibold outline-none">
              Map options
            </h2>
            <IconButton label="Close map options" onClick={close}>
              <X className="size-6" strokeWidth={2} />
            </IconButton>
          </div>
          <Row title="Colour">
            <Segmented
              label="Colour"
              options={options(COLOUR_MODES, COLOUR_LABELS)}
              value={settings.colour}
              onChange={(v) => {
                setOne('colour', v);
              }}
            />
          </Row>
          <Row title="View">
            <Segmented
              label="View"
              options={options(MAP_VIEWS, VIEW_LABELS)}
              value={settings.view}
              onChange={(v) => {
                setOne('view', v);
              }}
            />
          </Row>
          {/* Buildings (Solid / See-through) joins in v2-A4, with the fading that makes it do something (D60). */}
        </div>
      )}
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="text-ink-2">
        {title}
      </span>
      {children}
    </div>
  );
}
