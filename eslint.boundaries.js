// Layer rules from docs/ARCHITECTURE.md §6, enforced with ESLint's built-in rules (no plugin, decided in 1a).
// tests/boundaries.test.ts proves each rule blocks what it should and allows what it should; change both together.
//
// Flat config replaces (does not merge) a rule's options when two blocks match the same file, so each block below
// re-lists everything that applies to its files, and later blocks are the more specific ones.
//
// Every import rule covers both static imports/re-exports (no-restricted-imports) and dynamic `import('…')`
// (no-restricted-syntax), because React.lazy(() => import(…)) is how the 3D scene will be split.

/** @typedef {{ regex: string, message: string }} Pattern */

const fixMessage = "Use the '@/' alias without '..' in it: '@/shared/…' or '@/features/<name>'.";

/** @type {Pattern[]} Apply everywhere in src/: paths that would slip around the alias checks below. */
const common = [
  { regex: '^@/(.*/)?\\.\\.(/|$)', message: fixMessage },
  { regex: '(^|/)src(/|$)', message: fixMessage },
];
/** @type {Pattern} */
const toIndex = {
  regex: '^@/features/[^/]+/.+',
  message: "Import another feature only through its index: '@/features/<name>' (ARCHITECTURE §6).",
};
/** @type {Pattern} */
const noAppShell = {
  regex: '^(@/|(\\.\\./)+)app(/|$)',
  message: 'Only the app shell (src/app/) imports features, never the other way round.',
};
/** @type {Pattern} */
const noReact = {
  regex: '^(react|react-dom|@react-three/[^/]+)(/|$)',
  message: "Logic files are pure: no React. Move this into the feature's components/ (ARCHITECTURE §6).",
};
/** @type {Pattern} */
const sharedStaysBelow = {
  regex: '^(@/|(\\.\\./)+)(features|app)(/|$)',
  message: 'shared/ sits below features and the app shell, so it never imports them.',
};
/** @param {number} depth How many '../' leave the feature from this folder. @returns {Pattern} */
const leaveFeature = (depth) => ({
  regex: `^(\\.\\./){${String(depth)},}`,
  message: `Don't reach out of this feature with '${'../'.repeat(depth)}'. Use '@/shared/…' or '@/features/<name>'.`,
});

/** esquery regex literals end at an unescaped '/', so escape the ones inside the pattern. */
const toSelectorRegex = (/** @type {string} */ regex) => regex.replaceAll('/', '\\/');

/**
 * One block: the same patterns for static and dynamic imports.
 * @param {string[]} files
 * @param {Pattern[]} patterns
 * @param {string[]} [ignores]
 * @returns {import('eslint').Linter.Config}
 */
const restrict = (files, patterns, ignores = []) => {
  const all = [...common, ...patterns];
  return {
    files,
    ignores,
    rules: {
      'no-restricted-imports': ['error', { patterns: all }],
      'no-restricted-syntax': [
        'error',
        ...all.map(({ regex, message }) => ({
          selector: `ImportExpression > Literal.source[value=/${toSelectorRegex(regex)}/]`,
          message,
        })),
      ],
    },
  };
};

const network = 'Only src/shared/data/ talks to the network, and only for /data/*.json (ARCHITECTURE §6).';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Everything in src/ (main.tsx included) gets the alias checks.
  restrict(['src/**/*.{ts,tsx}'], []),
  // App shell: calls features through their index only.
  restrict(['src/app/**/*.{ts,tsx}'], [toIndex]),
  // Feature top level: index.ts, logic files, their tests, and any top-level .tsx.
  restrict(['src/features/*/*.{ts,tsx}'], [toIndex, noAppShell, leaveFeature(1)]),
  // Logic files also stay free of React (the feature's index and tests may use it).
  restrict(
    ['src/features/*/*.ts'],
    [toIndex, noAppShell, leaveFeature(1), noReact],
    ['src/features/*/index.ts', 'src/features/*/*.test.ts'],
  ),
  // Any other subfolder of a feature counts as logic too (ARCHITECTURE §6 has only logic and components/).
  restrict(
    ['src/features/*/*/**/*.ts'],
    [toIndex, noAppShell, leaveFeature(2), noReact],
    ['src/features/*/components/**', '**/*.test.ts'],
  ),
  // UI. Nested component folders may still reach their own feature's logic.
  restrict(['src/features/*/components/*.{ts,tsx}'], [toIndex, noAppShell, leaveFeature(2)]),
  restrict(['src/features/*/components/*/**/*.{ts,tsx}'], [toIndex, noAppShell, leaveFeature(3)]),
  restrict(['src/shared/**/*.{ts,tsx}'], [sharedStaysBelow]),
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/data/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({ name, message: network })),
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].map((object) => ({ object, property: 'fetch', message: network })),
        { object: 'navigator', property: 'sendBeacon', message: network },
      ],
    },
  },
];
