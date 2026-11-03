import { Layers, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { MAP_PALETTES } from '@/shared/config/palette';
import {
  BUILDING_LOOKS,
  COLOUR_MODES,
  isDefaultSettings,
  MAP_VIEWS,
  SURROUNDINGS,
  type BuildingLook,
  type ColourMode,
  type MapView,
  type Surroundings,
} from '@/shared/settings/map-settings';
import { useMapSettings } from '@/shared/settings/useMapSettings';
import { MapButton } from '@/shared/ui/MapButton';
import { Segmented } from '@/shared/ui/Segmented';

const COLOUR_LABELS: Record<ColourMode, string> = { green: 'Green', black: 'Black', grey: 'Grey' };
const VIEW_LABELS: Record<MapView, string> = { '3d': '3D', '2d': '2D' };
const LOOK_LABELS: Record<BuildingLook, string> = { solid: 'Solid', 'see-through': 'See-through' };
const SURROUNDINGS_LABELS: Record<Surroundings, string> = { show: 'Show', hide: 'Hide' };

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

/** Half the palette's ground, half its buildings: a preview of the colour mode. */
const colourOptions = COLOUR_MODES.map((value) => {
  const { ground, building } = MAP_PALETTES[value];
  const lead = (
    <span
      aria-hidden="true"
      // Under 360px wide the segments are too narrow for a swatch beside the word, so the word stands alone.
      className="hidden size-3.5 flex-none rounded-full ring-1 ring-line min-[360px]:block"
      style={{ background: `linear-gradient(90deg, ${ground} 50%, ${building} 50%)` }}
    />
  );
  return { value, label: COLOUR_LABELS[value], lead };
});

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

/** Whether more of the card is hidden below its fold, to fade the bottom edge. Recomputed on open, scroll and resize. */
function useMoreBelow(open: boolean, card: RefObject<HTMLDivElement | null>, maxHeight: number | undefined) {
  const [moreBelow, setMoreBelow] = useState(false);
  useLayoutEffect(() => {
    const el = card.current;
    if (!open || !el) return;
    const measure = () => {
      setMoreBelow(el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    };
    measure();
    el.addEventListener('scroll', measure);
    return () => {
      el.removeEventListener('scroll', measure);
    };
  }, [open, card, maxHeight]);
  return moreBelow;
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
  const cardId = useId();

  // The card opens upward from the button, so it never covers the sheet below; it scrolls if the screen is short.
  const maxHeight = useMaxHeight(open, buttonRef, top);
  const moreBelow = useMoreBelow(open, cardRef, maxHeight);

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
    if (open) cardRef.current?.focus({ preventScroll: true });
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
        {open ? <X className="size-6" strokeWidth={2} /> : <Layers className="size-6" strokeWidth={2} />}
      </MapButton>
      {!open && !isDefaultSettings(settings) && (
        <span
          aria-hidden="true"
          data-changed="true"
          className="pointer-events-none absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface"
        />
      )}
      {open && (
        <div
          ref={cardRef}
          id={cardId}
          role="dialog"
          aria-label="Map options"
          tabIndex={-1}
          style={{ maxHeight }}
          // Focus moving to something else (search opened from the keyboard) closes it, without taking focus back.
          onBlur={(e) => {
            if (e.relatedTarget instanceof Node && !isInside(e.relatedTarget)) setOpen(false);
          }}
          className="absolute right-full bottom-0 mr-3 flex w-78 max-w-[calc(100vw-var(--gutter-l)-var(--gutter-r)-60px)] flex-col overflow-y-auto gap-3 rounded-sheet bg-surface p-3 shadow-float outline-none transition-[opacity,translate] duration-160 ease-snap starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none"
        >
          <Row title="Colour">
            <Segmented
              label="Colour"
              options={colourOptions}
              value={settings.colour}
              onChange={(v) => {
                setOne('colour', v);
              }}
            />
          </Row>
          {/* Side by side from 360px; stacked below, where two pairs of segments would crowd their words. */}
          <div className="grid gap-3 min-[360px]:grid-cols-2">
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
            <Row title="Surroundings">
              <Segmented
                label="Surroundings"
                options={options(SURROUNDINGS, SURROUNDINGS_LABELS)}
                value={settings.surroundings}
                onChange={(v) => {
                  setOne('surroundings', v);
                }}
              />
            </Row>
          </div>
          <Row title="Buildings">
            <Segmented
              label="Buildings"
              options={options(BUILDING_LOOKS, LOOK_LABELS)}
              value={settings.buildings}
              onChange={(v) => {
                setOne('buildings', v);
              }}
            />
          </Row>
          {moreBelow && (
            // Takes no height: the 12px gap before it plus its 24px (h-6) are cancelled by -mt-9 (36px), so it
            // overlays the last content without changing scrollHeight. Change all three together.
            <div
              aria-hidden="true"
              className="pointer-events-none sticky bottom-0 -mt-9 h-6 flex-none bg-linear-to-b from-transparent to-surface"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden="true" className="text-ink-2">
        {title}
      </span>
      {children}
    </div>
  );
}
