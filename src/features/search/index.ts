// The search feature's public surface. Other features and the app shell import only from here (ARCHITECTURE §6).
export { parseRoomCode } from './parse-room-code';
export { readDeepLink, resolveDeepLink, type DeepLink } from './deep-link';
export type { Hit, RoomHit, SearchBuilding } from './search-results';
export { BuildingCard } from './components/BuildingCard';
export { HomeRecent } from './components/HomeRecent';
export { RoomCard } from './components/RoomCard';
export { SearchPill } from './components/SearchPill';
export { SearchScreen } from './components/SearchScreen';
export { useRecent } from './components/useRecent';
export { useSearchData, type SearchData } from './components/useSearchData';
