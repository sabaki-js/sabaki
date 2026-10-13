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
/** Valeur typée rendue par un plugin (`choice`, `score`, `noul` — ou aucune réponse). */
export type Decision = string | number | boolean | null;
export interface SabakiInput {
    /** Texte ou objet sérialisé à trancher (ticket, mail, état de jeu…). */
    state: string;
    /**
     * Nom de la question à trancher. Défaut : question principale du plugin
     * (`manifest.primary`, sinon `manifest.questions[0]`).
     */
    question?: string;
    /** Expéditeur (utilisé par le plugin `mail` : `from + state`). */
    from?: string;
    [key: string]: unknown;
}
export interface PluginManifest {
    /** Nom npm du plugin (par exemple `"@sabaki-js/plugin-mail"`). */
    name: string;
    /** Domaine routé (par exemple `"mail"`, `"customer_service"`). */
    domain: string;
    /** Version sémantique du plugin. */
    version: string;
    /** Questions typées supportées (par exemple `["bucket", "suspicious"]`). */
    questions: string[];
    /** Question répondue par défaut. Défaut : `questions[0]`. */
    primary?: string;
    /** Mots-clés de routage (voir `Sabaki.route` pour le calcul du score). */
    keywords: string[];
    /**
     * Seuil de routage (fraction de mots-clés touchés). Défaut : `0.15`.
     * Sujets courts (mails) : `0.05`. En dessous, le domaine est `"unknown"`.
     */
    threshold?: number;
    /** Modes supportés (`nano` embarqué, `mini` ONNX téléchargé). */
    modes?: Record<string, string>;
}
export interface ClassifyOutput {
    /** Décision typée (`choice`, `score`, `noul`). */
    decision: Decision;
    /** Confiance dans `[0, 1]` (probabilité calibrée en mode `mini`). */
    confidence: number;
    /** Domaine du plugin ayant décidé. */
    domain: string;
}
export interface SabakiPlugin {
    manifest: PluginManifest;
    /**
     * Tranche `input`. Peut être synchrone (nano) ou asynchrone (mini, distant) —
     * utilisez {@link Sabaki.decideAsync} dans le doute.
     */
    classify: (input: SabakiInput) => ClassifyOutput | Promise<ClassifyOutput>;
}
export interface DecideOutput extends ClassifyOutput {
    /** Nom du plugin ayant décidé (`manifest.name`), ou `null` si `unknown`. */
    plugin: string | null;
}
/**
 * Domaines par défaut : les 4 workflows du benchmark typed-decisions
 * (`LocalLLaMA/typed-decisions`, celui que passent Jev, Laya et OpenDecider).
 * Mots-clés dérivés du split train (300 états/workflow, pondération TF/DF).
 */
export declare const DEFAULT_DOMAINS: readonly ["customer_service", "invoice_processing", "security_incidents", "agent_trace_observability"];
/** Un des 4 workflows typed-decisions. */
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
 * Routeur : choisit le domaine (donc le plugin) puis délègue la décision.
 * Enregistrez les plugins avec {@link Sabaki.register}, tranchez avec
 * {@link Sabaki.decide} (synchrone) ou {@link Sabaki.decideAsync} (mini).
 */
export declare class Sabaki {
    private plugins;
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
    register(plugin: SabakiPlugin): this;
    /**
     * Choisit le domaine sans décider : fraction de mots-clés du manifest
     * retrouvés dans l'état (sens large : inclusion dans les deux sens).
     *
     * @param {string} state - L'état à router.
     * @returns Le domaine, la confiance (= le score) et le plugin, ou `unknown`.
     */
    route(state: string): {
        domain: string;
        confidence: number;
        plugin: SabakiPlugin | null;
    };
    /**
     * Route puis fait décider le plugin (chemin synchrone, mode `nano`).
     * Ne devine jamais : domaine inconnu → `decision: null`.
     *
     * @param {SabakiInput} input - L'entrée (`state`, `question?`, `from?`).
     * @returns {DecideOutput} La décision, sa confiance et le plugin.
     */
    decide(input: SabakiInput): DecideOutput;
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
    decideAsync(input: SabakiInput): Promise<DecideOutput>;
}
//# sourceMappingURL=index.d.ts.map