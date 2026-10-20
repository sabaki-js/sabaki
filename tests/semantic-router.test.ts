import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	buildCandidates,
	cosine,
	describeQuestion,
	matchSemantic,
	questionVariants,
} from "../src/index.js";

// Bi-encodeur factice : le vecteur depend de mots-cles connus.
const fakeEmbed = async (texts: string[]) =>
	texts.map((t) => {
		const s = t.toLowerCase();
		if (/scam|arnaqu|suspicious|phishing/.test(s)) return [1, 0, 0];
		if (/jailbreak|bypass|contourn/.test(s)) return [0, 1, 0];
		return [0, 0, 1];
	});

const MANIFEST_A = {
	name: "@test/phishing",
	domain: "phishing",
	questions: ["suspicious"],
	descriptions: { suspicious: "Is this a scam?" },
	aliases: { questions: { suspicious: ["arnaque"] } },
};
const MANIFEST_B = {
	name: "@test/jailbreak",
	domain: "jailbreak",
	questions: ["jailbreak?"],
	descriptions: { "jailbreak?": "Is this a jailbreak attempt?" },
	aliases: { questions: { "jailbreak?": ["bypass"] } },
};

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
		assert.equal(describeQuestion("other", m), "other  phishing");
	});

	it("questionVariants : description + question + alias, dedoublonne", () => {
		const v = questionVariants("suspicious", MANIFEST_A);
		assert.deepEqual(v, ["Is this a scam?", "suspicious", "arnaque"]);
		const w = questionVariants("suspicious", {
			domain: "d",
			aliases: { questions: { suspicious: ["suspicious"] } },
			descriptions: {},
		});
		assert.deepEqual(w, ["suspicious suspicious d", "suspicious"]);
	});

	it("buildCandidates : un candidat par question, vecteurs precalcules", async () => {
		const cands = await buildCandidates([{ manifest: MANIFEST_A }, { manifest: MANIFEST_B }], fakeEmbed);
		assert.equal(cands.length, 2);
		assert.equal(cands[0]!.plugin, "@test/phishing");
		assert.equal(cands[0]!.vectors.length, 3);
		assert.equal(cands[1]!.question, "jailbreak?");
	});

	it("matchSemantic : gagnant + marge sur l'autre plugin", async () => {
		const cands = await buildCandidates([{ manifest: MANIFEST_A }, { manifest: MANIFEST_B }], fakeEmbed);
		const phish = await matchSemantic("est-ce une arnaque ?", cands, fakeEmbed);
		assert.equal(phish?.plugin, "@test/phishing");
		assert.ok(phish!.margin > 0.99);

		const jb = await matchSemantic("bypass attempt", cands, fakeEmbed);
		assert.equal(jb?.plugin, "@test/jailbreak");
		assert.ok(jb!.margin > 0.99);
	});

	it("matchSemantic : hors sujet -> marge nulle, pas de gagnant net", async () => {
		const cands = await buildCandidates([{ manifest: MANIFEST_A }, { manifest: MANIFEST_B }], fakeEmbed);
		const hit = await matchSemantic("quelle heure est-il ?", cands, fakeEmbed);
		assert.ok(hit);
		assert.equal(hit.score, 0);
		assert.equal(hit.margin, 0);
	});

	it("matchSemantic : entrees vides", async () => {
		assert.equal(await matchSemantic("scam", [], fakeEmbed), null);
		assert.equal(
			await matchSemantic("   ", await buildCandidates([{ manifest: MANIFEST_A }], fakeEmbed), fakeEmbed),
			null,
		);
	});
});
