// Static build: node build.mjs [--site-url https://example.com]
// Reads public/, src/ and writes dist/ (index.html, fr/index.html, sitemap, robots, manifest, assets).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { renderPage, renderBunkitsu } from "./src/page.mjs";

const ROOT = import.meta.dirname;
const DIST = path.join(ROOT, "dist");
const argIdx = process.argv.indexOf("--site-url");
const siteUrl = (argIdx > 0 ? process.argv[argIdx + 1] : process.env.SITE_URL ?? "https://sabaki.example.com").replace(/\/$/, "");

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, "public"), DIST, { recursive: true });

// Client files (versioned query string for cache busting)
fs.mkdirSync(path.join(DIST, "assets/js"), { recursive: true });
for (const f of ["engine.js", "console-render.js"]) fs.copyFileSync(path.join(ROOT, "src", f), path.join(DIST, "assets/js", f));
fs.copyFileSync(path.join(ROOT, "src/client.js"), path.join(DIST, "assets/js/main.js"));
fs.copyFileSync(path.join(ROOT, "src/styles.css"), path.join(DIST, "assets/styles.css"));

const hash = crypto.createHash("md5");
for (const f of ["src/client.js", "src/styles.css", "src/engine.js", "src/console-render.js"]) hash.update(fs.readFileSync(path.join(ROOT, f)));
const version = hash.digest("hex").slice(0, 8);

// Demo data for the static first render
const router = JSON.parse(fs.readFileSync(path.join(ROOT, "public/demo/router.json"), "utf8"));
const weights = Object.fromEntries(router.map((p) => [p.domain, JSON.parse(fs.readFileSync(path.join(ROOT, "public", p.weights), "utf8"))]));
const ctx = { siteUrl, version, router, weights };

fs.writeFileSync(path.join(DIST, "index.html"), renderPage("en", ctx));
fs.mkdirSync(path.join(DIST, "fr"), { recursive: true });
fs.writeFileSync(path.join(DIST, "fr/index.html"), renderPage("fr", ctx));
fs.mkdirSync(path.join(DIST, "bunkitsu"), { recursive: true });
fs.writeFileSync(path.join(DIST, "bunkitsu/index.html"), renderBunkitsu("en", ctx));
fs.mkdirSync(path.join(DIST, "fr/bunkitsu"), { recursive: true });
fs.writeFileSync(path.join(DIST, "fr/bunkitsu/index.html"), renderBunkitsu("fr", ctx));

const today = new Date().toISOString().slice(0, 10);
const alt = `    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/"/>\n    <xhtml:link rel="alternate" hreflang="fr" href="${siteUrl}/fr/"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`;
fs.writeFileSync(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
${alt}
  </url>
  <url>
    <loc>${siteUrl}/fr/</loc>
    <lastmod>${today}</lastmod>
${alt}
  </url>
  <url>
    <loc>${siteUrl}/bunkitsu/</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/bunkitsu/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${siteUrl}/fr/bunkitsu/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/bunkitsu/"/>
  </url>
  <url>
    <loc>${siteUrl}/fr/bunkitsu/</loc>
    <lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/bunkitsu/"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${siteUrl}/fr/bunkitsu/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/bunkitsu/"/>
  </url>
</urlset>
`,
);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
fs.writeFileSync(
  path.join(DIST, "manifest.webmanifest"),
  JSON.stringify({
    name: "Sabaki",
    short_name: "Sabaki",
    description: "Typed decisions on CPU, in milliseconds.",
    start_url: "./",
    display: "browser",
    background_color: "#fbf5ed",
    theme_color: "#d4571c",
    icons: [
      { src: "assets/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "assets/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }, null, 2),
);
// Hosting helpers (Netlify / Cloudflare Pages style): long cache for hashed-by-query assets.
fs.writeFileSync(path.join(DIST, "_headers"), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/demo/*\n  Cache-Control: public, max-age=86400\n/\n  Cache-Control: public, max-age=0, must-revalidate\n/fr/\n  Cache-Control: public, max-age=0, must-revalidate\n`);
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
console.log(`built → dist/  (site url ${siteUrl}, assets v${version})`);
