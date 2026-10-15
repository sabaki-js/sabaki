/**
 * Generalist runtime (cross-encoder MiniLM, runtime-defined decisions).
 * Bundled in core: the fallback when no specialist plugin wins routing.
 * Model is swappable (`SABAKI_GENERALIST_DIR` or explicit dir).
 */
import fs from "fs";
import path from "path";
import { encode, loadVocab } from "./wordpiece.js";
import type { ClassifyOutput, SabakiInput } from "./index.js";

export interface GeneralistInput extends SabakiInput {
	/** Candidate answers (>= 2, capped at 8). Default: `["yes", "no"]`. */
	options?: string[];
}

function softmax(a: number[]): number[] {
	const m = Math.max(...a);
	const e = a.map((x) => Math.exp(x - m));
	const s = e.reduce((x, y) => x + y, 0);
	return e.map((x) => x / s);
}

interface GeneralistBackend {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ort: any;
	vocab: Parameters<typeof encode>[1];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	sess: any;
}

const cache = new Map<string, Promise<GeneralistBackend>>();

/**
 * Loads a generalist cross-encoder dir (`generalist.onnx` + `tokenizer/`).
 * One forward per option, argmax over softmax scores.
 */
export function loadGeneralist(modelDir: string) {
	let p = cache.get(modelDir);
	if (!p) {
		p = (async () => {
			const ortMod = await import("onnxruntime-node").catch(() => {
				throw new Error("generalist requiert onnxruntime-node");
			});
			const ort = (ortMod.default ?? ortMod) as typeof ortMod.default;
			const vocab = loadVocab(
				JSON.parse(
					fs.readFileSync(path.join(modelDir, "tokenizer", "tokenizer.json"), "utf8"),
				),
			);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const sess = await ort.InferenceSession.create(
				path.join(modelDir, "generalist.onnx"),
				{ intraOpNumThreads: 2 },
			);
			return { ort, vocab, sess };
		})();
		cache.set(modelDir, p);
	}
	return {
		decide: async (input: GeneralistInput): Promise<ClassifyOutput> => {
			const { ort, vocab, sess } = await p!;
			const options =
				input.options && input.options.length >= 2 ? input.options.slice(0, 8) : ["yes", "no"];
			const Tensor = ort.Tensor;
			const scores: number[] = [];
			for (const o of options) {
				const { ids, mask } = encode(
					`${input.question ?? "decision"} [SEP] ${o} [SEP] ${input.state}`,
					vocab,
				);
				const feeds = {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					input_ids: new Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					attention_mask: new Tensor("int64", BigInt64Array.from(mask.map(BigInt)), [1, mask.length]),
				};
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				const out = (await sess.run(feeds)) as Record<string, { data: ArrayLike<number> }>;
				scores.push(Number(out["score"]!.data[0]));
			}
			const pr = softmax(scores);
			let bi = 0;
			pr.forEach((v, i) => {
				if (v > pr[bi]!) bi = i;
			});
			return {
				decision: options[bi]!,
				confidence: Math.round(pr[bi]! * 1000) / 1000,
				domain: "generalist",
				probabilities: Object.fromEntries(
					options.map((o, i) => [o, Math.round(pr[i]! * 1000) / 1000]),
				),
			};
		},
	};
}
