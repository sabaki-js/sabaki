import { strict as assert } from "node:assert";
import { loadGeneralist } from "../src/index.js";

// Seuil opt-in : sous le seuil -> decision null, sans seuil -> argmax.
const dir = process.env.SABAKI_GENERALIST_DIR ?? "/home/lsannier/sabaki-js/weights-generalist/generalist-onnx-v3-ep2";
let backend;
try {
	backend = loadGeneralist(dir);
	await backend.decide({ state: "ping", options: ["yes", "no"] });
} catch {
	console.log("SKIP abstain (pas de poids locaux)");
	process.exit(0);
}
const low = await backend.decide({
	state: "blabla indécidable",
	question: "cat?",
	options: ["a", "b", "c"],
	abstainAt: 0.99,
});
assert.equal(low.decision, null);
assert.ok(low.confidence < 0.99);
console.log(`PASS abstain sous seuil -> null (${low.confidence})`);

const full = await backend.decide({
	state: "blabla indécidable",
	question: "cat?",
	options: ["a", "b", "c"],
});
assert.ok(typeof full.decision === "string");
console.log(`PASS sans seuil -> ${full.decision} (${full.confidence})`);
console.log("abstain: OK");
