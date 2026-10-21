// A fixed slice of campus.json and rooms.json for the search tests. Fixed on purpose: when 9a–9d add Andrew's and the
// others' rooms, the real data changes but these cases keep testing the same rules (user-flows §3.3, D38).
import type { CampusBuilding } from '@/shared/data/campus';
import type { Room } from '@/shared/data/rooms';
import { buildSearchIndex, type SearchIndex } from './search-index';

type Building = Pick<
  CampusBuilding,
  'slug' | 'name' | 'short' | 'aliases' | 'tier' | 'prefixes' | 'suggestPrefixes' | 'floorLabels'
>;

// In campus.json's order, the full tier first, then two block buildings.
export const BUILDINGS: readonly Building[] = [
  {
    slug: 'andrew',
    name: 'Br. Andrew Gonzalez Hall',
    short: 'Andrew',
    aliases: ['Andrew', 'Gonzalez Hall'],
    tier: 'full',
    prefixes: ['AG'],
  },
  {
    slug: 'gokongwei',
    name: 'John Gokongwei Hall',
    short: 'Gokongwei',
    aliases: ['Gokongwei'],
    tier: 'full',
    prefixes: ['G'],
  },
  {
    slug: 'velasco',
    name: 'Velasco Hall',
    short: 'Velasco',
    aliases: ['Velasco', 'Urbano J. Velasco Hall'],
    tier: 'full',
    prefixes: ['VL', 'VE'],
    suggestPrefixes: ['VH'],
    floorLabels: { '1': 'G' },
  },
  {
    slug: 'miguel',
    name: 'St. Miguel Hall',
    short: 'Miguel',
    aliases: ['Miguel', 'St. Miguel'],
    tier: 'full',
    prefixes: ['SM'],
    floorLabels: { '1': 'G' },
  },
  {
    slug: 'yuchengco',
    name: 'Don Enrique T. Yuchengco Hall',
    short: 'Yuchengco',
    aliases: ['Yuchengco'],
    tier: 'full',
    prefixes: ['EY'],
  },
  {
    slug: 'sj',
    name: 'St. Joseph Hall',
    short: 'St. Joseph',
    aliases: ['St. Joseph'],
    tier: 'full',
    prefixes: ['SJ'],
    suggestPrefixes: ['J'],
    floorLabels: { '1': 'G' },
  },
  {
    slug: 'ls',
    name: 'St. La Salle Hall',
    short: 'La Salle Hall',
    aliases: ['La Salle Hall'],
    tier: 'full',
    prefixes: ['LS'],
  },
  {
    slug: 'razon',
    name: 'Enrique M. Razon Sports Center',
    short: 'Razon',
    aliases: ['Razon', 'Sports Center'],
    tier: 'full',
    prefixes: ['ER'],
  },
  {
    slug: 'mutien',
    name: 'Mutien-Marie Hall',
    short: 'Mutien-Marie',
    aliases: ['Mutien'],
    tier: 'full',
    prefixes: ['MM'],
  },
  {
    slug: 'strc',
    name: 'Science & Technology Research Center',
    short: 'STRC',
    aliases: ['STRC', 'Science and Technology Research Center'],
    tier: 'full',
    prefixes: ['ST', 'C'],
    floorLabels: { '1': 'G' },
  },
  {
    slug: 'connon',
    name: 'Br. Gabriel Connon Hall',
    short: 'Connon',
    aliases: ['Connon'],
    tier: 'block',
    prefixes: [],
  },
  {
    slug: 'henry-sy',
    name: 'Henry Sy Sr. Hall',
    short: 'Henry Sy',
    aliases: ['Henry Sy', 'Centennial Building'],
    tier: 'block',
    prefixes: [],
  },
];

const room = (code: string, building: string, floor: number, name: string, floorLabel?: string): Room =>
  floorLabel === undefined ? { code, building, floor, name } : { code, building, floor, name, floorLabel };

const STRC_3F = ['301', '302', '303', '304', '305', '306', '307', '309', '310', '311', '312', '313', '314'];

export const ROOMS: readonly Room[] = [
  room('SJ201', 'sj', 2, 'Classroom'),
  room('SJ206A', 'sj', 2, 'Chemistry Lab'),
  room('SJ206B', 'sj', 2, 'Chemistry Lab'),
  room('SJ305', 'sj', 3, 'Classroom'),
  room('SM105', 'miguel', 1, 'Registrar', 'G Mezz'),
  room('SM305', 'miguel', 3, 'Classroom'),
  room('ST102', 'strc', 1, 'Structural and Materials Testing Lab'),
  ...STRC_3F.map((n) => room(`ST${n}`, 'strc', 3, n === '311' ? 'Surface Physics Lab' : 'Classroom')),
  room('ST315A', 'strc', 3, 'Computational Materials Design (CMD) Lab'),
  room('ST315B', 'strc', 3, 'Classroom'),
  room('ST316', 'strc', 3, 'Classroom'),
  room('ST404', 'strc', 4, 'Biology Lab'),
  room('VL305', 'velasco', 3, 'Classroom'),
  room('VL501', 'velasco', 5, 'Classroom'),
  room('VL502', 'velasco', 5, 'Classroom'),
];

export const INDEX: SearchIndex = buildSearchIndex(ROOMS, BUILDINGS);
