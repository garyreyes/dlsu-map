// The app shell (ARCHITECTURE §6): lays out the map and its floating chrome, and owns the little state that ties them
// together. No parsing, routing or fetching here.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MapInsets } from '@/features/campus-scene';
import { MapDidntDownload, OpenOnceOnline, SavingLine, useOfflineStatus } from '@/features/offline';
import { BuildingCard, HomeHint, SearchPill, SearchScreen } from '@/features/search';
import type { CampusBuilding } from '@/shared/data/campus';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { NotOfficialNote } from '@/shared/ui/NotOfficialNote';
import { BottomSheet, SidePanel } from '@/shared/ui/Sheet';
import { useIsWide } from '@/shared/ui/useMediaQuery';
import { useBackToClose } from './useBackToClose';

// The 3D map is its own chunk, so the search pill and sheet work before three.js has loaded (user-flows §3.2).
const CampusMap = lazy(() => import('@/features/campus-scene').then((m) => ({ default: m.CampusMap })));

// Dev only (5c): `?from=…&to=…` opens a route's all-steps list. `import.meta.env.DEV` is false in a build, so the
// bundler drops both lines and the chunk; tests/e2e/dev-link.spec.ts checks it stays out.
const DevSteps = import.meta.env.DEV
  ? lazy(() => import('@/features/route-player').then((m) => ({ default: m.DevSteps })))
  : null;
const DEV_LINK = import.meta.env.DEV && new URLSearchParams(window.location.search).has('from');

/** Wide screens: the left panel's right edge (16px gutter + 400px) plus 8px of air. */
const PANEL_EDGE = 16 + 400 + 8;

export function App() {
  const wide = useIsWide();
  const search = useBackToClose();
  const header = useRef<HTMLElement>(null);
  const [pillBottom, setPillBottom] = useState(62);
  const [sheetHeight, setSheetHeight] = useState(96);
  const offline = useOfflineStatus();
  // The building card is an overlay the phone's Back closes. The building stays set after it closes, but only
  // counts as selected while the card is open.
  const card = useBackToClose();
  const [building, setBuilding] = useState<CampusBuilding | null>(null);
  const selected = card.isOpen ? building : null;
  const { open: openCard, close: closeCard } = card;
  const select = useCallback(
    (b: CampusBuilding | null) => {
      if (!b) {
        closeCard();
        return;
      }
      setBuilding(b);
      openCard();
    },
    [openCard, closeCard],
  );
  // The dev link's list is an overlay too, opened once on load, so Back closes it like S8 will in the player.
  const devSteps = useBackToClose();
  const { open: openDevSteps } = devSteps;
  useEffect(() => {
    if (DEV_LINK) openDevSteps();
  }, [openDevSteps]);

  useLayoutEffect(() => {
    const measure = () => {
      if (header.current) setPillBottom(header.current.getBoundingClientRect().bottom);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  const insets: MapInsets = wide
    ? { top: 16, bottom: 0, left: PANEL_EDGE }
    : { top: pillBottom + 8, bottom: sheetHeight, left: 0 };
  const sheet =
    DevSteps && devSteps.isOpen ? (
      <Suspense fallback={null}>
        <DevSteps onClose={devSteps.close} />
      </Suspense>
    ) : selected ? (
      <BuildingCard building={selected} onClose={closeCard} />
    ) : (
      <>
        <HomeHint onOpen={search.open} />
        <NotOfficialNote />
      </>
    );

  // Not saved and no signal: the app can't finish loading, so O1 stands in for all of it until signal returns.
  if (offline === 'open-once-online') return <OpenOnceOnline />;

  // The search pill comes first in the page, so it's the first thing Tab and a screen reader reach; the map sits
  // under it on screen either way.
  return (
    <>
      <header
        ref={header}
        className="fixed top-[calc(env(safe-area-inset-top,0px)+10px)] right-(--gutter-r) left-(--gutter-l) z-5 md:right-auto md:w-100"
      >
        <SearchPill onOpen={search.open} />
        {/* Positioned below the header's box, so the map's top inset doesn't move when the line comes and goes. */}
        <SavingLine view={offline} />
      </header>
      {/* If the map's chunk can't download, only the map is lost: the pill and sheet stay usable. */}
      <ErrorBoundary fallback={<MapDidntDownload />}>
        <Suspense fallback={<MapMessage text={LOADING_MAP} />}>
          <CampusMap
            insets={insets}
            sheetHeight={sheetHeight}
            wide={wide}
            selected={selected?.slug ?? null}
            onSelect={select}
          />
        </Suspense>
      </ErrorBoundary>
      {wide ? (
        <SidePanel label="Details">{sheet}</SidePanel>
      ) : (
        <BottomSheet label="Details" onVisibleHeight={setSheetHeight}>
          {sheet}
        </BottomSheet>
      )}
      {search.isOpen && <SearchScreen onClose={search.close} />}
    </>
  );
}
