// Recon: render each public page in Chromium, dump the rendered text + a
// trimmed HTML snapshot to debug/ so we can locate per-city unsupervised counts
// and choose stable selectors. Not part of the scheduled run.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = ['/', '/vehicles', '/map', '/wait-times', '/leaderboards', '/trips'];
const BASE = 'https://robotaxitracker.com';
const OUT = 'debug';

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'robo-tracker recon (github.com/kris-ow/robo-tracker)' });
await mkdir(OUT, { recursive: true });

for (const path of PAGES) {
  const page = await ctx.newPage();
  const url = BASE + path;
  console.log(`→ ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Page uses websockets/long-polling so networkidle never fires; give
  // client-side fetches a fixed budget to render data.
  await page.waitForTimeout(8000);

  const text = await page.evaluate(() => document.body.innerText);
  const html = await page.content();
  const slug = path === '/' ? 'home' : path.replace(/\//g, '_');
  await writeFile(join(OUT, `${slug}.txt`), text);
  await writeFile(join(OUT, `${slug}.html`), html);
  await page.close();
}

await browser.close();
console.log(`\nWrote rendered text + HTML for ${PAGES.length} pages to ${OUT}/`);
