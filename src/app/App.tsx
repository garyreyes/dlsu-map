// The app shell (ARCHITECTURE §6): lays out the map and its floating chrome, and owns the little state that ties them
// together. No parsing, routing or fetching here.
import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import type { MapInsets } from '@/features/campus-scene';
import { HomeHint, SearchPill, SearchScreen } from '@/features/search';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MAP_FAILED, MapMessage } from '@/shared/ui/MapMessage';
import { NotOfficialNote } from '@/shared/ui/NotOfficialNote';
import { BottomSheet, SidePanel } from '@/shared/ui/Sheet';
import { useIsWide } from '@/shared/ui/useMediaQuery';
import { useBackToClose } from './useBackToClose';

// The 3D map is its own chunk, so the search pill and sheet work before three.js has loaded (user-flows §3.2).
const CampusMap = lazy(() => import('@/features/campus-scene').then((m) => ({ default: m.CampusMap })));

/** Wide screens: the left panel's right edge (16px gutter + 400px) plus 8px of air. */
const PANEL_EDGE = 16 + 400 + 8;

export function App() {
  const wide = useIsWide();
  const search = useBackToClose();
  const header = useRef<HTMLElement>(null);
  const [pillBottom, setPillBottom] = useState(62);
  const [sheetHeight, setSheetHeight] = useState(96);

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
  const home = (
    <>
      <HomeHint onOpen={search.open} />
      <NotOfficialNote />
    </>
  );

  return (
    <>
      {/* If the map's chunk can't download, only the map is lost: the pill and sheet stay usable. */}
      <ErrorBoundary fallback={<MapMessage text={MAP_FAILED} />}>
        <Suspense fallback={<MapMessage text={LOADING_MAP} />}>
          <CampusMap insets={insets} sheetHeight={sheetHeight} wide={wide} />
        </Suspense>
      </ErrorBoundary>
      <header
        ref={header}
        className="fixed top-[calc(env(safe-area-inset-top,0px)+10px)] right-(--gutter-r) left-(--gutter-l) z-5 md:right-auto md:w-100"
      >
        <SearchPill onOpen={search.open} />
      </header>
      {wide ? (
        <SidePanel label="Details">{home}</SidePanel>
      ) : (
        <BottomSheet label="Details" onVisibleHeight={setSheetHeight}>
          {home}
        </BottomSheet>
      )}
      {search.isOpen && <SearchScreen onClose={search.close} />}
    </>
  );
}
