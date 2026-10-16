import { strict as assert } from "node:assert";
import { Sabaki, type SabakiPlugin } from "../src/index.js";

const fallback: SabakiPlugin = {
	manifest: {
		name: "sabaki-generalist-v2",
		domain: "generalist",
		version: "0.1.0",
		questions: ["decision"],
		keywords: [],
	},
	classify: (input) => {
		const opts = (input as { options?: string[] }).options ?? ["yes", "no"];
		return { decision: opts[0]!, confidence: 0.5, domain: "generalist" };
	},
};

const s = new Sabaki().setFallback(fallback);
const { url, close } = await s.serve({ port: 0 });

const health = await (await fetch(`${url}/health`)).json();
assert.equal(health.status, "ok");
console.log("PASS /health");

const models = await (await fetch(`${url}/v1/models`)).json();
assert.ok(Array.isArray(models.data));
console.log("PASS /v1/models");

const r = await fetch(`${url}/v1/systemone`, {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({
		state: "hello",
		questions: { q: { type: "choice", instructions: "Pick.", options: ["a", "b"] } },
	}),
});
assert.equal(r.status, 200);
const body = (await r.json()) as { model: string; answers: Record<string, { type: string }> };
assert.equal(body.answers.q!.type, "choice");
assert.ok(body.model.includes("generalist"));
console.log(`PASS /v1/systemone -> ${body.model}`);

const bad = await fetch(`${url}/v1/systemone`, {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({ state: "hi", questions: { q: { type: "choice" } } }),
});
assert.equal(bad.status, 422);
console.log("PASS 422");

await close();
console.log("Sabaki.serve(): OK");
