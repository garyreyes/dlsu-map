// The app's one way into Zod. Zod 4 decides at schema build time whether to compile fast parsers with `new Function`,
// and probes for it even when it then falls back. The CSP has no 'unsafe-eval' (D5), so the probe alone logs a
// violation. jitless skips both, and it has to be set before any schema is built: every schema file imports `z` from
// here, so this module always runs first (PROJECT_FACTS, Zod and the CSP). tests/zod-entry.test.ts keeps it that way.
import { z } from 'zod';

z.config({ jitless: true });

export { z };
