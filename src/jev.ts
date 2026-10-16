/**
 * Jev I/O over a routed `Sabaki` instance.
 * Each question: route state → winning specialist (question mapped,
 * else primary) or fallback generalist → Jev-typed answer.
 */
import { mapQuestion } from "./index.js";
import type {
	ClassifyOutput,
	Sabaki,
	SabakiInput,
} from "./index.js";

export interface JevQuestion {
	type: "choice" | "score" | "noul";
	instructions?: string;
	criteria?: Record<string, string | null> | string[];
	options?: string[];
	query?: string;
}

export type JevAnswer =
	| { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
	| { type: "score"; score: number; legend: Record<string, string>; probabilities: Record<string, number>; confidence: number }
	| { type: "noul"; noul: number };

export function criteriaOptions(q: JevQuestion): string[] {
	if (Array.isArray(q.criteria)) return q.criteria.slice(0, 10);
	if (q.criteria && typeof q.criteria === "object") return Object.keys(q.criteria).slice(0, 255);
	if (q.options) return q.options.slice(0, 8);
	return ["yes", "no"];
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function toJevAnswer(
	type: JevQuestion["type"],
	options: string[],
	out: ClassifyOutput,
): JevAnswer {
	const probs = out.probabilities ?? { [String(out.decision)]: out.confidence };
	if (type === "noul") {
		const p = probs[options[0]!] ?? (out.decision === options[0] ? out.confidence : 1 - out.confidence);
		return { type: "noul", noul: round3(p) };
	}
	if (type === "score") {
		const ps = options.map((o) => probs[o] ?? 0);
		return {
			type: "score",
			score: round3(ps.reduce((a, p, i) => a + i * p, 0)),
			legend: Object.fromEntries(options.map((o, i) => [String(i), o])),
			probabilities: Object.fromEntries(options.map((o, i) => [String(i), round3(ps[i]!)])),
			confidence: out.confidence,
		};
	}
	return {
		type: "choice",
		choice: String(out.decision),
		probabilities: Object.fromEntries(options.map((o) => [o, round3(probs[o] ?? 0)])),
		confidence: out.confidence,
	};
}

export function validateJevQuestion(q: JevQuestion): string | null {
	if (!q || (q.type !== "choice" && q.type !== "score" && q.type !== "noul"))
		return "unknown type (choice/score/noul requis)";
	if (typeof q.instructions !== "string" && typeof q.query !== "string")
		return "instructions requises";
	const n = criteriaOptions(q).length;
	if (q.type === "choice" && (n < 2 || n > 255)) return "choice: 2-255 options";
	if (q.type === "score" && (n < 2 || n > 10)) return "score: 2-10 levels";
	return null;
}

/**
 * Answers one Jev question: specialist (mapped) or fallback, Jev shape.
 * Specialists without full maps return `{decision: confidence}` (documented).
 * Returns the responder model id for Jev's `model` field.
 */
export async function answerJev(
	sabaki: Sabaki,
	state: string,
	qid: string,
	q: JevQuestion,
	generalistModel = "sabaki-generalist-v2",
): Promise<{ answer: JevAnswer; model: string }> {
	const options = criteriaOptions(q);
	const route = sabaki.route(state);
	if (route.plugin) {
		const manifest = route.plugin.manifest;
		const native = manifest.questions;
		// Spécialiste : seulement sa question native (id exact ou via instructions).
		// Critères explicites sur question non native -> fallback (seul le
		// generalist lit vraiment des critères arbitraires).
		const explicit = q.criteria || q.options;
		const nativeHit =
			native.includes(qid) ||
			native.some((n) => `${q.instructions ?? ""} ${q.query ?? ""}`.toLowerCase().includes(n.toLowerCase()));
		if (!explicit || nativeHit) {
			const question = mapQuestion(qid, `${q.instructions ?? ""} ${q.query ?? ""}`, native, manifest.primary ?? native[0]!);
			const input: SabakiInput = { state, question };
			const out = (await route.plugin.classify(input)) as ClassifyOutput;
			// Sans criteria explicites : l'espace de réponse = la décision elle-même.
			const opts = explicit ? options : [String(out.decision)];
			return {
				answer: toJevAnswer(q.type, opts, out),
				model: `${manifest.name}@${manifest.version}+${manifest.modes?.active ?? "nano"}`,
			};
		}
	}
	const out = await sabaki.decideFallback({
		state,
		question: q.instructions ?? q.query ?? qid,
		options,
	});
	if (out.decision === null) {
		return {
			answer: toJevAnswer(q.type, options, {
				decision: options[0]!,
				confidence: 0,
				domain: "unknown",
				probabilities: Object.fromEntries(options.map((o) => [o, 0])),
			}),
			model: generalistModel,
		};
	}
	return { answer: toJevAnswer(q.type, options, out), model: generalistModel };
}
