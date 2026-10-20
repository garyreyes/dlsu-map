// Hand-written samples in the agreed shape, so Lane A can build 3c/3d before the real parser (3a) lands.
// One result of each kind. Codes are from the STRC and Velasco directories (photographed 2026-10-19 and 2026-10-20).
import type { ParsedRoomCode, ParsedRoomCodeKind, PrefixTable } from './room-code';

export const samplePrefixTable = [
  { building: 'strc', prefixes: ['ST', 'C'] },
  { building: 'velasco', prefixes: ['VL', 'VE'], suggestPrefixes: ['VH'] },
  { building: 'sj', prefixes: ['SJ'], suggestPrefixes: ['J'] },
] as const satisfies PrefixTable;

export const sampleParses = {
  code: { kind: 'code', code: 'ST311', building: 'strc', floorFromNumber: 3, typedAs: 'C311' },
  suggest: { kind: 'suggest', code: 'VL501', building: 'velasco', typedPrefix: 'VH' },
  'unknown-prefix': { kind: 'unknown-prefix', typedPrefix: 'X' },
  'no-prefix': { kind: 'no-prefix', roomNumber: '305' },
  'not-a-code': { kind: 'not-a-code' },
} as const satisfies { [K in ParsedRoomCodeKind]: Extract<ParsedRoomCode, { kind: K }> };
