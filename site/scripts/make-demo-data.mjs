// Extracts the real nano weights + router manifests of the sabaki plugins into
// compact JSON files the landing page loads lazily (one file per domain).
//
// Usage: node scripts/make-demo-data.mjs <dir containing plugin-* clones>
//   e.g. git clone each https://github.com/sabaki-js/plugin-<name> into ~/src, then
//        node scripts/make-demo-data.mjs ~/src
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? process.env.SABAKI_REPOS ?? "..");
const out = path.resolve("public/demo");
// The four plugins trained on the public typed-decisions benchmark (no personal data).
const REPOS = [
  "plugin-customer-service",
  "plugin-invoice-processing",
  "plugin-security-incidents",
  "plugin-agent-trace-observability",
];

const r4 = (x) => Math.round(x * 1e4) / 1e4;
fs.mkdirSync(out, { recursive: true });
const router = [];
for (const repo of REPOS) {
  const dir = path.join(root, repo, "src");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const w = JSON.parse(fs.readFileSync(path.join(dir, "weights.json"), "utf8"));
  const compact = {
    workflow: w.workflow,
    vocab: w.vocab,
    idf: w.idf.map(r4),
    questions: Object.fromEntries(
      Object.entries(w.questions).map(([q, v]) => [
        q,
        { classes: v.classes, coef: v.coef.map((row) => row.map(r4)), intercept: v.intercept.map(r4) },
      ]),
    ),
  };
  const file = `${manifest.domain}.json`;
  fs.writeFileSync(path.join(out, file), JSON.stringify(compact));
  router.push({
    name: manifest.name,
    domain: manifest.domain,
    version: manifest.version,
    questions: manifest.questions,
    primary: manifest.primary ?? manifest.questions[0],
    keywords: manifest.keywords,
    threshold: manifest.threshold ?? null,
    weights: `demo/${file}`,
  });
  console.log(repo.padEnd(34), file.padEnd(28), `${(fs.statSync(path.join(out, file)).size / 1024).toFixed(0)} KB`,
    `vocab=${w.vocab.length} kw=${manifest.keywords.length} thr=${manifest.threshold ?? "default"} primary=${manifest.primary ?? manifest.questions[0]}`);
}
fs.writeFileSync(path.join(out, "router.json"), JSON.stringify(router));
console.log("router.json", `${(fs.statSync(path.join(out, "router.json")).size / 1024).toFixed(1)} KB`);
