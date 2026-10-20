import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	Sabaki,
	WASM_ABI_VERSION,
	WASM_SPEC_VERSION,
	WasmSpecError,
	loadWasmPlugin,
	readWasmSpec,
} from "../src/index.js";

const fixture = new Uint8Array(
	readFileSync(new URL("./fixtures/proto-plugin.wasm", import.meta.url)),
);

function expectSpecError(fn: () => unknown, code: string) {
	assert.throws(fn, (err: unknown) => {
		assert.ok(err instanceof WasmSpecError, String(err));
		assert.equal(err.code, code);
		return true;
	});
}

describe("spec wasm", () => {
	it("lit le marqueur et l'ABI", () => {
		const spec = readWasmSpec(fixture);
		assert.equal(spec.version, WASM_SPEC_VERSION);
		assert.equal(spec.abi, WASM_ABI_VERSION);
	});

	it("refuse un fichier qui n'est pas du wasm", () => {
		expectSpecError(() => readWasmSpec(new Uint8Array([1, 2, 3, 4])), "wasm-magic");
	});

	it("refuse un module sans section sabaki", () => {
		const minimal = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
		expectSpecError(() => readWasmSpec(minimal), "spec-section");
	});

	it("refuse une version de spec inconnue", () => {
		const bad = fixture.slice();
		const marker = bad.findIndex(
			(_, i) =>
				bad[i] === 0x53 &&
				bad[i + 1] === 0x41 &&
				bad[i + 2] === 0x42 &&
				bad[i + 3] === 0x4b,
		);
		assert.ok(marker > 0);
		bad[marker + 4] = 2;
		expectSpecError(() => readWasmSpec(bad), "spec-version");
	});
});

describe("plugin wasm", () => {
	it("charge le manifest et classifie par mots-cles", async () => {
		const plugin = await loadWasmPlugin(fixture);
		assert.equal(plugin.manifest.domain, "proto");
		assert.equal(plugin.manifest.primary, "intent");

		const shipping = plugin.classify({
			state: "My package never arrived, tracking says delivered",
			options: ["shipping", "billing", "technical"],
		});
		assert.equal(shipping.decision, "shipping");
		assert.ok(shipping.confidence > 0.5);
		assert.equal(shipping.domain, "proto");

		const billing = plugin.classify({
			state: "I was charged twice on my invoice",
			options: ["shipping", "billing", "technical"],
		});
		assert.equal(billing.decision, "billing");

		const technical = plugin.classify({
			state: "The app crashes at login",
			options: ["shipping", "billing", "technical"],
		});
		assert.equal(technical.decision, "technical");
	});

	it("respecte les proprietes de la sortie", async () => {
		const plugin = await loadWasmPlugin(fixture);
		const out = plugin.classify({
			state: "my colis is late",
			options: ["shipping", "billing", "technical"],
		});
		assert.ok(["shipping", "billing", "technical"].includes(out.decision));
		assert.ok(out.confidence >= 0 && out.confidence <= 1);
		const probs = out.probabilities ?? {};
		const sum = Object.values(probs).reduce((a, b) => a + b, 0);
		assert.ok(Math.abs(sum - 1) < 0.02, `somme ${sum}`);
	});

	it("refuse une entree sans option", async () => {
		const plugin = await loadWasmPlugin(fixture);
		expectSpecError(
			() => plugin.classify({ state: "hello", options: [] }),
			"input",
		);
	});

	it("s'integre au routeur Sabaki", async () => {
		const plugin = await loadWasmPlugin(fixture);
		const sabaki = new Sabaki();
		sabaki.register(plugin);
		const r = await sabaki.decideAsync({
			state: "my colis never arrived",
			options: ["shipping", "billing", "technical"],
		});
		assert.equal(r.decision, "shipping");
		assert.equal(r.plugin, "@sabaki-js/proto-wasm");
	});
});
