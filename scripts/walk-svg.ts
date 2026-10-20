// Draws public/data/campus.json's walk network as out/walk.svg (gitignored), to check it by eye: buildings grey, paths
// green, streets grey, Taft's sidewalks blue, crosswalks red, door links magenta, gates yellow, entrances black
// (hollow until verified). Dev-only. Run `npm run compile-data`, then `node scripts/walk-svg.ts`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { campusSchema, type Campus } from '../src/shared/data/campus.ts';

const root = new URL('../', import.meta.url);
const COLOURS: Readonly<Record<Campus['walk']['ways'][number]['kind'], string>> = {
  path: '#2a7',
  steps: '#a52',
  street: '#999',
  sidewalk: '#06c',
  crossing: '#e00',
  door: '#d0d',
};
const SCALE = 2; // pixels per meter

function draw(c: Campus): string {
  const xs = c.campus.flatMap((r) => r.filter((_, i) => i % 2 === 0));
  const ys = c.campus.flatMap((r) => r.filter((_, i) => i % 2 === 1));
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs) - 60,
    Math.max(...xs) + 60,
    Math.min(...ys) - 60,
    Math.max(...ys) + 60,
  ];
  const X = (x: number) => ((x - minX) * SCALE).toFixed(1);
  const Y = (y: number) => ((maxY - y) * SCALE).toFixed(1); // north up
  const pt = (i: number) => [c.walk.points[2 * i] ?? 0, c.walk.points[2 * i + 1] ?? 0] as const;
  const out: string[] = [];
  for (const b of c.buildings)
    for (const v of b.volumes)
      out.push(
        `<polygon points="${v.outline.map((n, i) => (i % 2 ? Y(n) : X(n))).join(' ')}" fill="#e4e4e4" stroke="#aaa"/>`,
      );
  for (const [a, b, w] of c.walk.links) {
    const kind = c.walk.ways[w]?.kind ?? 'path';
    const [p, q] = [pt(a), pt(b)];
    const width = kind === 'crossing' || kind === 'door' ? 4 : 2;
    out.push(
      `<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(q[0])}" y2="${Y(q[1])}" stroke="${COLOURS[kind]}" stroke-width="${String(width)}"/>`,
    );
  }
  for (const e of c.entrances) {
    const [x, y] = pt(e.point);
    out.push(
      `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="${e.verified ? '#000' : '#fff'}" stroke="#000" stroke-width="2"><title>${e.building} ${e.kind}</title></circle>`,
      `<text x="${X(x + 3)}" y="${Y(y - 3)}" font-size="12">${e.building}${e.kind === 'main' ? '' : ` (${e.kind})`}</text>`,
    );
  }
  for (const g of c.gates) {
    const [x, y] = pt(g.point);
    out.push(
      `<circle cx="${X(x)}" cy="${Y(y)}" r="6" fill="#fc0" stroke="#000"/><text x="${X(x + 5)}" y="${Y(y)}" font-size="14">${g.name}</text>`,
    );
  }
  const [w, h] = [(maxX - minX) * SCALE, (maxY - minY) * SCALE];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="${h.toFixed(0)}" style="background:#fff">${out.join('')}</svg>`;
}

const campus = campusSchema.parse(JSON.parse(readFileSync(new URL('public/data/campus.json', root), 'utf8')));
mkdirSync(new URL('out/', root), { recursive: true });
writeFileSync(new URL('out/walk.svg', root), draw(campus));
console.log('wrote out/walk.svg');
