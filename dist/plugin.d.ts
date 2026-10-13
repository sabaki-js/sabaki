import { type ModelWeights } from "./logreg.js";
import type { ClassifyOutput, PluginManifest, SabakiInput, SabakiPlugin } from "./index.js";
export interface DefinePluginOptions {
    manifest: PluginManifest;
    classify: (input: SabakiInput) => ClassifyOutput | Promise<ClassifyOutput>;
}
/** Crée un plugin à la volée, sans repo : le contrat minimal suffit. */
export declare function definePlugin(opts: DefinePluginOptions): SabakiPlugin;
/** Plugin nano générique à partir de poids TF-IDF + from optionnel. */
export declare function nanoClassifier(manifest: PluginManifest, weights: ModelWeights, opts?: {
    primary?: string;
    joinFrom?: boolean;
}): SabakiPlugin;
/** Plugin mini générique : télécharge les poids (cache) puis classifie en ONNX.
 *  Workflow = nom du dossier modèle (ex. customer_service). */
export declare function miniClassifier(manifest: PluginManifest, workflow: string, opts?: {
    primary?: string;
    version?: string;
}): Promise<SabakiPlugin & {
    classifyAsync: (input: SabakiInput) => Promise<ClassifyOutput>;
}>;
//# sourceMappingURL=plugin.d.ts.map