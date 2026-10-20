/**
 * Semantic question mapping (opt-in layer above lexical aliases).
 *
 * When `mapQuestion` finds nothing, embed the user's wording and compare
 * against one sentence-ish description per native question
 * (`manifest.descriptions`, else question + aliases + domain). Best
 * cosine above threshold wins, else primary. Measured on paraphrase
 * probes (FR+EN): 6/6 with margins, unrelated queries far below ---
 * use threshold ~0.3, never below 0.2.
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
			const sess = await ort.InferenceSession.create(path.join(dir, "biencoder.onnx"), {
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
