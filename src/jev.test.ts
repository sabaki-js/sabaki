import { strict as assert } from "node:assert";
import {
	Sabaki,
	answerJev,
	criteriaOptions,
	mapQuestion,
	toJevAnswer,
	validateJevQuestion,
	type SabakiPlugin,
} from "./index.js";

// Spécialistes factices : 2 questions chacun, sync (nano-like).
function dummy(domain: string, keywords: string[], questions: string[]): SabakiPlugin {
	return {
		manifest: { name: `@sabaki/plugin-${domain}`, domain, version: "0.1.0", questions, keywords },
		classify: (input) => ({
			decision: `${domain}:${input.question}`,
			confidence: 0.8,
			domain,
		}),
	};
}

// Fallback factice (pas d'ONNX) : echo des options.
const fallback: SabakiPlugin = {
	manifest: {
		name: "sabaki-generalist-v1",
		domain: "generalist",
		version: "0.1.0",
		questions: ["decision"],
		keywords: [],
	},
	classify: (input) => {
		const opts = (input as { options?: string[] }).options ?? ["yes", "no"];
		return { decision: opts[0]!, confidence: 0.5, domain: "generalist", probabilities: { [opts[0]!]: 0.5 } };
	},
};

const s = new Sabaki()
	.register(dummy("customer_service", ["billing", "refund", "cancel"], ["category", "urgency", "action"]))
	.register(dummy("mail", ["invoice", "facture", "payment"], ["bucket", "suspicious"]))
	.setFallback(fallback);

let fallbackCount = 0;
let specialistCount = 0;

// Plusieurs questions par catégorie : id natif, via instructions, primaire.
const cases: Array<[string, string, object, string]> = [
	["Customer wants to cancel after double billing", "category", { type: "choice" }, "customer_service"],
	["Customer wants to cancel after double billing", "urgency", { type: "choice" }, "customer_service"],
	["refund my invoice now", "action", { type: "choice" }, "customer_service"],
	["Facture double, remboursement urgent", "bucket", { type: "choice" }, "mail"],
	["Facture double, remboursement urgent", "suspicious", { type: "noul" }, "mail"],
	["Got invoice paid twice", "whatever", { type: "choice", instructions: "talk about bucket status" }, "mail"],
	["I want a pizza with extra cheese", "intent", { type: "choice", instructions: "Which intent?", criteria: { order_food: null } }, "generalist"],
	["The sky is blue", "about", { type: "choice", instructions: "What about?", criteria: { weather: null, invoice: null } }, "generalist"],
];

for (const [state, qid, q, expected] of cases) {
	const { answer, model } = await answerJev(s, state, qid, q as never);
	const domain = model.includes("generalist") ? "generalist" : model.split("/").pop()!.split("@")[0].replace("plugin-", "");
	if (domain === "generalist") fallbackCount++;
	else specialistCount++;
	assert.equal(domain === expected || (expected === "generalist") === (domain === "generalist"), true, `${qid} -> ${model}`);
	console.log(`PASS ${qid} -> ${model} :: ${JSON.stringify(answer).slice(0, 90)}`);
}

// Formes Jev.
const ch = toJevAnswer("choice", ["a", "b"], { decision: "a", confidence: 0.7, domain: "d", probabilities: { a: 0.7, b: 0.3 } });
assert.equal(ch.type, "choice");
assert.deepEqual(Object.keys(ch.probabilities).sort(), ["a", "b"]);
const no = toJevAnswer("noul", ["yes", "no"], { decision: "yes", confidence: 0.9, domain: "d", probabilities: { yes: 0.9, no: 0.1 } });
assert.equal(no.type, "noul");
assert.ok(!("confidence" in no));
const sc = toJevAnswer("score", ["low", "high"], { decision: "high", confidence: 0.8, domain: "d", probabilities: { low: 0.2, high: 0.8 } });
assert.equal(sc.type, "score");
assert.equal(sc.score, 0.8);
assert.equal(validateJevQuestion({ type: "choice" } as never), "instructions requises");
assert.equal(criteriaOptions({ type: "choice", criteria: { a: null, b: null } }).length, 2);
assert.equal(mapQuestion("bucket", { type: "choice", instructions: "?" }, ["bucket"], "bucket"), "bucket");

console.log(`specialists=${specialistCount} fallback=${fallbackCount}`);
assert.equal(fallbackCount, 2, "deux cas generalist");
assert.equal(specialistCount, 6, "six cas spécialistes");
console.log("jev+fallback: OK");
