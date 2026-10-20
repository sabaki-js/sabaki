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
	aliases?: Record<string, string[]>,
): JevAnswer {
	const probs = out.probabilities ?? { [String(out.decision)]: out.confidence };
	// Remappe le label natif vers l'espace d'options de l'appelant :
	// exact, alias déclaré, sinon tel quel (comportement historique).
	const mapLabel = (d: string): string => {
		if (options.includes(d)) return d;
		if (aliases) {
			const low = (o: string) => o.toLowerCase();
			for (const o of options) {
				const als = aliases[d] ?? [];
				if (als.some((a) => a && (low(o) === a.toLowerCase() || low(o).includes(a.toLowerCase()) || a.toLowerCase().includes(low(o))))) return o;
			}
		}
		return d;
	};
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
	const remapped: Record<string, number> = {};
	for (const [k, v] of Object.entries(probs)) {
		const m = mapLabel(k);
		remapped[m] = (remapped[m] ?? 0) + (typeof v === "number" ? v : 0);
	}
	return {
		type: "choice",
		choice: mapLabel(String(out.decision)),
		probabilities: Object.fromEntries(options.map((o) => [o, round3(remapped[o] ?? (o === mapLabel(String(out.decision)) ? out.confidence : 0))])),
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
	generalistModel = "sabaki-generalist",
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
		const itext = `${q.instructions ?? ""} ${q.query ?? ""}`.toLowerCase();
		const nativeHit =
			native.includes(qid) ||
			native.some((n) => itext.includes(n.toLowerCase())) ||
			native.some(
				(n) =>
					manifest.aliases?.questions?.[n]?.some(
						(a) => a && itext.includes(a.toLowerCase()),
					) ?? false,
			);
		if (!explicit || nativeHit) {
			const question = mapQuestion(qid, `${q.instructions ?? ""} ${q.query ?? ""}`, native, manifest.primary ?? native[0]!, manifest.aliases?.questions);
			const input: SabakiInput = { state, question };
			const out = (await route.plugin.classify(input)) as ClassifyOutput;
			// Sans criteria explicites : l'espace de réponse = la décision elle-même.
			const opts = explicit ? options : [String(out.decision)];
			return {
				answer: toJevAnswer(q.type, opts, out, manifest.aliases?.options),
				model: `${manifest.name}@${manifest.version}+${manifest.modes?.active ?? "nano"}`,
			};
		}
		// Voie sémantique (opt-in) : sans hit lexical mais avec bi-encodeur,
		// la paraphrase suffit. Garde-fous mesures : le plugin route doit
		// gagner la competition et depasser SEMANTIC_THRESHOLD. Échec
		// silencieux -> fallback historique.
		try {
			const { semanticMatch } = await import("./semantic-router.js");
			const hit = await semanticMatch(sabaki, `${q.instructions ?? ""} ${q.query ?? ""}`.trim() || qid);
			const self = route.plugin.manifest.name ?? manifest.domain;
			if (hit && hit.plugin === self) {
				const out = (await route.plugin.classify({ state, question: hit.question })) as ClassifyOutput;
				return {
					answer: toJevAnswer(q.type, options, out, manifest.aliases?.options),
					model: `${manifest.name}@${manifest.version}+${manifest.modes?.active ?? "nano"}+sem`,
				};
			}
		} catch {
			/* pas de bi-encodeur : fallback */
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
	return { answer: toJevAnswer(q.type, options, out), model: out.model ?? generalistModel };
}
