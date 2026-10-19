// Proves the layer rules in eslint.boundaries.js block what ARCHITECTURE §6 forbids and allow what it permits.
// If a rule silently stopped matching (a glob typo, two blocks overriding each other), lint would pass on bad code;
// these cases are how we'd find out.
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import boundaries from '../eslint.boundaries.js';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [{ files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } }, ...boundaries],
});

/** Lints `code` as if it lived at `filePath` and returns the ids of the rules that fired. */
async function rulesFired(filePath: string, code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error('ESLint returned no result');
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length > 0) throw new Error(`Parse error in test case: ${fatal[0]?.message ?? ''}`);
  return result.messages.map((m) => m.ruleId);
}

const IMPORTS = 'no-restricted-imports';
const GLOBALS = 'no-restricted-globals';
const PROPERTIES = 'no-restricted-properties';
const SYNTAX = 'no-restricted-syntax'; // dynamic import('…')

type Case = [label: string, filePath: string, code: string, expected: string[]];

const cases: Case[] = [
  // Feature logic files: src/features/*/*.ts
  ['logic → another feature index', 'src/features/routing/route.ts', "import { x } from '@/features/search';", []],
  ['logic → own file', 'src/features/routing/route.ts', "import { x } from './graph';", []],
  ['logic → shared', 'src/features/routing/route.ts', "import { x } from '@/shared/config/costs';", []],
  ['logic → npm package', 'src/features/routing/route.ts', "import createGraph from 'ngraph.graph';", []],
  [
    'logic → deep into another feature',
    'src/features/routing/route.ts',
    "import { x } from '@/features/search/parse-room-code';",
    [IMPORTS],
  ],
  ['logic → sibling feature via ../', 'src/features/routing/route.ts', "import { x } from '../search/x';", [IMPORTS]],
  ['logic → app shell', 'src/features/routing/route.ts', "import { x } from '@/app/App';", [IMPORTS]],
  ['logic → react', 'src/features/routing/route.ts', "import { useState } from 'react';", [IMPORTS]],
  ['logic → react-dom/client', 'src/features/routing/route.ts', "import { x } from 'react-dom/client';", [IMPORTS]],
  ['logic → R3F', 'src/features/routing/route.ts', "import { Canvas } from '@react-three/fiber';", [IMPORTS]],
  ['logic re-export, deep', 'src/features/routing/route.ts', "export { x } from '@/features/search/x';", [IMPORTS]],
  ['logic → fetch', 'src/features/routing/route.ts', "void fetch('/data/rooms.json');", [GLOBALS]],
  // A logic file's test and the feature's index may use React.
  ['logic test → react', 'src/features/search/parse-room-code.test.ts', "import { act } from 'react';", []],
  ['feature index → own component', 'src/features/search/index.ts', "export { Bar } from './components/Bar';", []],
  ['feature index → react', 'src/features/search/index.ts', "import { lazy } from 'react';", []],
  // UI: src/features/*/components/**
  ['component → react', 'src/features/search/components/Bar.tsx', "import { useState } from 'react';", []],
  [
    'component → own logic',
    'src/features/search/components/Bar.tsx',
    "import { parseRoomCode } from '../parse-room-code';",
    [],
  ],
  ['component → another feature index', 'src/features/search/components/Bar.tsx', "import '@/features/routing';", []],
  [
    'component → another feature via ../../',
    'src/features/search/components/Bar.tsx',
    "import { x } from '../../routing/route';",
    [IMPORTS],
  ],
  [
    'component → deep into another feature',
    'src/features/search/components/Bar.tsx',
    "import { x } from '@/features/routing/route';",
    [IMPORTS],
  ],
  ['component → fetch', 'src/features/search/components/Bar.tsx', "void fetch('/data/x.json');", [GLOBALS]],
  ['component → window.fetch', 'src/features/search/components/Bar.tsx', "void window.fetch('/x');", [PROPERTIES]],
  ['component → XMLHttpRequest', 'src/features/search/components/Bar.tsx', 'new XMLHttpRequest();', [GLOBALS]],
  // shared/
  ['shared → shared', 'src/shared/ui/Button.tsx', "import { x } from '../config/palette';", []],
  ['shared → feature', 'src/shared/ui/Button.tsx', "import { x } from '@/features/search';", [IMPORTS]],
  ['shared → feature via ../', 'src/shared/ui/Button.tsx', "import { x } from '../../features/search';", [IMPORTS]],
  ['shared → app shell', 'src/shared/ui/Button.tsx', "import { x } from '../../app/App';", [IMPORTS]],
  ['shared/data → fetch', 'src/shared/data/load.ts', "void fetch('/data/campus.json');", []],
  ['shared/geo → fetch', 'src/shared/geo/project.ts', "void fetch('/data/campus.json');", [GLOBALS]],
  // App shell
  ['app → feature index', 'src/app/App.tsx', "import { x } from '@/features/search';", []],
  ['app → fetch', 'src/app/App.tsx', "void globalThis.fetch('/x');", [PROPERTIES]],
  ['app → deep into a feature', 'src/app/App.tsx', "import { x } from '@/features/search/deep';", [IMPORTS]],
  ['entry → app shell', 'src/main.tsx', "import { App } from '@/app/App';", []],
  // Dynamic import('…') follows the same rules as static imports.
  ['lazy → feature index', 'src/app/App.tsx', "void import('@/features/campus-scene');", []],
  ['lazy → deep into a feature', 'src/app/App.tsx', "void import('@/features/campus-scene/Scene');", [SYNTAX]],
  ['logic → lazy react', 'src/features/routing/route.ts', "void import('react');", [SYNTAX]],
  ['shared → lazy feature', 'src/shared/ui/Button.tsx', "void import('@/features/search');", [SYNTAX]],
  ['component → lazy own logic', 'src/features/search/components/Bar.tsx', "void import('../fuzzy');", []],
  // Paths that would slip around the alias checks.
  ['logic → alias with ..', 'src/features/routing/route.ts', "import { x } from '@/shared/../app/App';", [IMPORTS]],
  ['shared → out through src/', 'src/shared/ui/Button.tsx', "import { x } from '../../../src/app/App';", [IMPORTS]],
  ['app → bare src/ path', 'src/app/App.tsx', "import { x } from 'src/features/search';", [IMPORTS]],
  // Feature subfolders other than components/ are logic.
  ['logic subfolder → react', 'src/features/routing/graph/build.ts', "import { useMemo } from 'react';", [IMPORTS]],
  ['logic subfolder → own logic', 'src/features/routing/graph/build.ts', "import { x } from '../costs';", []],
  [
    'logic subfolder → another feature via ../../',
    'src/features/routing/graph/build.ts',
    "import { x } from '../../search/x';",
    [IMPORTS],
  ],
  // Nested component folders.
  [
    'nested component → own logic',
    'src/features/search/components/list/Row.tsx',
    "import { x } from '../../parse-room-code';",
    [],
  ],
  [
    'nested component → another feature',
    'src/features/search/components/list/Row.tsx',
    "import { x } from '../../../routing/route';",
    [IMPORTS],
  ],
  // Other ways to reach the network.
  ['component → WebSocket', 'src/features/search/components/Bar.tsx', "new WebSocket('wss://x');", [GLOBALS]],
  ['component → EventSource', 'src/features/search/components/Bar.tsx', "new EventSource('/x');", [GLOBALS]],
  ['component → sendBeacon', 'src/features/search/components/Bar.tsx', "navigator.sendBeacon('/x');", [PROPERTIES]],
];

describe('layer rules (ARCHITECTURE §6)', () => {
  it.each(cases)('%s', async (_label, filePath, code, expected) => {
    expect(await rulesFired(filePath, code)).toEqual(expected);
  });

  it('covers both outcomes for every rule', () => {
    // Each rule must be seen both firing and staying quiet, or a rule that never fires could hide here.
    for (const rule of [IMPORTS, GLOBALS, PROPERTIES, SYNTAX]) {
      expect(cases.some(([, , , e]) => e.includes(rule))).toBe(true);
    }
    expect(cases.some(([, , , e]) => e.length === 0)).toBe(true);
  });
});
