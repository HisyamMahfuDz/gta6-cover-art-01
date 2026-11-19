# Neon Coast Cover Studio

A free, offline web app that turns your photo and a caption into multi-panel
GTA-style cover art — the poster / loading-screen look with a neon-sunset
grade — and exports it as a PNG to share. Photos never leave your machine:
everything runs in the browser from static files, no network request.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

1. Load one or two photos (or use the bundled samples).
2. Pick a layout (Hero + Three, Four Panel, Full Bleed, Tilted Snapshots).
3. Pick a colour grade (Vice Sunset, Neon Night, Teal Dawn, Mono Noir, Palm Gold).
4. Write your title + subtitle — the title is set in sunset-gradient Anton
   lettering, the subtitle in glowing Pacifico script.
5. Crop each panel photo with the zoom / move sliders.
6. Export PNG in **1080 × 1080**, **1080 × 1350** or **1920 × 1080** — or all
   three at once.

## Original art

All lettering and art is original: the fonts are **Anton** and **Pacifico**,
both under the SIL Open Font License (texts in `app/fonts/`). No Rockstar
Games logo, official artwork or fonts are used anywhere.

## How it is built

- `app/index.html` + `app/style.css` — the editor.
- `app/src/cover.js` — the cover engine (panels, grades, lettering, grain).
- `app/src/presets.js` — layouts, grades, export sizes.
- `app/src/main.js` — editor wiring + export.
- `app/src/shots.js` — fixed `?shot=` scenes used for the screenshots.
- `main.ts` (Node 22) copies `app/` + `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored `vendor/makefun-app.ts`.

Built for [make.fun](https://make.fun/r/0a6j83jv) — competition
`gta6-cover-art-01`. Licensed MIT, see `LICENSE`.
