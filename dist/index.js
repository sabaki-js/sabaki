/** Domaines par défaut : les 4 workflows du benchmark typed-decisions
 *  (LocalLLaMA/typed-decisions, celui que passent Jev, Laya, OpenDecider).
 *  Mots-clés dérivés du split train (300 états/workflow, pondération TF/DF). */
export const DEFAULT_DOMAINS = [
    "customer_service",
    "invoice_processing",
    "security_incidents",
    "agent_trace_observability",
];
function tokens(s) {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3);
}
const ROUTE_THRESHOLD = 0.15;
export { featurize, predict } from "./logreg.js";
export { encode as wordpieceEncode, loadVocab } from "./wordpiece.js";
export { loadMini } from "./mini.js";
export class Sabaki {
    plugins = [];
    register(plugin) {
        if (!plugin?.manifest?.domain || typeof plugin.classify !== "function") {
            throw new Error("plugin invalide (manifest.domain + classify requis)");
        }
        this.plugins.push(plugin);
        return this;
    }
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
        if (!best || best.score < (best.plugin.manifest.threshold ?? ROUTE_THRESHOLD)) {
            return { domain: "unknown", confidence: 0, plugin: null };
        }
        return {
            domain: best.plugin.manifest.domain,
            confidence: Math.round(best.score * 100) / 100,
            plugin: best.plugin,
        };
    }
    decide(input) {
        const r = this.route(input.state);
        if (r.domain === "unknown" || !r.plugin) {
            return { domain: "unknown", decision: null, confidence: 0, plugin: null };
        }
        const out = r.plugin.classify(input);
        return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
    }
}
