import { strict as assert } from "node:assert";
import {
	Sabaki,
	answerJev,
	definePlugin,
	ensureGeneralist,
	ensureMiniModel,
	loadGeneralist,
	miniClassifier,
	validateJevQuestion,
	type PluginManifest,
} from "../src/index.js";

// E2E : vrais poids ONNX embarqués (node_modules/@sabaki-js/*, offline).
// - ensure* avec dir local complet -> zéro réseau (skip re-download)
// - routeur + 5 minis + fallback generalist ONNX, servis en HTTP réel
// - /health, /v1/models, /v1/systemone (natif, fallback, multi-questions), 404, 422

// 1. Skip re-download : dossiers locaux complets, aucun fetch.
const CS_DIR = "models/customer_service-int8";
const G_DIR = "models/generalist";
assert.equal(
	await ensureMiniModel("customer_service", undefined, "int8", { dir: CS_DIR }),
	CS_DIR,
);
console.log("PASS ensureMiniModel reuse local dir (no download)");
assert.equal(
	await ensureGeneralist(undefined, "generalist", { dir: G_DIR }),
	G_DIR,
);
console.log("PASS ensureGeneralist reuse local dir (no download)");

// 2. 5 minis depuis les poids embarqués des paquets npm.
const PKGS = [
	"customer-service",
	"invoice-processing",
	"security-incidents",
	"agent-trace-observability",
	"mail",
] as const;
const s = new Sabaki();
for (const pkg of PKGS) {
	const mod = (await import(`@sabaki-js/${pkg}`)) as unknown as {
		default?: { manifest: PluginManifest; modelDir?: string };
		manifest?: PluginManifest;
		modelDir?: string;
	};
	const plug = mod.default ?? (mod as { manifest: PluginManifest; modelDir?: string });
	// Poids embarqués : export nommé `modelDir` (pas sur le default).
	const modelDir = plug.modelDir ?? (mod as { modelDir?: string }).modelDir;
	assert.ok(modelDir, `${pkg} embarque modelDir`);
	assert.ok(plug.manifest?.domain, `${pkg} a un manifest`);
	s.register(await miniClassifier(plug.manifest!, plug.manifest!.domain, { modelDir }));
	console.log(`PASS mini chargé: ${plug.manifest!.domain}`);
}

// 3. Fallback generalist ONNX local.
const backend = loadGeneralist(G_DIR);
const fallback = definePlugin({
	manifest: {
		name: "sabaki-generalist-e2e",
		domain: "generalist",
		version: "0.0.0",
		questions: ["decision"],
		keywords: [],
	},
	classify: (input) => backend.decide(input),
});
s.setFallback(fallback);

// 4. Routage direct (même manifests que les minis).
const routes: Array<[string, string]> = [
	["Customer complains about double billing, wants a refund today or will cancel", "customer_service"],
	["Invoice total 4500 with freight and unit lines from vendor, payment due in 30 days", "invoice_processing"],
	["Multiple failed logins from unknown source, account locked, change password window active", "security_incidents"],
	["Agent trace shows model ignored internal constraints, autonomy never granted for this task", "agent_trace_observability"],
	["Facture impayée, relance client en retard de paiement", "mail"],
	["I want a pizza with extra cheese", "unknown"],
];
for (const [state, expected] of routes) {
	assert.equal(s.route(state).domain, expected, `route ${expected}`);
	console.log(`PASS route -> ${expected}`);
}

// 5. Serveur HTTP réel sur port éphémère.
const { url, close } = await s.serve({ port: 0 });
try {
	const health = (await (await fetch(`${url}/health`)).json()) as { status: string };
	assert.equal(health.status, "ok");
	console.log("PASS /health");

	const models = (await (await fetch(`${url}/v1/models`)).json()) as { data: unknown[] };
	assert.ok(Array.isArray(models.data));
	console.log("PASS /v1/models");

	// Question native spécialiste (pas de criteria -> espace natif).
	const post = async (state: string, questions: object) =>
		fetch(`${url}/v1/systemone`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ state, questions }),
		});
	type SysOne = { model: string; answers: Record<string, { type: string; choice?: string; probabilities?: Record<string, number>; confidence?: number }> };

	const r1 = await post(routes[0]![0], { category: { type: "choice", instructions: "category?" } });
	assert.equal(r1.status, 200);
	const b1 = (await r1.json()) as SysOne;
	assert.ok(b1.model.includes("customer-service"), `model: ${b1.model}`);
	assert.equal(b1.answers.category!.type, "choice");
	console.log(`PASS mini HTTP -> ${b1.model} :: ${b1.answers.category!.choice}`);

	// Fallback generalist sur vocabulaire disjoint.
	const r2 = await post("I want a pizza with extra cheese", {
		intent: { type: "choice", instructions: "Which intent?", criteria: { order_food: null, taxes: null } },
	});
	assert.equal(r2.status, 200);
	const b2 = (await r2.json()) as SysOne;
	assert.ok(b2.model.includes("generalist"), `fallback: ${b2.model}`);
	console.log(`PASS fallback HTTP -> ${b2.model} :: ${b2.answers.intent!.choice}`);

	// Multi-questions = modèle routé (mélange spécialiste + fallback).
	const r3 = await post(routes[1]![0], {
		duplicate: { type: "choice", instructions: "duplicate?" },
		intent: { type: "choice", instructions: "Which intent?", criteria: { order_food: null, taxes: null } },
	});
	assert.equal(r3.status, 200);
	const b3 = (await r3.json()) as SysOne;
	assert.ok(b3.model.startsWith("sabaki-routed("), `routed: ${b3.model}`);
	console.log(`PASS multi-questions -> ${b3.model}`);

	// 422 : question invalide (même validateur que la lib).
	assert.ok(validateJevQuestion({ type: "choice" } as never));
	const r4 = await post("hi", { q: { type: "choice" } });
	assert.equal(r4.status, 422);
	console.log("PASS 422");

	// 404.
	assert.equal((await fetch(`${url}/nope`)).status, 404);
	console.log("PASS 404");

	// answerJev direct (même chemin que serve) : spécialiste mail natif + fallback.
	const m = await answerJev(s, routes[4]![0], "bucket", { type: "choice", instructions: "bucket?" });
	assert.ok(m.model.includes("mail"), `mail: ${m.model}`);
	console.log(`PASS answerJev mail -> ${m.model}`);
} finally {
	await close();
}
console.log("e2e: OK");
