// Scheduled entry point. Renders robotaxitracker.com pages in Chromium,
// extracts per-city unsupervised counts, and writes data/counts.json.
//
// Selectors are confirmed via `npm run recon` and live in src/scrape.js.

import { writeFile, mkdir } from 'node:fs/promises';
import { scrape } from './scrape.js';

const out = await scrape();

await mkdir('data', { recursive: true });
await writeFile('data/counts.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote data/counts.json (${out.cities.length} cities, fetched_at=${out.fetched_at})`);
