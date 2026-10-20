// The campus room-code prefixes (ARCHITECTURE §3.3, owner's list 2026-10-19). Canonical prefix first.
// Temporary home: from 2b this comes from data-src/campus/buildings.json, and this constant goes away.
import type { PrefixTable } from '@/shared/data/room-code';

export const ROOM_PREFIXES = [
  { building: 'miguel', prefixes: ['SM'] },
  { building: 'yuchengco', prefixes: ['EY'] },
  { building: 'velasco', prefixes: ['VL', 'VE'], suggestPrefixes: ['VH'] }, // VH: printed on its directory (D25)
  { building: 'razon', prefixes: ['ER'] },
  { building: 'sj', prefixes: ['SJ'], suggestPrefixes: ['J'] }, // J: printed on its directory (D25)
  { building: 'gokongwei', prefixes: ['G'] },
  { building: 'ls', prefixes: ['LS'] },
  { building: 'andrew', prefixes: ['AG'] },
  { building: 'strc', prefixes: ['ST', 'C'] }, // C: printed on its directory
  { building: 'mutien', prefixes: ['MM'] },
] as const satisfies PrefixTable;
