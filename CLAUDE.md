# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Headless-Chromium scraper that pulls the **per-city unsupervised Tesla Robotaxi count** from [robotaxitracker.com](https://robotaxitracker.com/) and writes `data/counts.json`. Runs on a schedule via GitHub Actions; the JSON is consumed downstream by the TTT dashboard at `../ttt/`.

## Commands

```bash
npm install
npx playwright install chromium  # first time only
npm run scrape   # production scrape → data/counts.json
npm run recon    # render every public page → debug/*.{txt,html} for selector hunting
```

There are no tests. There is no lint config. `npm run scrape` is the smoke test — exit code is non-zero if the section layout changed.

## Why scrape, not /api

`robotaxitracker.com/robots.txt` disallows `/api/` (the Next.js client hits private endpoints to hydrate). Rendering the page in Playwright as a normal browser would is the legitimate path; do **not** add code that hits `/api/*` directly.

## Architecture

Three files, each with one responsibility:

- **`src/scrape.js`** — exports `scrape()`. Launches Chromium, waits for the homepage's "Fleet Growth" section to render, parses `document.body.innerText`, returns `{ fetched_at, source, total_unsupervised, cities[] }`.
- **`src/index.js`** — CLI entry. Calls `scrape()`, writes `data/counts.json`, prints a one-line summary.
- **`src/recon.js`** — diagnostic-only. Dumps rendered text + HTML for every public page into `debug/` so we can locate data after a layout change. Not run in CI.

### How the parser anchors

The page is Next.js with Tailwind classes that mangle on every deploy, so `scrape.js` deliberately does **not** key off CSS selectors. Instead it anchors on stable English copy:

- `UNSUPERVISED FLEET` — heading; the next line is the global total (e.g. `19`).
- `Use the toggle to compare against the full fleet` — the line directly *before* the city/count pairs. Reading two lines at a time after this marker yields `(CITY, count)` pairs until a non-matching line ends the list.

A `CITY_LINE` regex (`^[A-Z][A-Z .'-]+$`) and `NUMBER_LINE` regex break the loop on the first non-pair (e.g. the chart's `Jun 25` axis labels). If the marker copy ever changes, both `recon` and `scrape` need updating — the constants at the top of `scrape.js` are the single source of truth.

A sanity check warns (does not fail) if `sum(city counts) !== UNSUPERVISED FLEET total`.

### What's *not* on the page

Only **Austin, Dallas, Houston** appear under unsupervised today. Bay Area is listed as a service area but is supervised-only (human driver) per the site's disclaimer, so it does not appear in the unsupervised section. New cities will surface automatically — the parser is not hardcoded to these three.

## Schedule

`.github/workflows/scrape.yml` runs `0 3,11,19 * * *` UTC = **04:00 / 12:00 / 20:00 CET** in winter. During CEST (DST, late March – late October) the local times shift to 05:00 / 13:00 / 21:00. GitHub Actions cron is UTC-only, so this drift is intentional — do not "fix" it by adding extra cron entries.

The workflow commits `data/counts.json` back to `main` only when content changes (`git diff --staged --quiet`), keeping history clean of no-op commits.

## Downstream integration (TTT)

`../ttt/` is a Vite + React app whose data layer is build-time JSON in `src/data/*.json`. The intended hand-off is one of:

1. TTT fetches `https://raw.githubusercontent.com/kris-ow/robo-tracker/main/data/counts.json` at build or runtime.
2. This repo opens a PR (or pushes a commit) to `kris-ow/ttt` updating `src/data/robotaxi-counts.json`.

Decide before adding integration code. Either way, the schema in `data/counts.json` is the contract; don't break it without updating the consumer.
