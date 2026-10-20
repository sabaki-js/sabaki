import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mapDecision, toJevAnswer } from "../src/index.js";

const ALIASES = {
	yes: ["phishing", "attack", "scam", "arnaque"],
	no: ["legit", "safe", "ham"],
};
const out = (decision: string, probabilities: Record<string, number>, confidence = 0.986) =>
	({ decision, confidence, domain: "phishing", probabilities }) as never;

describe("mapDecision", () => {
	it("exact d'abord", () => {
		assert.equal(mapDecision(["legit", "phishing"], "phishing", ALIASES), "phishing");
	});
	it("alias declare", () => {
		assert.equal(mapDecision(["safe", "scam"], "yes", ALIASES), "scam");
		assert.equal(mapDecision(["safe", "scam"], "no", ALIASES), "safe");
	});
	it("vocabulaire disjoint -> null", () => {
		assert.equal(mapDecision(["clean", "danger"], "yes", ALIASES), null);
		assert.equal(mapDecision(["clean", "danger"], "no", ALIASES), null);
	});
	it("sans alias, seul l'exact passe", () => {
		assert.equal(mapDecision(["yes", "no"], "yes"), "yes");
		assert.equal(mapDecision(["oui", "non"], "yes"), null);
	});
});

describe("toJevAnswer", () => {
	it("choice mappee : choix dans l'espace appelant, probas normalisees", () => {
		const a = toJevAnswer("choice", ["safe", "scam"], out("yes", { phishing: 0.98, legit: 0.02 }), ALIASES);
		assert.equal(a.type, "choice");
		if (a.type !== "choice") return;
		assert.equal(a.choice, "scam");
		assert.deepEqual(Object.keys(a.probabilities).sort(), ["safe", "scam"]);
		const sum = Object.values(a.probabilities).reduce((x, y) => x + y, 0);
		assert.ok(Math.abs(sum - 1) < 0.01, `somme ${sum}`);
		assert.equal(a.confidence, 0.986);
	});

	it("choice non mappable : abstention, jamais un label invente", () => {
		const a = toJevAnswer("choice", ["clean", "danger"], out("yes", { phishing: 0.98, legit: 0.02 }), ALIASES);
		assert.equal(a.type, "choice");
		if (a.type !== "choice") return;
		assert.ok(["clean", "danger"].includes(a.choice), `choice hors espace: ${a.choice}`);
		assert.equal(a.confidence, 0);
		assert.deepEqual(a.probabilities, { clean: 0, danger: 0 });
	});

	it("score non mappable : score 0, probabilites nulles, confiance 0", () => {
		const a = toJevAnswer("score", ["low", "mid", "high"], out("yes", { phishing: 0.98 }), ALIASES);
		assert.equal(a.type, "score");
		if (a.type !== "score") return;
		assert.equal(a.score, 0);
		assert.deepEqual(a.probabilities, { 0: 0, 1: 0, 2: 0 });
		assert.equal(a.confidence, 0);
		assert.deepEqual(a.legend, { 0: "low", 1: "mid", 2: "high" });
	});

	it("noul non mappable : 0", () => {
		const a = toJevAnswer("noul", ["clean"], out("yes", { phishing: 0.98 }), ALIASES);
		assert.equal(a.type, "noul");
		if (a.type !== "noul") return;
		assert.equal(a.noul, 0);
	});
});
