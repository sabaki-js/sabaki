/**
 * Generic plugin factories: `nano` (bundled weights, <1 ms),
 * `mini` (downloaded ONNX, ~20 ms), or fully ad-hoc.
 */
import { type ModelWeights } from "./logreg.js";
import type { ClassifyOutput, PluginManifest, SabakiInput, SabakiPlugin } from "./index.js";
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
export declare function definePlugin(opts: DefinePluginOptions): SabakiPlugin;
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
export declare function nanoClassifier(manifest: PluginManifest, weights: ModelWeights, opts?: {
    primary?: string;
    joinFrom?: boolean;
}): SabakiPlugin;
/**
 * Generic `mini` plugin: downloads the ONNX weights (cache + SHA256,
 * see {@link ensureMiniModel}) then classifies. Use `classifyAsync`
 * or `Sabaki.decideAsync` (inference is async).
 *
 * @param {PluginManifest} manifest - The manifest (domain, questions).
 * @param {string} workflow - The model name (e.g. `"customer_service"`).
 * @param {{ primary?: string; version?: string; variant?: "int8" | "fp32" }} opts - Question,
 * release version (default `"v0.2.0"`) and precision (default `"int8"`).
 * @returns {Promise<SabakiPlugin>} The plugin (with `classifyAsync`).
 * @example
 * ```ts
 * const mini = await miniClassifier(manifest, "customer_service");
 * const r = await mini.classifyAsync({ state: ticket });
 * ```
 */
export declare function miniClassifier(manifest: PluginManifest, workflow: string, opts?: {
    primary?: string;
    version?: string;
    variant?: "int8" | "fp32";
}): Promise<SabakiPlugin & {
    classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput>;
}>;
//# sourceMappingURL=plugin.d.ts.map