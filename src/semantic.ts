/**
 * Semantic question mapping (opt-in layer above lexical aliases).
 *
 * The lexical path (`mapQuestion`) handles declared aliases; this layer
 * handles free-form wording for the same question once the lexical path
 * missed. It is not a router: the plugin is already chosen, and the layer
 * may only confirm it.
 *
 * NEGATIVE RESULT, layer disabled by default. Measured on a 54-case
 * hand-written set (EN/FR/ES/DE/IT/PT/RU/JA/ZH), variants derived from the
 * manifests, int8 bi-encoder (119 MB, 4 ms per request):
 *   - out-of-domain wordings are rejected cleanly;
 *   - in-domain questions about the same text are NOT: "ce message est-il
 *     bien redige ?" scores 0.608, "quel est le ton de ce message ?" 0.564,
 *     above the 0.50 threshold and above several true positives (0.50-0.67);
 *   - end to end in `answerJev`: 27/28 positives served versus 11/28 with
 *     lexical aliases alone, but 3/26 negatives answered by the wrong
 *     specialist (12%).
 * Contrasting against generic "about this message" questions was tried: it
 * removes the false positives only by dropping true positives to ~0.04 of
 * margin (see examples/eval_contrast.mjs). A bi-encoder ranks topic, not
 * intent; question routing here needs a cross-encoder trained for it.
 *
 * The plumbing is kept for that future model: variants per question,
 * precomputed embeddings, cross-plugin competition (a per-plugin threshold
 * alone accepts "is this a scam?" as a jailbreak question, 0.57).
 */
import { encodeUnigram, loadUnigram, type UnigramVocab } from "./unigram.js";

export interface SemanticModel {
	embed: (texts: string[]) => Promise<number[][]>;
}

export function cosine(a: number[], b: number[]): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
	return s;
}

export function describeQuestion(
	question: string,
	manifest: { domain: string; aliases?: { questions?: Record<string, string[]> }; descriptions?: Record<string, string> },
): string {
	return (
		manifest.descriptions?.[question] ??
		`${question} ${(manifest.aliases?.questions?.[question] ?? []).join(" ")} ${manifest.domain}`.trim()
	);
}

/** All wordings the bi-encoder should accept for one question. */
export function questionVariants(
	question: string,
	manifest: { domain: string; questions?: string[]; aliases?: { questions?: Record<string, string[]> }; descriptions?: Record<string, string> },
): string[] {
	const out = [describeQuestion(question, manifest), question];
	for (const a of manifest.aliases?.questions?.[question] ?? []) if (a) out.push(a);
	return [...new Set(out.filter((v) => v.trim().length > 0))];
}

/** One candidate question of one plugin, embedded once at startup. */
export interface SemanticCandidate {
	plugin: string;
	question: string;
	vectors: number[][];
}

export type SemanticMatch = {
	plugin: string;
	question: string;
	score: number;
	/** `score` minus the best score of any other plugin. Must be >= 0. */
	margin: number;
};

/**
 * Precomputes the variant embeddings (172 ms for two plugins) so that a
 * request costs one forward pass (~4 ms int8) instead of six.
 */
export async function buildCandidates(
	plugins: Array<{
		manifest: {
			name?: string;
			questions: string[];
			domain: string;
			aliases?: { questions?: Record<string, string[]> };
			descriptions?: Record<string, string>;
		};
	}>,
	embed: (texts: string[]) => Promise<number[][]>,
): Promise<SemanticCandidate[]> {
	const out: SemanticCandidate[] = [];
	for (const p of plugins) {
		const name = p.manifest.name ?? p.manifest.domain;
		for (const q of p.manifest.questions) {
			const texts = questionVariants(q, p.manifest);
			const vectors = await embed(texts);
			out.push({ plugin: name, question: q, vectors });
		}
	}
	return out;
}

/**
 * Best candidate for `query`, with the margin over every other plugin.
 * Pure: the caller decides whether to trust it (threshold + margin).
 */
export async function matchSemantic(
	query: string,
	candidates: SemanticCandidate[],
	embed: (texts: string[]) => Promise<number[][]>,
): Promise<SemanticMatch | null> {
	if (!candidates.length || !query.trim()) return null;
	const qv = (await embed([query]))[0];
	if (!qv) return null;
	let best = { plugin: "", question: "", score: -2 };
	const bestPerPlugin = new Map<string, number>();
	for (const c of candidates) {
		let s = -2;
		for (const v of c.vectors) {
			const d = cosine(qv, v);
			if (d > s) s = d;
		}
		const prev = bestPerPlugin.get(c.plugin);
		bestPerPlugin.set(c.plugin, prev === undefined ? s : Math.max(prev, s));
		if (s > best.score) best = { plugin: c.plugin, question: c.question, score: s };
	}
	let other = -2;
	for (const [p, s] of bestPerPlugin) if (p !== best.plugin && s > other) other = s;
	return { ...best, margin: best.score - other };
}

/** Defaults measured above; do not lower `threshold` below 0.45. */
export const SEMANTIC_THRESHOLD = 0.5;

/** Pure match over precomputed or injected embeddings (testable). */
export async function mapSemantic(
	query: string,
	candidates: Array<{ key: string; text: string }>,
	embed: (texts: string[]) => Promise<number[][]>,
	threshold = 0.3,
): Promise<string | null> {
	if (!candidates.length) return null;
	const [qv, ...cv] = await embed([query, ...candidates.map((c) => c.text)]);
	let best: string | null = null;
	let bs = threshold;
	for (let i = 0; i < candidates.length; i++) {
		const s = cosine(qv!, cv[i]!);
		if (s > bs) {
			bs = s;
			best = candidates[i]!.key;
		}
	}
	return best;
}

let cached: Promise<SemanticModel> | null = null;

/**
 * Loads a bi-encoder dir (`biencoder.onnx` + `tokenizer/`, Unigram).
 * Lazy: import onnxruntime-node only here, so the core stays light.
 */
export function loadBiencoder(
	modelDir?: string,
	onnxFile = "biencoder.onnx",
): Promise<SemanticModel> {
	const dir = modelDir ?? process.env.SABAKI_BIENCODER_DIR;
	if (!dir) throw new Error("bi-encodeur: SABAKI_BIENCODER_DIR requis");
	if (!cached) {
		cached = (async () => {
			const ortMod = await import("onnxruntime-node").catch(() => {
				throw new Error("sémantique requiert onnxruntime-node");
			});
			const ort = (ortMod.default ?? ortMod) as typeof ortMod.default;
			const fs = await import("fs");
			const path = await import("path");
			const tokJson = JSON.parse(
				fs.readFileSync(path.join(dir, "tokenizer", "tokenizer.json"), "utf8"),
			) as { model?: { type?: string } };
			if (tokJson?.model?.type !== "Unigram") {
				throw new Error("bi-encodeur: tokenizer Unigram attendu");
			}
			const vocab: UnigramVocab = loadUnigram(tokJson);
			const sess = await ort.InferenceSession.create(path.join(dir, onnxFile), {
				intraOpNumThreads: 2,
			});
			const Tensor = ort.Tensor;
			return {
				embed: async (texts: string[]) => {
					const encs = texts.map((t) => {
						const e = encodeUnigram(t, vocab, 64);
						return e;
					});
					const L = Math.max(...encs.map((e) => e.ids.length));
					const ids: number[] = [];
					const mask: number[] = [];
					for (const e of encs) {
						const p = L - e.ids.length;
						ids.push(...e.ids, ...new Array(p).fill(vocab.padId));
						mask.push(...e.mask, ...new Array(p).fill(0));
					}
					const feeds = {
						input_ids: new Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [texts.length, L]),
						attention_mask: new Tensor("int64", BigInt64Array.from(mask.map(BigInt)), [texts.length, L]),
					};
					const out = (await sess.run(feeds)) as Record<string, { data: ArrayLike<number> }>;
					const raw = Array.from(out["sentence_embedding"]!.data);
					const dim = raw.length / texts.length;
					return Array.from({ length: texts.length }, (_, i) => raw.slice(i * dim, (i + 1) * dim));
				},
			};
		})();
	}
	return cached;
}
