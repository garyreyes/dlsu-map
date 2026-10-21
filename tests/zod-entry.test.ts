// Every schema in the app must come from src/shared/data/zod.ts, which turns Zod's eval probe off before any schema
// is built. One file importing 'zod' directly would build its schemas with the probe on, and the CSP would log it on
// the live site.
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

describe('the Zod entry point', () => {
  it("is the only file in src/ that imports 'zod' itself", () => {
    const direct = sourceFiles('src')
      .filter((f) => /from ['"]zod(\/[^'"]*)?['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => f.split(sep).join('/'));
    expect(direct).toStrictEqual(['src/shared/data/zod.ts']);
  });
});
