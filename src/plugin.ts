// Fabriques génériques de plugins : nano (poids embarqués), mini (ONNX),
// ou 100 % à la volée via definePlugin().
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

/** Crée un plugin à la volée, sans repo : le contrat minimal suffit. */
export function definePlugin(opts: DefinePluginOptions): SabakiPlugin {
  if (!opts.manifest?.domain) throw new Error("manifest.domain requis");
  return {
    manifest: opts.manifest,
    classify: (input: SabakiInput) => opts.classify(input) as ClassifyOutput,
  };
}

/** Plugin nano générique à partir de poids TF-IDF + from optionnel. */
export function nanoClassifier(
  manifest: PluginManifest,
  weights: ModelWeights,
  opts: { primary?: string; joinFrom?: boolean } = {},
): SabakiPlugin {
  const primary = opts.primary ?? manifest.primary ?? manifest.questions[0]!;
  return definePlugin({
    manifest,
    classify: (input: SabakiInput) => {
      const q = input.question && weights.questions[input.question] ? input.question : primary;
      const from = opts.joinFrom && typeof input.from === "string" ? `${input.from} ` : "";
      const r = predict(`${from}${input.state}`, weights, q);
      return { decision: r.decision, confidence: r.confidence, domain: manifest.domain };
    },
  });
}

/** Plugin mini générique : télécharge les poids (cache) puis classifie en ONNX.
 *  Workflow = nom du dossier modèle (ex. customer_service). */
export async function miniClassifier(
  manifest: PluginManifest,
  workflow: string,
  opts: { primary?: string; version?: string } = {},
): Promise<SabakiPlugin & { classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput> }> {
  const primary = opts.primary ?? manifest.primary ?? manifest.questions[0]!;
  const dir = await ensureMiniModel(workflow, opts.version);
  const mini = await loadMini(dir);
  const classifyAsync = async (input: SabakiInput): Promise<ClassifyOutput> => {
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
