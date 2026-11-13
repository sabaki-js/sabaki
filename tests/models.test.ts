import { strict as assert } from "node:assert";
import { Sabaki, answerJev, type SabakiPlugin } from "../src/index.js";
async function loadPkg(pkg: string): Promise<SabakiPlugin> {
	const mod = (await import(`@sabaki-js/${pkg}`)) as unknown as {
		default?: SabakiPlugin;
	};
	return mod.default ?? (mod as unknown as SabakiPlugin);
}

const mail = await loadPkg("mail");
const cs = await loadPkg("customer-service");
const inv = await loadPkg("invoice-processing");

let fallbackCount = 0;
const fallback: SabakiPlugin = {
	manifest: {
		name: "sabaki-generalist-v2",
		domain: "generalist",
		version: "0.1.0",
		questions: ["decision"],
		keywords: [],
	},
	classify: (input) => {
		fallbackCount++;
		const opts = (input as { options?: string[] }).options ?? ["yes", "no"];
		return { decision: opts[0]!, confidence: 0.5, domain: "generalist" };
	},
};

const s = new Sabaki().register(mail).register(cs).register(inv).setFallback(fallback);

// Vrais poids nano : routage + décision par workflow et question.
const cases: Array<[string, string, string]> = [
	["Customer complains about double billing, wants a refund today", "category", "customer_service"],
	["Invoice total 4500 with freight lines, payment due in 30 days", "duplicate", "invoice_processing"],
	["Facture impayée, relance client en retard de paiement", "bucket", "mail"],
	["I want a pizza with extra cheese", "intent", "generalist"],
	["The sky is blue", "about", "generalist"],
];

for (const [state, q, expected] of cases) {
	const r = await answerJev(s, state, q, { type: "choice", instructions: `${q}?` });
	const model: string = (r as { model: string }).model;
	const isFallback = model.includes("generalist");
	console.log(`PASS ${q} -> ${model} :: ${JSON.stringify((r as { answer: object }).answer).slice(0, 80)}`);
	assert.equal(isFallback, expected === "generalist", `${q} routage`);
}

console.log(`vrais modèles nano OK, fallback appelé ${fallbackCount}x`);
assert.equal(fallbackCount, 2, "deux cas generalist");
