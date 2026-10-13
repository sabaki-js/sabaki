/**
 * Sabaki — core : routing to typed-decision plugins.
 *
 * Zero runtime dependencies in `nano` mode (`onnxruntime-node` is optional
 * and only loaded in `mini` mode, see {@link loadMini}).
 *
 * @example
 * ```ts
 * import { Sabaki } from "sabaki";
 * import billing from "@sabaki-js/plugin-billing";
 *
 * const sabaki = new Sabaki();
 * sabaki.register(billing);
 * const r = sabaki.decide({ state: "Facture double, remboursement urgent" });
 * // { domain: "billing", decision: "billing", confidence: 0.85, plugin: "@sabaki-js/plugin-billing" }
 * ```
 */
/** Typed value returned by a plugin (`choice`, `score`, `noul` — or no answer). */
export type Decision = string | number | boolean | null;
export interface SabakiInput {
    /** Text or serialized object to decide on (ticket, email, game state…). */
    state: string;
    /**
     * Name of the question to decide. Default: the plugin's primary question
     * (`manifest.primary`, else `manifest.questions[0]`).
     */
    question?: string;
    /** Sender (used by the `mail` plugin: `from + state`). */
    from?: string;
    [key: string]: unknown;
}
export interface PluginManifest {
    /** npm name of the plugin (e.g. `"@sabaki-js/plugin-mail"`). */
    name: string;
    /** Routed domain (e.g. `"mail"`, `"customer_service"`). */
    domain: string;
    /** Semantic version of the plugin. */
    version: string;
    /** Supported typed questions (e.g. `["bucket", "suspicious"]`). */
    questions: string[];
    /** Question answered by default. Default: `questions[0]`. */
    primary?: string;
    /** Routing keywords (see `Sabaki.route` for scoring). */
    keywords: string[];
    /**
     * Routing threshold (fraction of matched keywords). Default: `0.15`.
     * Short subjects (emails): `0.05`. Below it, the domain is `"unknown"`.
     */
    threshold?: number;
    /** Supported modes (`nano` bundled, `mini` downloaded ONNX). */
    modes?: Record<string, string>;
}
export interface ClassifyOutput {
    /** Typed decision (`choice`, `score`, `noul`). */
    decision: Decision;
    /** Confidence in `[0, 1]` (calibrated probability in `mini` mode). */
    confidence: number;
    /** Domain of the deciding plugin. */
    domain: string;
}
export interface SabakiPlugin {
    manifest: PluginManifest;
    /**
     * Decides `input`. May be sync (nano) or async (mini, remote) —
     * use {@link Sabaki.decideAsync} when in doubt.
     */
    classify: (input: SabakiInput) => ClassifyOutput | Promise<ClassifyOutput>;
}
export interface DecideOutput extends ClassifyOutput {
    /** Name of the deciding plugin (`manifest.name`), or `null` when `unknown`. */
    plugin: string | null;
}
/**
 * Default domains: the 4 typed-decisions benchmark workflows
 * (`LocalLLaMA/typed-decisions`, the one Jev, Laya and OpenDecider take).
 * Keywords derived from the train split (300 states/workflow, TF/DF weighting).
 */
export declare const DEFAULT_DOMAINS: readonly ["customer_service", "invoice_processing", "security_incidents", "agent_trace_observability"];
/** One of the 4 typed-decisions workflows. */
export type DefaultDomain = (typeof DEFAULT_DOMAINS)[number];
export { featurize, predict } from "./logreg.js";
export type { ModelWeights, QuestionWeights } from "./logreg.js";
export { encode as wordpieceEncode, loadVocab } from "./wordpiece.js";
export type { MiniVocab } from "./wordpiece.js";
export { loadMini } from "./mini.js";
export type { MiniModel } from "./mini.js";
export { ensureMiniModel } from "./download.js";
export { definePlugin, miniClassifier, nanoClassifier } from "./plugin.js";
export type { DefinePluginOptions } from "./plugin.js";
/**
 * Router: picks the domain (hence the plugin), then delegates the decision.
 * Register plugins with {@link Sabaki.register}, decide with
 * {@link Sabaki.decide} (sync) or {@link Sabaki.decideAsync} (mini).
 */
export declare class Sabaki {
    private plugins;
    /**
     * Registers a plugin (`{ manifest, classify }` object or import default).
     *
     * @param {SabakiPlugin} plugin - The plugin to register.
     * @returns {this} The instance (chainable).
     * @throws {Error} When `manifest.domain` is missing or `classify` is not a function.
     * @example
     * ```ts
     * sabaki.register(mail).register(billing);
     * ```
     */
    register(plugin: SabakiPlugin): this;
    /**
     * Picks the domain without deciding: fraction of manifest keywords
     * found in the state (loose sense: inclusion either way).
     *
     * @param {string} state - The state to route.
     * @returns The domain, the confidence (= the score) and the plugin, or `unknown`.
     */
    route(state: string): {
        domain: string;
        confidence: number;
        plugin: SabakiPlugin | null;
    };
    /**
     * Routes, then lets the plugin decide (sync path, `nano` mode).
     * Never guesses: unknown domain → `decision: null`.
     *
     * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
     * @returns {DecideOutput} The decision, its confidence and the plugin.
     */
    decide(input: SabakiInput): DecideOutput;
    /**
     * Async variant: supports `mini` (ONNX) and remote plugins.
     * Also works with sync plugins.
     *
     * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
     * @returns {Promise<DecideOutput>} The decision, its confidence and the plugin.
     * @example
     * ```ts
     * const r = await sabaki.decideAsync({ state, question: "category" });
     * if (r.confidence > 0.8) automate(r);
     * ```
     */
    decideAsync(input: SabakiInput): Promise<DecideOutput>;
}
//# sourceMappingURL=index.d.ts.map