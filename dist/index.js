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
/**
 * Default domains: the 4 typed-decisions benchmark workflows
 * (`LocalLLaMA/typed-decisions`, the one Jev, Laya and OpenDecider take).
 * Keywords derived from the train split (300 states/workflow, TF/DF weighting).
 */
export const DEFAULT_DOMAINS = [
    "customer_service",
    "invoice_processing",
    "security_incidents",
    "agent_trace_observability",
];
/**
 * Router tokenization: lowercase, accents stripped, 4+ letter words.
 * @internal
 */
function tokens(s) {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3);
}
/** Global routing threshold when the manifest sets none (see `PluginManifest.threshold`). */
const ROUTE_THRESHOLD = 0.15;
export { featurize, predict } from "./logreg.js";
export { encode as wordpieceEncode, loadVocab } from "./wordpiece.js";
export { loadMini } from "./mini.js";
export { ensureMiniModel } from "./download.js";
export { definePlugin, miniClassifier, nanoClassifier } from "./plugin.js";
/**
 * Router: picks the domain (hence the plugin), then delegates the decision.
 * Register plugins with {@link Sabaki.register}, decide with
 * {@link Sabaki.decide} (sync) or {@link Sabaki.decideAsync} (mini).
 */
export class Sabaki {
    plugins = [];
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
    register(plugin) {
        if (!plugin?.manifest?.domain || typeof plugin.classify !== "function") {
            throw new Error("plugin invalide (manifest.domain + classify requis)");
        }
        this.plugins.push(plugin);
        return this;
    }
    /**
     * Picks the domain without deciding: fraction of manifest keywords
     * found in the state (loose sense: inclusion either way).
     *
     * @param {string} state - The state to route.
     * @returns The domain, the confidence (= the score) and the plugin, or `unknown`.
     */
    route(state) {
        const words = tokens(state);
        let best = null;
        for (const p of this.plugins) {
            const kws = p.manifest.keywords.map((k) => k.toLowerCase());
            if (kws.length === 0)
                continue;
            const hits = kws.filter((k) => words.some((w) => w.includes(k) || k.includes(w))).length;
            const score = hits / kws.length;
            if (!best || score > best.score)
                best = { plugin: p, score };
        }
        if (!best ||
            best.score < (best.plugin.manifest.threshold ?? ROUTE_THRESHOLD)) {
            return { domain: "unknown", confidence: 0, plugin: null };
        }
        return {
            domain: best.plugin.manifest.domain,
            confidence: Math.round(best.score * 100) / 100,
            plugin: best.plugin,
        };
    }
    /**
     * Routes, then lets the plugin decide (sync path, `nano` mode).
     * Never guesses: unknown domain → `decision: null`.
     *
     * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
     * @returns {DecideOutput} The decision, its confidence and the plugin.
     */
    decide(input) {
        const r = this.route(input.state);
        if (r.domain === "unknown" || !r.plugin) {
            return { domain: "unknown", decision: null, confidence: 0, plugin: null };
        }
        const out = r.plugin.classify(input);
        return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
    }
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
    async decideAsync(input) {
        const r = this.route(input.state);
        if (r.domain === "unknown" || !r.plugin) {
            return { domain: "unknown", decision: null, confidence: 0, plugin: null };
        }
        const out = await r.plugin.classify(input);
        return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
    }
}
