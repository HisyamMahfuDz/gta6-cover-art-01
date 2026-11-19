[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/HisyamMahfuDz/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/HisyamMahfuDz/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Neon Coast Cover Studio

A free web app that runs entirely offline and turns your photos plus a
caption into multi-panel cover art in the style of a game poster or loading
screen — neon sunset colours, bold gradient lettering — then exports it as a
PNG you can share. Nothing leaves your machine: the app is plain static
files, and it makes no network request at all.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

1. Load one or two photos of your own, or use the bundled samples.
2. Choose a layout: Hero + Three, Four Panel, Full Bleed or Tilted Snapshots.
3. Choose a colour grade: Vice Sunset, Neon Night, Teal Dawn, Mono Noir or Palm Gold.
4. Write a title and a subtitle — the title is set in Anton with a sunset
   gradient, the subtitle in glowing Pacifico script.
5. Click a panel on the cover and crop its photo with the zoom and move sliders.
6. Export a PNG at **1080 × 1080**, **1080 × 1350** or **1920 × 1080** — or all
   three at once.

## Original art

The lettering and the art are original. The fonts are **Anton** and
**Pacifico**, both under the SIL Open Font License (the licence texts sit in
`app/fonts/` next to the font files). No Rockstar Games logo, official
artwork or fonts are used anywhere, and the app is not affiliated with
Rockstar Games.

## How it is built

- `app/index.html` and `app/style.css` — the editor page.
- `app/src/cover.js` — the cover engine: panels, grades, lettering, grain.
- `app/src/presets.js` — the layouts, grades and export sizes.
- `app/src/main.js` — the editor wiring, the export and the export checks.
- `app/src/shots.js` — the fixed `?shot=` scenes the screenshots use.
- `tools/shoot.mjs` — drives headless Chrome, takes the screenshots and runs
  the export assertions, writing `tools/assert-report.json`.
- `main.ts` (Node 22) copies `app/` and `screenshots/` to the output folder
  and writes `dossier.json` there with the vendored `vendor/makefun-app.ts`.

Built for [make.fun](https://make.fun/r/0a6j83jv) — competition
`gta6-cover-art-01`. Licensed MIT, see `LICENSE`.
