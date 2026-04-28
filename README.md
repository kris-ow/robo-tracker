# robo-tracker

Scrapes unsupervised Tesla Robotaxi counts by city from [robotaxitracker.com](https://robotaxitracker.com/) and emits `data/counts.json` for the [TTT dashboard](https://github.com/kris-ow/ttt) to consume.

## Why scrape (not /api)

`robotaxitracker.com/robots.txt` disallows `/api/`. We render the page in Playwright (Chromium) and read the DOM — same as a normal visitor — instead of hitting the private API directly.

## Run locally

```bash
npm install
npx playwright install chromium
npm run scrape
```

Output: `data/counts.json`.

## Schedule

GitHub Actions runs `npm run scrape` at `0 3,11,19 * * *` UTC — i.e. **04:00 / 12:00 / 20:00 CET** in winter, shifting +1h during CEST (summer). See `.github/workflows/scrape.yml`.

## Output schema

```json
{
  "fetched_at": "2026-04-28T11:00:00.000Z",
  "source": "https://robotaxitracker.com/",
  "cities": [
    { "city": "Austin", "unsupervised": 13 }
  ]
}
```
