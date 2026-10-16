import { strict as assert } from "node:assert";
import {
	Sabaki,
	answerJev,
	miniClassifier,
	validateJevQuestion,
	type SabakiPlugin,
} from "../src/index.js";
import { defineGeneralist } from "../../plugins/plugin-generalist/dist/index.js";
import { ensureGeneralist } from "../src/index.js";
const MODEL_DIR = await ensureGeneralist();

import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR =
	process.env.SABAKI_GENERALIST_DIR ?? (await ensureGeneralist());

import csManifest from "../../plugins/plugin-customer-service/dist/manifest.json" with { type: "json" };
import invManifest from "../../plugins/plugin-invoice-processing/dist/manifest.json" with { type: "json" };
import siManifest from "../../plugins/plugin-security-incidents/dist/manifest.json" with { type: "json" };
import atManifest from "../../plugins/plugin-agent-trace-observability/dist/manifest.json" with { type: "json" };
import type { PluginManifest } from "../src/index.js";

const MANIFESTS = [csManifest, invManifest, siManifest, atManifest] as PluginManifest[];

const s = new Sabaki();
for (const m of MANIFESTS) {
	s.register(await miniClassifier(m, m.domain));
}
s.setFallback(defineGeneralist(MODEL_DIR));
console.log("4 minis + fallback chargés");

// Autorouting : chaque état vers son plugin.
const routes: Array<[string, string]> = [
	["Customer with lifetime value 1200 complains about double billing, wants a refund today or will cancel", "customer_service"],
	["Invoice total 4500 with freight and unit lines from vendor, payment due in 30 days", "invoice_processing"],
	["Multiple failed logins from unknown source, account locked, change password window active", "security_incidents"],
	["Agent trace shows model ignored internal constraints, autonomy never granted for this task", "agent_trace_observability"],
	["I want a pizza with extra cheese", "unknown"], // -> fallback generalist
];
for (const [state, expected] of routes) {
	const r = s.route(state);
	const got = r.domain;
	assert.equal(got, expected, `route ${expected}`);
	console.log(`PASS route -> ${got}`);
}

// Schémas Jev par type, via answerJev (même chemin que serve).
const st = "Customer with lifetime value 1200 complains about double billing";
const ch = await answerJev(s, st, "category", { type: "choice", instructions: "Classify.", criteria: { billing: null, technical: null } });
assert.equal(ch.answer.type, "choice");
assert.ok(ch.answer.choice && ch.answer.probabilities && typeof ch.answer.confidence === "number");
assert.ok(ch.model.includes("customer-service"), `model: ${ch.model}`);
console.log(`PASS choice -> ${ch.model} :: ${ch.answer.choice} ${ch.answer.confidence}`);

const no = await answerJev(s, st, "churn", { type: "noul", instructions: "Will churn?" });
assert.equal(no.answer.type, "noul");
assert.ok(typeof no.answer.noul === "number" && !("confidence" in no.answer));
console.log(`PASS noul -> ${no.model} :: ${no.answer.noul}`);

const sc = await answerJev(s, st, "urg", { type: "score", instructions: "Urgency?", criteria: ["low", "high"] });
assert.equal(sc.answer.type, "score");
assert.ok(typeof sc.answer.score === "number" && sc.answer.legend && sc.answer.probabilities);
console.log(`PASS score -> ${sc.model} :: ${sc.answer.score}`);

const fb = await answerJev(s, "I want a pizza", "i", { type: "choice", instructions: "Which intent?", criteria: { order_food: null, taxes: null } });
assert.ok(fb.model.includes("generalist"), `fallback model: ${fb.model}`);
console.log(`PASS fallback -> ${fb.model} :: ${fb.answer.choice}`);

// 422.
assert.equal(validateJevQuestion({ type: "choice" } as never), "instructions requises");
assert.ok(validateJevQuestion({ type: "score", instructions: "x?", criteria: ["a"] })!.includes("2-10"));
console.log("PASS 422");
console.log("serve e2e: OK");
