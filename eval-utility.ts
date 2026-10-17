/** Test d'utilite : specialistes (nano/mini) vs generalist-mini, par domaine.
 * Questions natives, gold des test splits. Repond : qui doit servir quoi ?
 * Usage : npx tsx eval-utility.ts [--limit 100]
 */
import fs from "node:fs";
import {
	Sabaki,
	answerJev,
	loadGeneralist,
	loadMini,
	ensureMiniModel,
	miniClassifier,
	type SabakiPlugin,
} from "./src/index.js";
import csPkg from "../plugins/plugin-customer-service/dist/index.js";
import invPkg from "../plugins/plugin-invoice-processing/dist/index.js";
import secPkg from "../plugins/plugin-security-incidents/dist/index.js";
import trcPkg from "../plugins/plugin-agent-trace-observability/dist/index.js";

const limit = Number(process.argv[2] ?? 100);
const plugins: Record<string, SabakiPlugin> = {
	customer_service: ((csPkg as { default?: SabakiPlugin }).default ?? csPkg) as SabakiPlugin,
	invoice_processing: ((invPkg as { default?: SabakiPlugin }).default ?? invPkg) as SabakiPlugin,
	security_incidents: ((secPkg as { default?: SabakiPlugin }).default ?? secPkg) as SabakiPlugin,
	agent_trace_observability: ((trcPkg as { default?: SabakiPlugin }).default ?? trcPkg) as SabakiPlugin,
};
const GENERALIST_DIR = process.env.SABAKI_GENERALIST_DIR ?? "../weights-generalist/generalist-onnx-A0";
const backend = loadGeneralist(GENERALIST_DIR);
const s = new Sabaki();
const minis: Record<string, SabakiPlugin> = {};
for (const [wf, p] of Object.entries(plugins)) {
	s.register(p);
	await loadMini(await ensureMiniModel(wf));
	minis[wf] = await miniClassifier(p.manifest, wf);
}
console.log(`generalist: ${await backend.model}`);

for (const [wf, plugin] of Object.entries(plugins)) {
	const rows = JSON.parse(fs.readFileSync(`../cache/${wf}_test.json`, "utf8")).slice(0, limit);
	const qs = plugin.manifest.questions;
	const stat: Record<string, { n: number; nano: number; mini: number; gen: number }> = {};
	for (const q of qs) stat[q] = { n: 0, nano: 0, mini: 0, gen: 0 };
	for (const r of rows) {
		const questions = JSON.parse(r.questions as string) as Record<string, { instructions?: string }>;
		const gold = JSON.parse(r.gold as string) as Record<string, { label?: unknown; score?: unknown }>;
		for (const q of qs) {
			const g = gold[q];
			const lab = g?.label ?? g?.score;
			if (lab == null) continue;
			const st = stat[q]!;
			st.n++;
			const goldStr = String(lab);
			try {
				const o = plugin.classify({ state: r.state as string, question: q });
				if (String(o.decision) === goldStr) st.nano++;
			} catch { /* question non supportee */ }
			try {
				const o = await minis[wf]!.classify({ state: r.state as string, question: q });
				if (String(o.decision) === goldStr) st.mini++;
			} catch { /* idem */ }
			// generalist : options = labels observes sur le split (meme protocole que eval_typed_decisions)
			const allOpts = new Set<string>();
			for (const r2 of rows) {
				const g2 = (JSON.parse(r2.gold as string) as Record<string, { label?: unknown; score?: unknown }>)[q];
				const l2 = g2?.label ?? g2?.score;
				if (l2 != null) allOpts.add(String(l2));
			}
			const opts = [...allOpts];
			if (opts.length >= 2) {
				const qtext = questions[q]?.instructions ?? q;
				const o = await backend.decide({ state: r.state as string, question: qtext, options: opts });
				if (String(o.decision) === goldStr) st.gen++;
			}
		}
	}
	console.log(`== ${wf} (n=${rows.length}) ==`);
	for (const q of qs) {
		const t = stat[q]!;
		if (!t.n) continue;
		console.log(
			`  ${q}: nano=${(t.nano / t.n).toFixed(3)} mini=${(t.mini / t.n).toFixed(3)} gen=${(t.gen / t.n).toFixed(3)} (n=${t.n})`,
		);
	}
}
// moyennes par domaine (resume decisionnel)
console.log("--- moyens par domaine (nano / mini / generalist) ---");
