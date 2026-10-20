/**
 * eval_semantic6.mjs - variantes DERIVEES DES MANIFESTS (pas choisies a la main).
 * C'est la configuration qui partir en production. Detecte le sur-apprentissage
 * du jeu de variantes precedent.
 */
import fs from "node:fs";
import { loadBiencoder } from "../dist/index.js";
import cases from "./eval_cases.mjs";

const MANIFESTS = [
	"../../plugins/plugin-phishing-detection/src/manifest.json",
	"../../plugins/plugin-jailbreak/src/manifest.json",
];

function variantsOf(m) {
	const out = {};
	for (const q of m.questions) {
		const list = [];
		if (m.descriptions?.[q]) list.push(m.descriptions[q]);
		list.push(q);
		for (const a of m.aliases?.questions?.[q] ?? []) list.push(a);
		out[q] = [...new Set(list)];
	}
	return out;
}

const plugins = {};
for (const p of MANIFESTS) {
	const m = JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
	plugins[m.name] = { manifest: m, variants: variantsOf(m), short: m.name.split("/").pop() };
}

const sem = await loadBiencoder(process.env.SABAKI_BIENCODER_DIR, process.env.SABAKI_BIENCODER_ONNX);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

const V = {};
for (const [name, p] of Object.entries(plugins)) {
	V[name] = {};
	for (const [q, arr] of Object.entries(p.variants)) V[name][q] = await sem.embed(arr);
}
console.log("\nvariantes par plugin :");
for (const [name, p] of Object.entries(plugins)) {
	for (const [q, arr] of Object.entries(p.variants)) console.log(`  ${p.short}/${q}: ${arr.length} -> ${arr.join(" | ").slice(0, 110)}`);
}

// Le plugin attendu dans les cas est "phishing" / "jailbreak" : on mappe sur le nom court.
const rows = [];
let ms = 0;
for (const [plugin, text, want] of cases) {
	const t0 = process.hrtime.bigint();
	const qv = (await sem.embed([text]))[0];
	ms += Number(process.hrtime.bigint() - t0) / 1e6;
	const per = {};
	for (const [name, p] of Object.entries(plugins)) {
		per[name] = Math.max(
			...Object.values(V[name]).map((arrs) => Math.max(...arrs.map((v) => dot(qv, v)))),
		);
	}
	const target = Object.entries(plugins).find(([, p]) => p.short.includes(plugin))[0];
	const other = Math.max(...Object.keys(per).filter((n) => n !== target).map((n) => per[n]));
	rows.push({ plugin, text, want, s: per[target], margin: per[target] - other, per });
}

const pos = rows.filter((r) => r.want);
const neg = rows.filter((r) => !r.want);
console.log(`\n${(ms / rows.length).toFixed(1)} ms/requete | ${pos.length} positifs / ${neg.length} negatifs\n`);
console.log("S_MIN   rappel   faux+   statut");
for (const smin of [0.45, 0.5, 0.52, 0.55, 0.6, 0.65, 0.7]) {
	const fire = (r) => r.margin >= 0 && r.s >= smin;
	const tp = pos.filter(fire).length / pos.length;
	const fp = neg.filter(fire).length / neg.length;
	console.log(`${smin.toFixed(2)}    ${(tp * 100).toFixed(0).padStart(3)}%    ${(fp * 100).toFixed(0).padStart(3)}%    ${fp === 0 ? "OK" : "risque"}`);
}
const S_MIN = Number(process.env.S_MIN ?? 0.52);
console.log(`\n=== detail a S_MIN=${S_MIN} ===`);
let bad = 0;
for (const r of rows) {
	const hit = r.margin >= 0 && r.s >= S_MIN;
	if (hit !== r.want) {
		bad++;
		console.log(`  ${hit ? "FAUX POSITIF" : "MANQUE      "} s=${r.s.toFixed(3)} m=${r.margin.toFixed(3)} [${r.plugin}] ${r.text}`);
	}
}
console.log(`  ${bad} erreur(s)`);
console.log("\nEVAL6_DONE");
