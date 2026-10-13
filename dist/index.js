/**
 * Sabaki — core : routage vers des plugins de décision typée.
 *
 * Zéro dépendance runtime en mode `nano` (`onnxruntime-node` est optionnel
 * et n'est chargé qu'en mode `mini`, voir {@link loadMini}).
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
 * Domaines par défaut : les 4 workflows du benchmark typed-decisions
 * (`LocalLLaMA/typed-decisions`, celui que passent Jev, Laya et OpenDecider).
 * Mots-clés dérivés du split train (300 états/workflow, pondération TF/DF).
 */
export const DEFAULT_DOMAINS = [
    "customer_service",
    "invoice_processing",
    "security_incidents",
    "agent_trace_observability",
];
/**
 * Tokenisation du routeur : minuscules, accents retirés, mots de 4+ lettres.
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
/** Seuil de routage global quand le manifest n'en fixe pas (voir `PluginManifest.threshold`). */
const ROUTE_THRESHOLD = 0.15;
export { featurize, predict } from "./logreg.js";
export { encode as wordpieceEncode, loadVocab } from "./wordpiece.js";
export { loadMini } from "./mini.js";
export { ensureMiniModel } from "./download.js";
export { definePlugin, miniClassifier, nanoClassifier } from "./plugin.js";
/**
 * Routeur : choisit le domaine (donc le plugin) puis délègue la décision.
 * Enregistrez les plugins avec {@link Sabaki.register}, tranchez avec
 * {@link Sabaki.decide} (synchrone) ou {@link Sabaki.decideAsync} (mini).
 */
export class Sabaki {
    plugins = [];
    /**
     * Enregistre un plugin (objet `{ manifest, classify }` ou défaut d'import).
     *
     * @param {SabakiPlugin} plugin - Le plugin à enregistrer.
     * @returns {this} L'instance (chaînable).
     * @throws {Error} Si `manifest.domain` manque ou `classify` n'est pas une fonction.
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
     * Choisit le domaine sans décider : fraction de mots-clés du manifest
     * retrouvés dans l'état (sens large : inclusion dans les deux sens).
     *
     * @param {string} state - L'état à router.
     * @returns Le domaine, la confiance (= le score) et le plugin, ou `unknown`.
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
     * Route puis fait décider le plugin (chemin synchrone, mode `nano`).
     * Ne devine jamais : domaine inconnu → `decision: null`.
     *
     * @param {SabakiInput} input - L'entrée (`state`, `question?`, `from?`).
     * @returns {DecideOutput} La décision, sa confiance et le plugin.
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
     * Variante asynchrone : supporte les plugins `mini` (ONNX) et distants.
     * Fonctionne aussi avec les plugins synchrones.
     *
     * @param {SabakiInput} input - L'entrée (`state`, `question?`, `from?`).
     * @returns {Promise<DecideOutput>} La décision, sa confiance et le plugin.
     * @example
     * ```ts
     * const r = await sabaki.decideAsync({ state, question: "category" });
     * if (r.confidence > 0.8) automatiser(r);
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
