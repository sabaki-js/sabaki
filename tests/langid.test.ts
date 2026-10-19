import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { detectLanguage, detectScriptLang } from "../src/index.js";

describe("langid", () => {
	it("scripts non-latins exacts", () => {
		assert.equal(detectScriptLang("火车站在哪里？"), "zh");
		assert.equal(detectScriptLang("駅はどこですか？"), "ja");
		assert.equal(detectScriptLang("기차역이 어디에 있나요?"), "ko");
		assert.equal(detectScriptLang("สถานีรถไฟอยู่ที่ไหน?"), "th");
		assert.equal(detectScriptLang("أين محطة القطار؟"), "ar");
		assert.equal(detectScriptLang("रेलवे स्टेशन कहाँ है?"), "hi");
		assert.equal(detectScriptLang("Где находится вокзал?"), "ru");
		assert.equal(detectScriptLang("Where is the station?"), null);
	});
	it("latin via nano", () => {
		assert.equal(detectLanguage("Where is the train station?").lang, "en");
		assert.equal(detectLanguage("Où est la gare ?").lang, "fr");
		assert.equal(detectLanguage("Wo ist der Bahnhof?").lang, "de");
	});
});
