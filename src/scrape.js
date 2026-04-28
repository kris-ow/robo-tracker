// Scrape robotaxitracker.com homepage for the "Fleet Growth → UNSUPERVISED
// FLEET" section, which is the only place the per-city unsupervised count is
// broken out (e.g. AUSTIN 15, DALLAS 2, HOUSTON 2 → fleet 19).
//
// The site is Next.js with client-side data; /api is disallowed by robots.txt,
// so we render the page in Chromium and parse rendered text. We deliberately
// don't anchor on Tailwind class names (they churn) — instead we anchor on
// the section's stable copy ("UNSUPERVISED FLEET" / "Use the toggle...").

import { chromium } from 'playwright';

const URL = 'https://robotaxitracker.com/';
const SECTION_START = 'UNSUPERVISED FLEET';
// Marker text that appears on the line immediately before the city/count pairs.
const CITIES_START = 'Use the toggle to compare against the full fleet';
// First city/count pair must look like "CITY\nNUMBER". A line that breaks
// that pattern (e.g. a date label like "Jun 25" or empty) ends the list.
const CITY_LINE = /^[A-Z][A-Z .'-]+$/;
const NUMBER_LINE = /^[\d,]+$/;

export async function scrape() {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent: 'robo-tracker (github.com/kris-ow/robo-tracker)',
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait for the section to actually render (client fetches the data).
    await page.getByText(SECTION_START, { exact: false }).first()
      .waitFor({ timeout: 30_000 });
    await page.getByText(CITIES_START, { exact: false }).first()
      .waitFor({ timeout: 30_000 });

    const text = await page.evaluate(() => document.body.innerText);
    const cities = parseCities(text);

    if (cities.length === 0) {
      throw new Error(`No cities parsed — section layout may have changed. Marker "${CITIES_START}" found but no CITY/NUMBER pairs followed.`);
    }

    // Sanity: total of city counts should match the UNSUPERVISED FLEET total.
    const fleetTotal = parseFleetTotal(text);
    const sum = cities.reduce((n, c) => n + c.unsupervised, 0);
    if (fleetTotal != null && sum !== fleetTotal) {
      console.warn(`Warning: city sum (${sum}) != UNSUPERVISED FLEET total (${fleetTotal}). Continuing.`);
    }

    return {
      fetched_at: new Date().toISOString(),
      source: URL,
      total_unsupervised: fleetTotal,
      cities,
    };
  } finally {
    await browser.close();
  }
}

function parseFleetTotal(text) {
  const lines = text.split('\n').map(l => l.trim());
  const i = lines.indexOf(SECTION_START);
  if (i < 0) return null;
  // Number is on the line directly after the heading.
  const n = lines[i + 1];
  return NUMBER_LINE.test(n) ? Number(n.replace(/,/g, '')) : null;
}

function parseCities(text) {
  const lines = text.split('\n').map(l => l.trim());
  const start = lines.indexOf(CITIES_START);
  if (start < 0) return [];

  const out = [];
  for (let i = start + 1; i < lines.length - 1; i += 2) {
    const name = lines[i];
    const num = lines[i + 1];
    if (!CITY_LINE.test(name) || !NUMBER_LINE.test(num)) break;
    out.push({
      city: titleCase(name),
      unsupervised: Number(num.replace(/,/g, '')),
    });
  }
  return out;
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
