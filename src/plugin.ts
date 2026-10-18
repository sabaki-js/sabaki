/**
 * Generic plugin factories: `nano` (bundled weights, <1 ms),
 * `mini` (downloaded ONNX, ~20 ms), or fully ad-hoc.
 */
import { predict, type ModelWeights } from "./logreg.js";
import { loadMini } from "./mini.js";
import { ensureMiniModel } from "./download.js";
import type {
	ClassifyOutput,
	PluginManifest,
	SabakiInput,
	SabakiPlugin,
} from "./index.js";

export interface DefinePluginOptions {
	manifest: PluginManifest;
	classify: (input: SabakiInput) => ClassifyOutput | Promise<ClassifyOutput>;
}

/**
 * Creates an ad-hoc plugin, no repo or training needed: the minimal contract suffices.
 *
 * @param {DefinePluginOptions} opts - The manifest and the `classify` function.
 * @returns {SabakiPlugin} A plugin registrable via `Sabaki.register`.
 * @throws {Error} When `manifest.domain` is missing.
 * @example
 * ```ts
 * const ping = definePlugin({
 *   manifest: { name: "ping", domain: "ping", version: "0.1.0", questions: ["up"], keywords: ["ping"] },
 *   classify: () => ({ decision: "pong", confidence: 1, domain: "ping" }),
 * });
 * ```
 */
export function definePlugin(opts: DefinePluginOptions): SabakiPlugin {
	if (!opts.manifest?.domain) throw new Error("manifest.domain requis");
	return {
		manifest: opts.manifest,
		classify: (input: SabakiInput) => opts.classify(input) as ClassifyOutput,
	};
}

/**
 * Generic `nano` plugin from bundled TF-IDF + LogReg weights
 * (see `gpu/train.py` to produce them: vocabulary, idf, coefs).
 *
 * @param {PluginManifest} manifest - The manifest (domain, questions, keywords).
 * @param {ModelWeights} weights - The weights (`vocab`, `idf`, `questions`).
 * @param {{ primary?: string; joinFrom?: boolean }} opts - `primary` overrides
 * `manifest.primary`; `joinFrom` prefixes the state with `input.from` (mail plugin).
 * @returns {SabakiPlugin} Synchronous (<1 ms on CPU).
 */
export function nanoClassifier(
	manifest: PluginManifest,
	weights: ModelWeights,
	opts: { primary?: string; joinFrom?: boolean } = {},
): SabakiPlugin {
	const primary = opts.primary ?? manifest.primary ?? manifest.questions[0]!;
	return definePlugin({
		manifest,
		classify: (input: SabakiInput) => {
			const q =
				input.question && weights.questions[input.question]
					? input.question
					: primary;
			const from =
				opts.joinFrom && typeof input.from === "string" ? `${input.from} ` : "";
			const r = predict(`${from}${input.state}`, weights, q);
			return {
				decision: r.decision,
				confidence: r.confidence,
				domain: manifest.domain,
			};
		},
	});
}

/**
 * Generic `mini` plugin: downloads the ONNX weights (cache + SHA256,
 * see {@link ensureMiniModel}) then classifies. Use `classifyAsync`
 * or `Sabaki.decideAsync` (inference is async).
 *
 * @param {PluginManifest} manifest - The manifest (domain, questions).
 * @param {string} workflow - The model name (e.g. `"customer_service"`).
 * @param {{ primary?: string; version?: string; variant?: "int8" | "fp32" }} opts - Question,
 * release version (default `"v0.2.0"`) and precision (default `"int8"`).
 * Pass `opts.modelDir` to use weights bundled inside a plugin package
 * (offline, no download) instead of the HF cache.
 * @returns {Promise<SabakiPlugin>} The plugin (with `classifyAsync`).
 * @example
 * ```ts
 * const mini = await miniClassifier(manifest, "customer_service");
 * const r = await mini.classifyAsync({ state: ticket });
 * ```
 */
export async function miniClassifier(
	manifest: PluginManifest,
	workflow: string,
	opts: {
		primary?: string;
		version?: string;
		variant?: "int8" | "fp32";
		joinFrom?: boolean;
		/** Dossier de poids local (ex: plugin bundle) - prioritaire sur le telechargement. */
		modelDir?: string;
	} = {},
): Promise<
	SabakiPlugin & {
		classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput>;
	}
> {
	const primary = opts.primary ?? manifest.primary ?? manifest.questions[0]!;
	const dir = opts.modelDir ?? (await ensureMiniModel(workflow, opts.version, opts.variant));
	const mini = await loadMini(dir);
	const classifyAsync = async (input: SabakiInput): Promise<ClassifyOutput> => {
		const q = input.question ?? primary;
		const from =
			opts.joinFrom && typeof input.from === "string" ? `${input.from} ` : "";
		const r = await mini.run(`${from}${input.state}`, q);
		return {
			decision: r.decision,
			confidence: r.confidence,
			domain: manifest.domain,
		};
	};
	const active = { ...manifest, modes: { ...manifest.modes, active: "mini" } };
	return {
		manifest: active,
		classify: classifyAsync,
		classifyAsync,
	};
}

/**
 * Specialist with automatic mode: `mini` (ONNX, downloaded on first async
 * call) when `miniWorkflow` is set, sync `nano` (bundled weights) otherwise
 * or when the download fails (offline, unknown workflow).
 *
 * Routing is unchanged - only inference upgrades. `decide()` (sync) always
 * uses nano; `decideAsync()` uses mini once loaded.
 *
 * @param {PluginManifest} manifest - The manifest (domain, questions).
 * @param {ModelWeights} weights - Bundled nano weights.
 * @param {{ miniWorkflow?: string; primary?: string; joinFrom?: boolean; version?: string; variant?: "int8" | "fp32" }} opts - Mini model name + nano options.
 * @returns {SabakiPlugin} Async-capable plugin.
 */
export function autoClassifier(
	manifest: PluginManifest,
	weights: ModelWeights,
	opts: {
		miniWorkflow?: string;
		primary?: string;
		joinFrom?: boolean;
		version?: string;
		variant?: "int8" | "fp32";
	} = {},
): SabakiPlugin & {
	classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput>;
} {
	const primary = opts.primary ?? manifest.primary ?? manifest.questions[0]!;
	const nano = nanoClassifier(manifest, weights, { primary, joinFrom: opts.joinFrom });
	let mini:
		| (SabakiPlugin & {
				classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput>;
		  })
		| null
		| undefined;
	const classifyAsync = async (input: SabakiInput): Promise<ClassifyOutput> => {
		if (mini === undefined) {
			if (!opts.miniWorkflow) {
				mini = null;
			} else {
				try {
					mini = await miniClassifier(manifest, opts.miniWorkflow, {
						primary,
						version: opts.version,
						variant: opts.variant,
					});
				} catch {
					mini = null;
				}
			}
		}
		if (mini) return mini.classifyAsync(input);
		return nano.classify(input) as ClassifyOutput;
	};
	return {
		manifest,
		classify: classifyAsync,
		classifyAsync,
	};
}
