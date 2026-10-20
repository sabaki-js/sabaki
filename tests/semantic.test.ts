import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { cosine, describeQuestion, mapSemantic } from "../src/index.js";

const fakeEmbed = async (texts: string[]) =>
	texts.map((t) => {
		const v = [t.length % 7, t.length % 5, t.length % 3];
		const n = Math.hypot(...v) || 1;
		return v.map((x) => x / n);
	});

describe("semantic", () => {
	it("cosine unitaire", () => {
		assert.ok(Math.abs(cosine([1, 0], [1, 0]) - 1) < 1e-9);
		assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9);
	});
	it("describeQuestion prefere descriptions", () => {
		const m = {
			domain: "phishing",
			aliases: { questions: { suspicious: ["scam"] } },
			descriptions: { suspicious: "Is this suspicious?" },
		};
		assert.equal(describeQuestion("suspicious", m), "Is this suspicious?");
		assert.equal(
			describeQuestion("other", m),
			"other  phishing",
		);
	});
	it("mapSemantic seuil et vide", async () => {
		const cands = [{ key: "a", text: "aaa" }];
		assert.equal(await mapSemantic("aaa", cands, fakeEmbed, 0.3), "a");
		assert.equal(await mapSemantic("zz", cands, fakeEmbed, 0.99), null);
		assert.equal(await mapSemantic("aaa", [], fakeEmbed, 0.0), null);
	});
});
