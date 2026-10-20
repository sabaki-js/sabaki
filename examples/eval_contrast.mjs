/**
 * eval_contrast.mjs - la composante "question sur ce message" peut-elle etre
 * retiree ? score = max(variantes du plugin) - max(distracteurs generiques).
 * Les distracteurs sont des questions plausibles sur le MEME objet, pas des
 * questions hors sujet.
 */
import fs from "node:fs";
import { loadBiencoder } from "../dist/index.js";
import cases from "./eval_cases.mjs";

const MANIFESTS = [
	"../../plugins/plugin-phishing-detection/src/manifest.json",
	"../../plugins/plugin-jailbreak/src/manifest.json",
];
const DISTRACTORS = [
	"Is this message well written?",
	"What is this message about?",
	"Is this message long?",
	"What is the tone of this message?",
	"Does this message contain spelling errors?",
	"Which language is this message in?",
	"Is this message formal?",
	"Who wrote this message?",
];

const plugins = {};
for (const f of MANIFESTS) {
	const m = JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8"));
	const variants = {};
	for (const q of m.questions) {
		variants[q] = [...new Set([m.descriptions?.[q], q, ...(m.aliases?.questions?.[q] ?? [])].filter(Boolean))];
	}
	plugins[m.name] = { manifest: m, variants, short: m.name.split("/").pop() };
}

const sem = await loadBiencoder(process.env.SABAKI_BIENCODER_DIR, process.env.SABAKI_BIENCODER_ONNX);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

const V = {}, D = [];
for (const [name, p] of Object.entries(plugins)) {
	V[name] = {};
	for (const [q, arr] of Object.entries(p.variants)) V[name][q] = await sem.embed(arr);
}
for (const d of DISTRACTORS) D.push(await sem.embed([d]).then((x) => x[0]));

const rows = [];
for (const [plugin, text, want] of cases) {
	const qv = (await sem.embed([text]))[0];
	const per = {};
	for (const [name, qs] of Object.entries(V)) {
		per[name] = Math.max(...Object.values(qs).map((arrs) => Math.max(...arrs.map((v) => dot(qv, v)))));
	}
	const target = Object.entries(plugins).find(([, p]) => p.short.includes(plugin))[0];
	const raw = per[target];
	const dist = Math.max(...D.map((d) => dot(qv, d)));
	const other = Math.max(...Object.keys(per).filter((n) => n !== target).map((n) => per[n]));
	rows.push({ plugin, text, want, raw, dist, s: raw - dist, margin: raw - other });
}

const pos = rows.filter((r) => r.want);
const neg = rows.filter((r) => !r.want);
console.log(`\n${pos.length} positifs / ${neg.length} negatifs`);
console.log("\nS_MIN   rappel   faux+   (contraste)   |  brut: rappel/faux+");
for (const t of [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
	const f = (r) => r.margin >= 0 && r.s >= t;
	const tpr = pos.filter(f).length / pos.length;
	const fpr = neg.filter(f).length / neg.length;
	const tprRaw = pos.filter((r) => r.margin >= 0 && r.raw >= 0.5).length / pos.length;
	const fprRaw = neg.filter((r) => r.margin >= 0 && r.raw >= 0.5).length / neg.length;
	console.log(`  ${t.toFixed(2)}    ${(tpr * 100).toFixed(0).padStart(3)}%    ${(fpr * 100).toFixed(0).padStart(3)}%                 |  ${(tprRaw * 100).toFixed(0)}% / ${(fprRaw * 100).toFixed(0)}%`);
}

const T = Number(process.env.T ?? 0.15);
console.log(`\n=== detail contraste a ${T} ===`);
for (const r of rows) {
	const hit = r.margin >= 0 && r.s >= T;
	if (hit !== r.want) console.log(`  ${hit ? "FAUX +" : "MANQUE"} s=${r.s.toFixed(3)} raw=${r.raw.toFixed(3)} d=${r.dist.toFixed(3)} [${r.plugin}] ${r.text}`);
}
console.log("CONTRAST_DONE");
