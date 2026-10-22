// The app shell (ARCHITECTURE §6): lays out the map and its floating chrome, and owns the little state that ties them
// together. No parsing, routing or fetching here.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MapInsets, MapTrip } from '@/features/campus-scene';
import { WhereAreYou } from '@/features/location-picker';
import { MapDidntDownload, OpenOnceOnline, SavingLine, useOfflineStatus } from '@/features/offline';
import {
  AllSteps,
  Arrived,
  nextFrom,
  RoutePreview,
  StepPlayer,
  useRoute,
  useRouteMode,
  useStep,
} from '@/features/route-player';
import {
  BuildingCard,
  BuildingLine,
  HomeRecent,
  RoomCard,
  RoomLine,
  SearchPill,
  SearchScreen,
  useRecent,
  useSearchData,
  type DeepLink,
  type Hit,
  type RoomHit,
} from '@/features/search';
import type { CampusBuilding } from '@/shared/data/campus';
import type { To } from '@/shared/data/route';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LOADING_MAP, MapMessage } from '@/shared/ui/MapMessage';
import { NotOfficialNote } from '@/shared/ui/NotOfficialNote';
import { BottomSheet, SidePanel } from '@/shared/ui/Sheet';
import { useIsWide } from '@/shared/ui/useMediaQuery';
import { useBackToClose } from './useBackToClose';
import { useDeepLink } from './useDeepLink';
import { useTrip } from './useTrip';

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

/** What the card shows: a building tapped on the map or picked in search, or a room picked in search (3c). */
type Picked =
  | { kind: 'building'; building: Pick<CampusBuilding, 'slug' | 'short' | 'name' | 'tier'> }
  | { kind: 'room'; room: RoomHit };

const toPicked = (hit: Hit): Picked =>
  hit.kind === 'room' ? { kind: 'room', room: hit } : { kind: 'building', building: { ...hit.building, tier: 'full' } };

const toOf = (picked: Picked): To =>
  picked.kind === 'room'
    ? { kind: 'room', code: picked.room.code }
    : { kind: 'building', building: picked.building.slug };

export function App() {
  const wide = useIsWide();
  const search = useBackToClose();
  const header = useRef<HTMLElement>(null);
  const [pillBottom, setPillBottom] = useState(62);
  const [sheetHeight, setSheetHeight] = useState(96);
  const offline = useOfflineStatus();
  // The card is an overlay the phone's Back closes. What it shows stays set after it closes, but only counts as
  // selected while the card is open.
  const card = useBackToClose();
  const [picked, setPicked] = useState<Picked | null>(null);
  const selected = card.isOpen ? picked : null;
  const selectedSlug = selected && (selected.kind === 'room' ? selected.room.building.slug : selected.building.slug);
  const { open: openCard, close: closeCard, closeThen: closeCardThen } = card;
  // Where the route goes: kept as one object per pick, so the route isn't worked out again on every render.
  const to = useMemo(() => (picked ? toOf(picked) : null), [picked]);
  const trip = useTrip();
  const { roomOpened, mapTap } = trip;
  // The route, worked out only while the preview or the screens over it are open; Stairs / Auto / Elevator for this
  // trip. The player's step, and the map's focus on it, belong to the route.
  const routing = selected !== null && (trip.preview.isOpen || trip.player.isOpen || trip.arrived.isOpen);
  const [mode, setMode] = useRouteMode(trip.from, to);
  const route = useRoute(routing ? trip.from : null, routing ? to : null, mode);
  const step = useStep(route);
  // The player stays open under Arrived, so the map keeps the last step there.
  const mapTrip: MapTrip | null =
    route?.status === 'ready'
      ? { here: route.here, route: step.route, focus: trip.player.isOpen ? step.focus : null }
      : null;
  const select = useCallback(
    (b: CampusBuilding | null) => {
      if (mapTap(b)) return;
      if (!b) {
        closeCard();
        return;
      }
      setPicked({ kind: 'building', building: b });
      openCard();
    },
    [mapTap, openCard, closeCard],
  );
  const searchData = useSearchData();
  const recent = useRecent();
  const { add: addRecent } = recent;
  const { closeThen: closeSearchThen } = search;
  // A search result or a Recent row: remember it, close search, then open its card. The card opens only after
  // search's history entry is gone, so Back closes the card rather than a search that is already shut.
  const pick = useCallback(
    (hit: Hit) => {
      const next = toPicked(hit);
      // A second tap while search is still closing is dropped whole, Recent included (closeThen ignores it).
      closeSearchThen(() => {
        addRecent(hit);
        setPicked(next);
        openCard();
        if (next.kind === 'room') roomOpened();
      });
    },
    [addRecent, closeSearchThen, openCard, roomOpened],
  );
  // What S2 opens with: empty from the pill, the link's text from a deep link it can't open as a card (D40).
  const [searchStart, setSearchStart] = useState('');
  const { open: openSearchOverlay } = search;
  const openSearch = useCallback(() => {
    setSearchStart('');
    openSearchOverlay();
  }, [openSearchOverlay]);
  const { endTrip, setFrom } = trip;
  // S9: Find next room starts the next search where this trip ended; Done goes back to the map. From stays either way.
  const findNext = useCallback(() => {
    if (!to) return;
    const next = nextFrom(to);
    // Search opens only once the card's entry is gone, so Back from search lands on the map, not a closed card.
    endTrip(() => {
      closeCardThen(() => {
        setFrom(next);
        openSearch();
      });
    });
  }, [to, endTrip, closeCardThen, setFrom, openSearch]);
  const done = useCallback(() => {
    endTrip(closeCard);
  }, [endTrip, closeCard]);
  const openLink = useCallback(
    (link: DeepLink) => {
      if (link.kind === 'search') {
        setSearchStart(link.text);
        openSearchOverlay();
        return;
      }
      const next = toPicked(link.hit);
      setPicked(next);
      openCard();
      if (next.kind === 'room') roomOpened();
    },
    [openSearchOverlay, openCard, roomOpened],
  );
  useDeepLink(searchData, openLink);
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
  // The card cut to one line, above Where are you and the route preview.
  const line =
    selected?.kind === 'room' ? (
      <RoomLine room={selected.room} />
    ) : selected ? (
      <BuildingLine building={selected.building} />
    ) : null;
  const sheet =
    DevSteps && devSteps.isOpen ? (
      <Suspense fallback={null}>
        <DevSteps onClose={devSteps.close} />
      </Suspense>
    ) : to && route?.status === 'ready' && step.route && trip.arrived.isOpen ? (
      <Arrived
        route={step.route}
        to={to}
        names={route.names}
        line={line}
        room={
          selected?.kind === 'room'
            ? { code: selected.room.code, building: selected.room.building.slug, floor: selected.room.floor }
            : null
        }
        onNext={findNext}
        onDone={done}
        onBack={trip.arrived.close}
      />
    ) : to && trip.from && route?.status === 'ready' && step.route && trip.allSteps.isOpen ? (
      <AllSteps
        route={step.route}
        from={trip.from}
        to={to}
        names={route.names}
        current={step.index}
        onPick={(index) => {
          step.setIndex(index);
          trip.allSteps.close();
        }}
        onClose={trip.allSteps.close}
      />
    ) : step.route && trip.player.isOpen ? (
      <StepPlayer
        route={step.route}
        current={step.index}
        onStep={step.setIndex}
        onArrive={trip.arrived.open}
        onChangeFrom={trip.changeFromPlayer}
        onAllSteps={trip.allSteps.open}
        onClose={trip.player.close}
      />
    ) : to && trip.from && route && trip.preview.isOpen ? (
      <RoutePreview
        line={line}
        state={route}
        from={trip.from}
        to={to}
        mode={mode}
        onMode={setMode}
        onChangeFrom={trip.changeFrom}
        onChangeTo={openSearch}
        onStart={() => {
          trip.start(step.route?.steps.length ?? 0);
        }}
        onClose={trip.preview.close}
      />
    ) : selected && to && trip.where.isOpen ? (
      <WhereAreYou
        line={line}
        search={searchData}
        to={to}
        mapPick={trip.mapPick}
        onFrom={trip.chooseFrom}
        onClose={trip.where.close}
      />
    ) : selected?.kind === 'room' ? (
      <RoomCard key={selected.room.code} room={selected.room} onDirections={trip.directions} onClose={closeCard} />
    ) : selected ? (
      <BuildingCard building={selected.building} onDirections={trip.directions} onClose={closeCard} />
    ) : (
      <>
        <HomeRecent data={searchData} recent={recent.entries} onPick={pick} onOpenSearch={openSearch} />
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
        <SearchPill onOpen={openSearch} />
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
            selected={selectedSlug}
            floor={selected?.kind === 'room' ? { floor: selected.room.floor, label: selected.room.floorLabel } : null}
            trip={mapTrip}
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
      {search.isOpen && (
        <SearchScreen
          data={searchData}
          recent={recent.entries}
          initialQuery={searchStart}
          onPick={pick}
          onClose={search.close}
        />
      )}
    </>
  );
}
