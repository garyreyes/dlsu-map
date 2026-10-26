/// <reference types="node" />
// WCAG AA pins (10c): every text colour against what it sits on, light and dark. Light tokens are read from the real
// src/styles.css, dark tokens from the DESIGN.md frontmatter (the app ships light only, the dark set is kept for a
// night mode), the map colours from palette.ts over every colour mode (D57), so nothing here can drift from the source
// of truth.
import { readFileSync } from 'node:fs';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { compositeOver, contrastRatio, type Rgba } from './contrast';
import { COLOUR_MODES } from '@/shared/settings/map-settings';
import { CAMPUS_GREEN, cutTones, MAP_PALETTES } from './palette';

/** `--color-*` custom properties of the @theme block, keyed without the prefix. */
function readCssColors(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of source.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    if (name !== undefined && value !== undefined) out[name] = value.trim();
  }
  return out;
}

/** The `colors:` block of the DESIGN.md YAML frontmatter. */
function readDesignColors(source: string): Record<string, string> {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  const block = /^colors:\r?\n((?:[ \t]+.*\r?\n?)+)/m.exec(front)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/^\s+([a-z0-9-]+):\s*"([^"]+)"/gm)) {
    if (name !== undefined && value !== undefined) out[name] = value;
  }
  return out;
}

type Tokens = (key: string) => string;

/** A token lookup that fails loudly on a name that isn't there. */
function tokens(map: Record<string, string>): Tokens {
  return (key) => {
    const value = map[key];
    if (value === undefined) throw new Error(`Unknown colour token: ${key}`);
    return value;
  };
}

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const design = readFileSync(new URL('../../../docs/DESIGN.md', import.meta.url), 'utf8');

const light = readCssColors(css);
const dark = readDesignColors(design);
const lt = tokens(light);
const dk = tokens(dark);

const AA_TEXT = 4.5;
const AA_UI = 3;

/** The colours a translucent map plate can end up over: every colour of every palette, so the worst is covered. */
const MAP_UNDER = COLOUR_MODES.flatMap((mode) => {
  const p = MAP_PALETTES[mode];
  const under = { ground: p.ground, building: p.building, path: p.path, road: p.road, haze: p.haze };
  return Object.entries(under).map(([name, colour]) => [`${mode} ${name}`, colour] as const);
});

interface Pair {
  name: string;
  fg: string;
  bg: string;
  min: number;
}

function pair(name: string, fg: string | undefined, bg: string | undefined, min = AA_TEXT): Pair {
  if (fg === undefined || bg === undefined) throw new Error(`${name}: a colour token is missing`);
  return { name, fg, bg, min };
}

function lightPairs(c: Tokens): Pair[] {
  const wash = compositeOver(c('accent-wash'), c('surface'));
  const rows: Pair[] = [];
  for (const bg of ['surface', 'surface-2']) {
    for (const ink of ['ink', 'ink-2', 'ink-3', 'accent']) rows.push(pair(`light ${ink} on ${bg}`, c(ink), c(bg)));
  }
  rows.push(
    pair('light danger on surface', c('danger'), c('surface')),
    pair('light on-accent on accent (buttons, labels, chip)', c('on-accent'), c('accent')),
    pair('light accent on accent-wash (Beta tag, step icon)', c('accent'), rgbText(wash)),
    pair('light ink-3 icon on surface', c('ink-3'), c('surface'), AA_UI),
    pair('light accent focus ring on surface', c('accent'), c('surface'), AA_UI),
    pair('light accent focus ring on surface-2', c('accent'), c('surface-2'), AA_UI),
    pair('light you-are-here dot ring (white) on accent', '#ffffff', c('accent'), AA_UI),
  );
  return rows;
}

function darkPairs(c: Tokens): Pair[] {
  const rows: Pair[] = [];
  for (const bg of ['surface-dark', 'surface-2-dark']) {
    for (const ink of ['ink-dark', 'ink-2-dark', 'ink-3-dark', 'accent-ink-dark']) {
      rows.push(pair(`dark ${ink} on ${bg}`, c(ink), c(bg)));
    }
  }
  rows.push(
    pair('dark danger-dark on surface-dark', c('danger-dark'), c('surface-dark')),
    pair('dark on-accent on accent (fills keep accent)', c('on-accent'), c('accent')),
    pair('dark ink-3-dark icon on surface-dark', c('ink-3-dark'), c('surface-dark'), AA_UI),
    pair('dark accent-ink-dark focus ring on surface-dark', c('accent-ink-dark'), c('surface-dark'), AA_UI),
  );
  return rows;
}

/** Map credit and label plates: surface at 92% over each map colour, text ink-2 (credit) and ink (labels). */
function platePairs(): Pair[] {
  const rows: Pair[] = [];
  const themes = [
    { theme: 'light', surface: lt('surface'), ink: lt('ink'), ink2: lt('ink-2') },
    { theme: 'dark', surface: dk('surface-dark'), ink: dk('ink-dark'), ink2: dk('ink-2-dark') },
  ];
  for (const t of themes) {
    for (const [mapName, under] of MAP_UNDER) {
      const plate = compositeOver(`rgba(${rgb(t.surface)}, 0.92)`, under);
      const bg = rgbText(plate);
      rows.push(
        pair(`${t.theme} ink-2 credit on surface/92 over map ${mapName}`, t.ink2, bg),
        pair(`${t.theme} ink label on surface/92 over map ${mapName}`, t.ink, bg),
      );
    }
  }
  return rows;
}

function rgbText(c: Rgba): string {
  return `rgb(${String(c.r)} ${String(c.g)} ${String(c.b)})`;
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(String).join(', ');
}

const PAIRS: Pair[] = [...lightPairs(lt), ...darkPairs(tokens({ ...light, ...dark })), ...platePairs()];

describe('tokens are readable from the real files', () => {
  it('finds the light and dark colours it needs', () => {
    for (const k of ['surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'accent', 'on-accent', 'accent-wash', 'danger']) {
      expect(light[k], `styles.css --color-${k}`).toBeTruthy();
    }
    for (const k of ['surface-dark', 'surface-2-dark', 'ink-dark', 'ink-2-dark', 'ink-3-dark', 'accent-ink-dark']) {
      expect(dark[k], `DESIGN.md ${k}`).toBeTruthy();
    }
  });

  it('keeps styles.css and the DESIGN.md light tokens in step', () => {
    const designLight = readDesignColors(design);
    for (const k of ['surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'accent', 'on-accent', 'danger']) {
      expect(designLight[k], k).toBe(light[k]);
    }
  });
});

describe('WCAG AA contrast', () => {
  it.each(PAIRS)('$name (needs $min:1)', ({ name, fg, bg, min }) => {
    const ratio = contrastRatio(fg, bg);
    expect(ratio, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${String(min)}:1`).toBeGreaterThanOrEqual(
      min,
    );
  });
});

describe('map colour modes (D57)', () => {
  it('has exactly one palette per colour mode', () => {
    expect(Object.keys(MAP_PALETTES).sort()).toEqual([...COLOUR_MODES].sort());
  });

  // The route is a Campus Green ribbon on a white edge (RouteLine.tsx, and CutRoute.tsx on the cut floor). It reads
  // where the green stands out from what's under it, or where the white edge does and the green stands out from the
  // edge. The "you are here" dot is the same two colours. The walked part is grey on the same white edge (v2-B7),
  // so it is checked with the same function and the same edge.
  function routeContrast(green: string, edge: string, under: string) {
    const g = contrastRatio(green, under);
    const e = Math.min(contrastRatio(edge, under), contrastRatio(green, edge));
    return { best: Math.max(g, e), text: `green ${g.toFixed(2)}:1, edge ${e.toFixed(2)}:1` };
  }

  const routeRows = COLOUR_MODES.flatMap((mode) => {
    const p = MAP_PALETTES[mode];
    const { slab, hall } = cutTones(p);
    const under = {
      ground: p.ground,
      path: p.path,
      road: p.road,
      'cut slab': `#${slab.getHexString()}`,
      'cut hallway': `#${hall.getHexString()}`,
    };
    return Object.entries(under).map(([name, colour]) => ({
      name: `${mode} route over ${name}`,
      walked: p.walked,
      under: colour,
    }));
  });
  it.each(routeRows)('$name: the route reads (green or its white edge at 3:1)', ({ name, under }) => {
    const { best, text } = routeContrast(CAMPUS_GREEN, '#ffffff', under);
    expect(best, `${name}: ${text}`).toBeGreaterThanOrEqual(AA_UI);
  });
  it.each(routeRows)('$name: the walked route reads (grey or its white edge at 3:1)', ({ name, walked, under }) => {
    const { best, text } = routeContrast(walked, '#ffffff', under);
    expect(best, `${name} walked: ${text}`).toBeGreaterThanOrEqual(AA_UI);
  });

  // While a building is cut open the outdoor route fades 45% into the ground on purpose (RouteLine.tsx, `dimmed`), so
  // it is exempt from 3:1. This floor only stops it fading further: Grey's ground is the closest at 1.49:1. three.js
  // lerps in linear RGB, as here.
  const DIMMED_OPACITY = 0.45;
  const DIMMED_FLOOR = 1.4;
  const faded = (colour: string, ground: string) =>
    `#${new Color(ground).lerp(new Color(colour), DIMMED_OPACITY).getHexString()}`;
  const dimmedRows = COLOUR_MODES.flatMap((mode) => {
    const p = MAP_PALETTES[mode];
    return Object.entries({ ground: p.ground, path: p.path, road: p.road }).map(([name, under]) => ({
      name: `${mode} dimmed route over ${name}`,
      ground: p.ground,
      walked: p.walked,
      under,
    }));
  });
  it.each(dimmedRows)('$name: still shows (1.4:1)', ({ name, ground, under }) => {
    const { best, text } = routeContrast(faded(CAMPUS_GREEN, ground), faded('#ffffff', ground), under);
    expect(best, `${name}: ${text}`).toBeGreaterThanOrEqual(DIMMED_FLOOR);
  });
  it.each(dimmedRows)('$name: the dimmed walked route still shows (1.4:1)', ({ name, ground, walked, under }) => {
    const { best, text } = routeContrast(faded(walked, ground), faded('#ffffff', ground), under);
    expect(best, `${name} walked: ${text}`).toBeGreaterThanOrEqual(DIMMED_FLOOR);
  });

  it.each(COLOUR_MODES)('%s: cut hallways stand out from the slab at 3:1', (mode) => {
    const { slab, hall } = cutTones(MAP_PALETTES[mode]);
    const ratio = contrastRatio(`#${slab.getHexString()}`, `#${hall.getHexString()}`);
    expect(ratio, `hall on slab is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_UI);
  });
});
