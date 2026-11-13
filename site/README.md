# Sabaki landing page

Static, bilingual (English at `/`, French at `/fr/`) landing page for the
[sabaki](https://github.com/sabaki-js/sabaki) npm library. Plain HTML, CSS and JavaScript: no framework,
no runtime dependencies, no third-party requests. Fonts are self-hosted.

## Use it

```bash
npm install                 # dev-only: used to regenerate icons and OG images
node build.mjs --site-url https://your-domain.tld   # writes dist/
node scripts/serve.mjs      # preview dist/ on http://localhost:4173
node scripts/check.mjs      # SEO and accessibility sanity checks on dist/
```

Upload `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3). **Set `--site-url` to your real
domain**: it feeds the canonical URLs, hreflang alternates, Open Graph tags, JSON-LD and `sitemap.xml`.

## What is in the page

- A live demo console that runs the real nano weights of four sabaki plugins in the browser, using a port of
  the library's own router and TF-IDF predictor (`src/engine.js`). The first result is pre-rendered at build time,
  so crawlers and visitors without JavaScript see it too.
- Architecture diagram, model sizes (nano, mini, generalist), ONNX int8 quantization, plugin ledger, benchmarks,
  comparison, quickstart snippets (their outputs come from the real weights), limits, and a FAQ.
- SEO: title and description per language, canonical, hreflang, Open Graph and Twitter cards, JSON-LD
  (`Organization`, `WebSite`, `WebPage`, `SoftwareSourceCode`, `FAQPage`), sitemap, robots.txt, web manifest,
  favicons, semantic headings, image dimensions, `loading="lazy"` below the fold.
- Accessibility: skip link, keyboard-operable tabs (arrow keys), visible focus, light and dark themes,
  `prefers-reduced-motion`, tables with real headers.

## Edit it

| What | Where |
| --- | --- |
| All text, both languages | `src/i18n.mjs` |
| Numbers, plugin list, benchmark scores | `src/data.mjs` |
| Page structure | `src/page.mjs` |
| Styles | `src/styles.css` |
| Demo console behavior | `src/client.js`, `src/engine.js` |
| Mascot images | `public/assets/mascot/*.webp` (see `MASCOT-PROMPTS.md`) |

`npm run assets` regenerates the favicons, app icons, Open Graph images and the mascot placeholders from
`public/assets/logo.svg`. It overwrites the mascot files, so run it only before you add your own illustrations.

`npm run demo-data` rebuilds the demo weights from local clones of the plugin repositories:
`node scripts/make-demo-data.mjs <folder containing plugin-* clones>`.

## Sources of the numbers

Every figure comes from the sabaki-js repositories: the organization README (benchmark table, latency,
throughput), `sabaki/GUIDE.md` (modes, quantization, calibration, per-workflow scores), `sabaki/ROADMAP.md`
(status and planned work) and each plugin's README and manifest. Scores for OpenDecider-nano, Laya and Jev are
the published numbers quoted there, not re-measured.
