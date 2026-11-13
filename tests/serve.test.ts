import { strict as assert } from "node:assert";
import {
	Sabaki,
	answerJev,
	miniClassifier,
	validateJevQuestion,
	type SabakiPlugin,
} from "../src/index.js";
import {
	Sabaki,
	answerJev,
	definePlugin,
	loadGeneralist,
	miniClassifier,
	validateJevQuestion,
	type PluginManifest,
} from "../src/index.js";

import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Poids generalist : ./models local (offline, cf. tests/e2e.test.ts).
const MODEL_DIR =
	process.env.SABAKI_GENERALIST_DIR ?? path.join(HERE, "..", "models", "generalist");

const backend = loadGeneralist(MODEL_DIR);
const defineGeneralist = (_dir: string) =>
	definePlugin({
		manifest: {
			name: "sabaki-generalist-e2e",
			domain: "generalist",
			version: "0.0.0",
			questions: ["decision"],
			keywords: [],
		},
		classify: (input) => backend.decide(input),
	});

const PKGS = [
	"customer-service",
	"invoice-processing",
	"security-incidents",
	"agent-trace-observability",
] as const;
const MANIFESTS: PluginManifest[] = [];
for (const pkg of PKGS) {
	const mod = (await import(`@sabaki-js/${pkg}`)) as unknown as {
		default?: { manifest: PluginManifest; modelDir?: string };
		manifest?: PluginManifest;
		modelDir?: string;
	};
	const plug = mod.default ?? (mod as { manifest: PluginManifest; modelDir?: string });
	MANIFESTS.push({ ...(plug.manifest as PluginManifest), modes: { modelDir: plug.modelDir ?? (mod as { modelDir?: string }).modelDir } } as PluginManifest);
}

const s = new Sabaki();
for (const m of MANIFESTS) {
	const modelDir = (m.modes as unknown as { modelDir?: string } | undefined)?.modelDir;
	s.register(await miniClassifier(m, m.domain, { modelDir }));
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
