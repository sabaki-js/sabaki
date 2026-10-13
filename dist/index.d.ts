export type Decision = string | number | boolean | null;
export interface SabakiInput {
    state: string;
    /** Nom de la question à trancher (défaut : question principale du plugin). */
    question?: string;
    [key: string]: unknown;
}
export interface PluginManifest {
    name: string;
    domain: string;
    version: string;
    questions: string[];
    keywords: string[];
}
export interface ClassifyOutput {
    decision: Decision;
    confidence: number;
    domain: string;
}
export interface SabakiPlugin {
    manifest: PluginManifest;
    classify: (input: SabakiInput) => ClassifyOutput;
}
export interface DecideOutput extends ClassifyOutput {
    plugin: string | null;
}
/** Domaines par défaut : les 4 workflows du benchmark typed-decisions
 *  (LocalLLaMA/typed-decisions, celui que passent Jev, Laya, OpenDecider).
 *  Mots-clés dérivés du split train (300 états/workflow, pondération TF/DF). */
export declare const DEFAULT_DOMAINS: readonly ["customer_service", "invoice_processing", "security_incidents", "agent_trace_observability"];
export type DefaultDomain = (typeof DEFAULT_DOMAINS)[number];
export { featurize, predict } from "./logreg.js";
export type { ModelWeights, QuestionWeights } from "./logreg.js";
export declare class Sabaki {
    private plugins;
    register(plugin: SabakiPlugin): this;
    route(state: string): {
        domain: string;
        confidence: number;
        plugin: SabakiPlugin | null;
    };
    decide(input: SabakiInput): DecideOutput;
}
//# sourceMappingURL=index.d.ts.map