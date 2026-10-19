#!/usr/bin/env node
// bunkitsu resolve - batch inference over CSV.
//
//   node sabaki/bin/bunkitsu.mjs resolve input.csv --out results.csv \
//     --plugin ./plugins/plugin-phishing-detection/index.js \
//     --plugin @sabaki-js/mail
//
// In :  state, question, type, options     (options: `a|b|c`, empty for noul)
// Out :  state, question, type, decision, confidence, probs, domain, model
//        (probs = JSON map; domain/model = which plugin answered)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sabaki = await import(HERE + "/../dist/index.js");
const { Sabaki, loadGeneralist, definePlugin } = sabaki;

function parseArgs(argv) {
	const o = { cmd: null, out: null, plugins: [], generalistDir: null, multiDir: null };
	let i = 0;
	o.cmd = argv[i++];
	while (i < argv.length) {
		const a = argv[i++];
		if (a === "--out") o.out = argv[i++];
		else if (a === "--plugin") o.plugins.push(argv[i++]);
		else if (a === "--generalist-dir") o.generalistDir = argv[i++];
		else if (a === "--multi-dir") o.multiDir = argv[i++];
		else if (!a.startsWith("--") && !o.input) o.input = a;
		else throw new Error(`arg inconnu: ${a}`);
	}
	if (!o.cmd || !o.input) throw new Error("usage: bunkitsu resolve input.csv --out results.csv [--plugin ...]");
	o.out ??= o.input.replace(/\.csv$/i, "") + "_results.csv";
	return o;
}

/** Minimal CSV parser (quotes + commas + \n inside quotes). */
function parseCsv(text) {
	const rows = [];
	let row = [], cur = "", q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) {
			if (c === '"') {
				if (text[i + 1] === '"') { cur += '"'; i++; }
				else q = false;
			} else cur += c;
		} else if (c === '"') q = true;
		else if (c === ",") { row.push(cur); cur = ""; }
		else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cur); cur = "";
			if (row.length > 1 || row[0] !== "") rows.push(row);
			row = [];
		} else cur += c;
	}
	row.push(cur);
	if (row.length > 1 || row[0] !== "") rows.push(row);
	return rows;
}

function csvCell(s) {
	s = String(s ?? "");
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function loadPlugin(spec, cwd) {
	try {
		const mod = await import(spec);
		return mod.default ?? mod;
	} catch {
		const mod = await import(path.resolve(cwd, spec));
		return mod.default ?? mod;
	}
}

const LATIN = new Set(["de", "en", "es", "fr", "id", "it", "pt", "tr", "vi"]);
const o = parseArgs(process.argv.slice(2));
if (o.cmd !== "resolve") throw new Error(`commande inconnue: ${o.cmd} (resolve uniquement)`);

const s = new Sabaki();
for (const spec of o.plugins) {
	try {
		s.register(await loadPlugin(spec, process.cwd()));
		console.log(`plugin: ${spec}`);
	} catch (e) {
		console.log(`plugin ignoré (${spec}): ${e.message}`);
	}
}
// Fallback généraliste dispatché par langue (comme serve.mjs).
const miniDir = o.generalistDir ?? process.env.SABAKI_GENERALIST_DIR;
const multiDir = o.multiDir ?? process.env.SABAKI_MULTI_DIR;
if (miniDir || multiDir) {
	const miniBe = miniDir ? loadGeneralist(miniDir) : null;
	const multiBe = multiDir ? loadGeneralist(multiDir) : null;
	const fb = definePlugin({
		manifest: { name: "@sabaki-js/generalist", domain: "generalist", version: "0.1.0", questions: ["decision"], keywords: [] },
		classify: async (input) => {
			let be = miniBe, tag = "sabaki-generalist-mini";
			try {
				if (multiBe && !LATIN.has(sabaki.detectLanguage(input.state ?? "").lang)) {
					be = multiBe;
					tag = "sabaki-generalist-multi-v8";
				}
			} catch { /* defaut mini */ }
			const r = await (be ?? miniBe ?? multiBe).decide(input);
			return { ...r, model: tag };
		},
	});
	s.setFallback(fb);
	console.log(`fallback: mini${multiDir ? " + multi" : ""}`);
}

const rows = parseCsv(fs.readFileSync(o.input, "utf8"));
if (!rows.length) throw new Error("csv vide");
const head = rows[0].map((h) => h.trim().toLowerCase());
const ci = (n) => head.indexOf(n);
for (const need of ["state", "question", "type"]) {
	if (ci(need) < 0) throw new Error(`colonne manquante: ${need}`);
}
const out = [["state", "question", "type", "decision", "confidence", "probs", "domain", "model"]];
for (const r of rows.slice(1)) {
	const state = r[ci("state")] ?? "";
	const question = r[ci("question")] || undefined;
	const type = (r[ci("type")] || "choice").trim();
	const opts = ci("options") >= 0 ? (r[ci("options")] ?? "").split("|").map((x) => x.trim()).filter(Boolean) : [];
	const res = await s.decideAsync({ state, question, ...(opts.length ? { options: opts } : {}) });
	const probs = res.probabilities ? JSON.stringify(res.probabilities) : "";
	out.push([state, question ?? "", type, res.decision ?? "", res.confidence ?? "", probs, res.domain ?? "", res.model ?? res.plugin ?? ""]);
	if (out.length % 50 === 0) console.log(`${out.length - 1} lignes...`);
}
fs.writeFileSync(o.out, out.map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
console.log(`-> ${o.out} (${out.length - 1} lignes)`);
