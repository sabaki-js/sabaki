/**
 * `mini`-mode runtime (ONNX). `onnxruntime-node` is optional and dynamically
 * imported: the core stays dependency-free in `nano` mode.
 */
import { encode, loadVocab } from "./wordpiece.js";

export interface MiniModel {
	run: (
		state: string,
		question: string,
	) => Promise<{ decision: string; confidence: number }>;
}

function softmax(a: number[]): number[] {
	const m = Math.max(...a);
	const e = a.map((x) => Math.exp(x - m));
	const s = e.reduce((x, y) => x + y, 0);
	return e.map((x) => x / s);
}

/**
 * Loads a `mini` model from a directory prepared by {@link ensureMiniModel}
 * (`model.json` + `.onnx` + `tokenizer.json`). ~10–25 ms/req on desktop CPU.
 *
 * @param {string} modelDir - The model directory.
 * @returns {Promise<MiniModel>} The model (`run(state, question)`).
 * @throws {Error} When `onnxruntime-node` is not installed.
 * @example
 * ```ts
 * const mini = await loadMini(await ensureMiniModel("customer_service"));
 * await mini.run("facture double, remboursement urgent", "category");
 * // { decision: "billing", confidence: 0.93 }
 * ```
 */
export async function loadMini(modelDir: string): Promise<MiniModel> {
	const [ortMod, fs, path] = await Promise.all([
		import("onnxruntime-node").catch(() => {
			throw new Error(
				"mode mini requiert onnxruntime-node : npm i onnxruntime-node",
			);
		}),
		import("fs"),
		import("path"),
	]);
	const ort = (ortMod.default ?? ortMod) as typeof ortMod.default;
	const { model, config } = JSON.parse(
		fs.readFileSync(path.join(modelDir, "model.json"), "utf8"),
	) as {
		model: string;
		config: {
			questions: string[];
			classes: Record<string, string[]>;
			temperatures?: Record<string, number>;
		};
	};
	const vocab = loadVocab(
		JSON.parse(fs.readFileSync(path.join(modelDir, "tokenizer.json"), "utf8")),
	);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	const sess = await ort.InferenceSession.create(path.join(modelDir, model), {
		intraOpNumThreads: 4,
	});
	return {
		run: async (state: string, question: string) => {
			const { ids, mask } = encode(state, vocab);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			const Tensor = ort.Tensor;
			const feeds = {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				input_ids: new Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [
					1,
					ids.length,
				]),
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				attention_mask: new Tensor(
					"int64",
					BigInt64Array.from(mask.map(BigInt)),
					[1, mask.length],
				),
			};
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const out = (await sess.run(feeds)) as Record<
				string,
				{ data: ArrayLike<number> }
			>;
			const raw = Array.from(out[`logits_${question}`]!.data);
			const temp = config.temperatures?.[question] ?? 1;
			const p = softmax(raw.map((x) => x / temp));
			let bi = 0;
			p.forEach((v, i) => {
				if (v > p[bi]!) bi = i;
			});
			return {
				decision: config.classes[question]![bi]!,
				confidence: Math.round(p[bi]! * 1000) / 1000,
			};
		},
	};
}
