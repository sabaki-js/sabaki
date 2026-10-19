/**
 * Nano language detection (16 languages).
 *
 * Non-latin scripts are exact via unicode ranges (no weights needed):
 * kana -> ja, hangul -> ko, thai -> th, arabic -> ar, devanagari -> hi,
 * cyrillic -> ru, han -> zh. Latin-script text goes through a small
 * TF-IDF+LogReg 9-class head (`langid-weights.json`, 316 Ko, <1 ms).
 */
import { predict } from "./logreg.js";
import type { ModelWeights } from "./logreg.js";
import weightsData from "./langid-weights.json" with { type: "json" };

const weights = weightsData as ModelWeights;

/** Non-latin script shortcuts, order matters (kana before han: ja mixes both). */
const SCRIPT_LANG: Array<[RegExp, string]> = [
	[/[\u3040-\u309F\u30A0-\u30FF]/, "ja"],
	[/[\uAC00-\uD7AF]/, "ko"],
	[/[\u0E00-\u0E7F]/, "th"],
	[/[\u0600-\u06FF]/, "ar"],
	[/[\u0900-\u097F]/, "hi"],
	[/[\u0400-\u04FF]/, "ru"],
	[/[\u4E00-\u9FFF]/, "zh"],
];

/** Exact script hit, or `null` when the text is latin-only. */
export function detectScriptLang(text: string): string | null {
	for (const [re, lang] of SCRIPT_LANG) {
		if (re.test(text)) return lang;
	}
	return null;
}

export interface LangDetect {
	lang: string;
	confidence: number;
	/** `"latin"` (ML head) or the ISO code matched by script. */
	via: "latin" | "script";
}

/** `detectLanguage("Où est la gare ?")` -> `{ lang: "fr", ... }`. */
export function detectLanguage(text: string): LangDetect {
	const s = detectScriptLang(text);
	if (s) return { lang: s, confidence: 0.99, via: "script" };
	const r = predict(text, weights, "lang");
	return {
		lang: String(r.decision),
		confidence: r.confidence,
		via: "latin",
	};
}

/** All 16 covered languages. */
export const LANGID_LANGS = [
	"de",
	"en",
	"es",
	"fr",
	"it",
	"pt",
	"tr",
	"id",
	"vi",
	"ar",
	"zh",
	"ja",
	"ko",
	"th",
	"hi",
	"ru",
];
