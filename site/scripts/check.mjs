// Static SEO / a11y sanity checks on dist/: node scripts/check.mjs
import fs from "node:fs"; import path from "node:path";
const DIST = path.resolve(import.meta.dirname, "../dist");
let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
for (const [name, file] of [["en", "index.html"], ["fr", "fr/index.html"]]) {
  const h = fs.readFileSync(path.join(DIST, file), "utf8");
  const g = (re) => (h.match(re) ?? [])[1];
  const title = g(/<title>([^<]*)<\/title>/), desc = g(/<meta name="description" content="([^"]*)"/);
  ok(title && title.length >= 30 && title.length <= 70, `${name} title ${title?.length} chars`);
  ok(desc && desc.length >= 110 && desc.length <= 165, `${name} description ${desc?.length} chars`);
  ok((h.match(/<h1[ >]/g) ?? []).length === 1, `${name} exactly one h1`);
  ok(/<link rel="canonical" href="https:\/\/[^"]+"/.test(h), `${name} canonical`);
  ok((h.match(/hreflang="/g) ?? []).length >= 3, `${name} hreflang alternates`);
  ok(/property="og:image" content="https:\/\/[^"]+\.png"/.test(h) && /twitter:card/.test(h), `${name} og + twitter tags`);
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  ok(ld.length === 1 && ld[0]["@graph"].some((n) => n["@type"] === "FAQPage" && n.mainEntity.length >= 8), `${name} JSON-LD parses, FAQPage present`);
  const ids = [...h.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  ok(dup.length === 0, `${name} unique ids ${dup.join(",")}`);
  const anchors = [...h.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  ok(anchors.every((a) => ids.includes(a)), `${name} all #anchors resolve`);
  const imgs = [...h.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  ok(imgs.every((i) => /alt="/.test(i) && /width="\d+"/.test(i) && /height="\d+"/.test(i)), `${name} ${imgs.length} imgs have alt + dimensions`);
  const files = [...h.matchAll(/(?:src|href)="((?:\.\.\/|\.\/)?assets\/[^"?]+)/g)].map((m) => m[1]);
  const base = name === "en" ? DIST : path.join(DIST, "fr");
  const missing = files.filter((f) => !fs.existsSync(path.join(base, f)));
  ok(missing.length === 0, `${name} local asset refs exist ${missing.join(",")}`);
  const hs = [...h.matchAll(/<h([1-6])[ >]/g)].map((m) => +m[1]); let skip = false;
  for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skip = true;
  ok(!skip, `${name} heading levels never skip`);
  ok(/<html lang="(en|fr)"/.test(h), `${name} html lang`);
  ok(!/https?:\/\/(fonts\.googleapis|cdn\.)/.test(h), `${name} no third-party requests`);
}
for (const f of ["sitemap.xml", "robots.txt", "manifest.webmanifest", "assets/og-image.png", "assets/og-image-fr.png", "assets/favicon.ico", "assets/apple-touch-icon.png"]) ok(fs.existsSync(path.join(DIST, f)), `dist/${f}`);
process.exit(fail ? 1 : 0);
