// The search feature's public surface. Other features and the app shell import only from here (ARCHITECTURE §6).
export { parseRoomCode } from './parse-room-code';
export { readDeepLink, resolveDeepLink, type DeepLink } from './deep-link';
export { buildSearchIndex, type SearchIndex } from './search-index';
export { searchResults, type Hit, type RoomHit, type SearchBuilding, type SearchView } from './search-results';
export { BuildingCard, BuildingLine } from './components/BuildingCard';
export { HomeRecent } from './components/HomeRecent';
export { HitList, NoteLine, noteText } from './components/HitRow';
export { RoomCard, RoomLine } from './components/RoomCard';
export { SearchPill } from './components/SearchPill';
export { SearchScreen } from './components/SearchScreen';
export { useRecent } from './components/useRecent';
export { useSearchData, type SearchData } from './components/useSearchData';
