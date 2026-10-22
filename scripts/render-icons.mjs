// Icon renderer (10a): draws public/icons/icon.svg to the PNG sizes the manifest and iOS need. Run by hand with
// `npm run icons` after the SVG changes; the PNGs are committed, so `npm run build` needs no browser.
// Uses the Chromium from @playwright/test. PLAYWRIGHT_CHANNEL=chrome uses the installed Chrome (PROJECT_FACTS).
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const DIR = 'public/icons';
// The art is full bleed with the building inside the safe circle, so the maskable icon is the same picture.
const OUTPUTS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];

const svg = readFileSync(`${DIR}/icon.svg`, 'utf8');
const channel = process.env.PLAYWRIGHT_CHANNEL;
const browser = await chromium.launch(channel ? { channel } : {});
try {
  for (const [name, size] of OUTPUTS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    writeFileSync(
      `${DIR}/${name}`,
      await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } }),
    );
    await page.close();
    console.log(`${DIR}/${name} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
