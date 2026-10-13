// Fabriques génériques de plugins : nano (poids embarqués), mini (ONNX),
// ou 100 % à la volée via definePlugin().
import { predict } from "./logreg.js";
import { loadMini } from "./mini.js";
import { ensureMiniModel } from "./download.js";
/** Crée un plugin à la volée, sans repo : le contrat minimal suffit. */
export function definePlugin(opts) {
    if (!opts.manifest?.domain)
        throw new Error("manifest.domain requis");
    return {
        manifest: opts.manifest,
        classify: (input) => opts.classify(input),
    };
}
/** Plugin nano générique à partir de poids TF-IDF + from optionnel. */
export function nanoClassifier(manifest, weights, opts = {}) {
    const primary = opts.primary ?? manifest.primary ?? manifest.questions[0];
    return definePlugin({
        manifest,
        classify: (input) => {
            const q = input.question && weights.questions[input.question] ? input.question : primary;
            const from = opts.joinFrom && typeof input.from === "string" ? `${input.from} ` : "";
            const r = predict(`${from}${input.state}`, weights, q);
            return { decision: r.decision, confidence: r.confidence, domain: manifest.domain };
        },
    });
}
/** Plugin mini générique : télécharge les poids (cache) puis classifie en ONNX.
 *  Workflow = nom du dossier modèle (ex. customer_service). */
export async function miniClassifier(manifest, workflow, opts = {}) {
    const primary = opts.primary ?? manifest.primary ?? manifest.questions[0];
    const dir = await ensureMiniModel(workflow, opts.version);
    const mini = await loadMini(dir);
    const classifyAsync = async (input) => {
        const q = input.question ?? primary;
        const r = await mini.run(input.state, q);
        return { decision: r.decision, confidence: r.confidence, domain: manifest.domain };
    };
    return {
        manifest,
        classify: () => {
            throw new Error("plugin mini : utilisez classifyAsync() (inférence asynchrone)");
        },
        classifyAsync,
    };
}
