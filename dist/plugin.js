/**
 * Fabriques génériques de plugins : `nano` (poids embarqués, <1 ms),
 * `mini` (ONNX téléchargé, ~20 ms), ou 100 % à la volée.
 */
import { predict } from "./logreg.js";
import { loadMini } from "./mini.js";
import { ensureMiniModel } from "./download.js";
/**
 * Crée un plugin à la volée, sans repo ni entraînement : le contrat minimal suffit.
 *
 * @param {DefinePluginOptions} opts - Le manifest et la fonction `classify`.
 * @returns {SabakiPlugin} Un plugin enregistrable via `Sabaki.register`.
 * @throws {Error} Si `manifest.domain` manque.
 * @example
 * ```ts
 * const ping = definePlugin({
 *   manifest: { name: "ping", domain: "ping", version: "0.1.0", questions: ["up"], keywords: ["ping"] },
 *   classify: () => ({ decision: "pong", confidence: 1, domain: "ping" }),
 * });
 * ```
 */
export function definePlugin(opts) {
    if (!opts.manifest?.domain)
        throw new Error("manifest.domain requis");
    return {
        manifest: opts.manifest,
        classify: (input) => opts.classify(input),
    };
}
/**
 * Plugin `nano` générique à partir de poids TF-IDF + LogReg embarqués
 * (voir `gpu/train.py` pour les produire : vocabulaire, idf, coefs).
 *
 * @param {PluginManifest} manifest - Le manifest (domaine, questions, mots-clés).
 * @param {ModelWeights} weights - Les poids (`vocab`, `idf`, `questions`).
 * @param {{ primary?: string; joinFrom?: boolean }} opts - `primary` surcharge
 * `manifest.primary` ; `joinFrom` préfixe l'état par `input.from` (plugin mail).
 * @returns {SabakiPlugin} Synchrone (<1 ms sur CPU).
 */
export function nanoClassifier(manifest, weights, opts = {}) {
    const primary = opts.primary ?? manifest.primary ?? manifest.questions[0];
    return definePlugin({
        manifest,
        classify: (input) => {
            const q = input.question && weights.questions[input.question]
                ? input.question
                : primary;
            const from = opts.joinFrom && typeof input.from === "string" ? `${input.from} ` : "";
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
 * Plugin `mini` générique : télécharge les poids ONNX (cache + SHA256,
 * voir {@link ensureMiniModel}) puis classifie. Utilisez `classifyAsync`
 * ou `Sabaki.decideAsync` (l'inférence est asynchrone).
 *
 * @param {PluginManifest} manifest - Le manifest (domaine, questions).
 * @param {string} workflow - Nom du modèle (par exemple `"customer_service"`).
 * @param {{ primary?: string; version?: string }} opts - Question et version
 * de release (`"v0.1.0"` par défaut).
 * @returns {Promise<SabakiPlugin>} Le plugin (avec `classifyAsync`).
 * @example
 * ```ts
 * const mini = await miniClassifier(manifest, "customer_service");
 * const r = await mini.classifyAsync({ state: ticket });
 * ```
 */
export async function miniClassifier(manifest, workflow, opts = {}) {
    const primary = opts.primary ?? manifest.primary ?? manifest.questions[0];
    const dir = await ensureMiniModel(workflow, opts.version);
    const mini = await loadMini(dir);
    const classifyAsync = async (input) => {
        const q = input.question ?? primary;
        const r = await mini.run(input.state, q);
        return {
            decision: r.decision,
            confidence: r.confidence,
            domain: manifest.domain,
        };
    };
    return {
        manifest,
        classify: () => {
            throw new Error("plugin mini : utilisez classifyAsync() (inférence asynchrone)");
        },
        classifyAsync,
    };
}
