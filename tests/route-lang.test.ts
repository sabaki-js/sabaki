import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Sabaki, type SabakiPlugin } from "../src/index.js";

const mk = (name: string, langs?: string[]): SabakiPlugin => ({
	manifest: {
		name,
		domain: "phishing",
		version: "1.0.0",
		questions: ["suspicious"],
		keywords: ["phishing", "suspect", "verify"],
		...(langs ? { languages: langs } : {}),
	},
	classify: () => ({ decision: "yes", confidence: 1, domain: "phishing" }),
});

describe("route par langue", () => {
	it("latin vs CJK", () => {
		const s = new Sabaki();
		s.register(mk("latin", ["de", "en", "es", "fr", "id", "tr", "vi"]));
		s.register(mk("cjk", ["ar", "zh", "ja", "ko", "th", "hi", "ru"]));
		assert.equal(s.route("phishing verify your account").plugin?.manifest.name, "latin");
		assert.equal(s.route("phishing vérifiez votre compte").plugin?.manifest.name, "latin");
		assert.equal(s.route("phishing 您的帐户需要验证").plugin?.manifest.name, "cjk");
	});
	it("sans languages = toutes langues", () => {
		const s = new Sabaki();
		s.register(mk("all"));
		assert.equal(s.route("phishing 您的帐户需要验证").plugin?.manifest.name, "all");
	});
});
