// The room card's floor words (DESIGN.md, Room card): "3rd floor (3F)", "Ground floor (G)". The only green text on
// the card (the Code Is the Headline Rule). Pure. Tests: floor-words.test.ts.

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${String(n)}${suffix}`;
}

/** `floor` counts G as 1; `label` is as the building's signs print it. Labels it can't put into words stay as is. */
export function floorWords(floor: number, label: string): string {
  if (label === 'G') return 'Ground floor (G)';
  if (label === `${String(floor)}F`) return `${ordinal(floor)} floor (${label})`;
  return label;
}
