import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	Sabaki,
	answerJev,
	mapQuestion,
	toJevAnswer,
	type SabakiPlugin,
} from "../src/index.js";

const plug: SabakiPlugin = {
	manifest: {
		name: "t",
		domain: "phishing",
		version: "0.0.1",
		questions: ["suspicious"],
		keywords: ["phishing"],
		aliases: {
			questions: { suspicious: ["scam", "arnaque"] },
			options: { yes: ["phishing", "attack"], no: ["legit", "safe"] },
		},
	},
	classify: () => ({ decision: "yes", confidence: 0.9, domain: "phishing" }),
};

describe("aliases", () => {
	it("question via alias", () => {
		assert.equal(
			mapQuestion(undefined, "is this a scam?", ["suspicious"], "suspicious", {
				suspicious: ["scam"],
			}),
			"suspicious",
		);
		assert.equal(mapQuestion(undefined, "unrelated?", ["suspicious"], "suspicious"), "suspicious");
	});
	it("decision remappee vers options appelant", async () => {
		const s = new Sabaki();
		s.register(plug);
		const { answer } = await answerJev(
			s,
			"phishing verify now",
			"q1",
			{ type: "choice", instructions: "scam?", criteria: { phishing: "x", legit: "y" } },
			"test-model",
		);
		assert.equal(answer.type, "choice");
		if (answer.type === "choice") {
			assert.equal(answer.choice, "phishing");
			assert.ok(answer.probabilities["phishing"]! > 0.5);
		}
	});
	it("toJevAnswer sans alias = comportement historique", () => {
		const a = toJevAnswer("choice", ["yes", "no"], { decision: "yes", confidence: 0.9, domain: "d" });
		assert.equal(a.type, "choice");
		if (a.type === "choice") assert.equal(a.choice, "yes");
	});
});
