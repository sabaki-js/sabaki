// sabaki — core : routage vers des plugins de décision typée. Zéro dépendance runtime.
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
export const DEFAULT_DOMAINS = [
  "customer_service",
  "invoice_processing",
  "security_incidents",
  "agent_trace_observability",
] as const;

export type DefaultDomain = (typeof DEFAULT_DOMAINS)[number];

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

const ROUTE_THRESHOLD = 0.15;

export { featurize, predict } from "./logreg.js";
export type { ModelWeights, QuestionWeights } from "./logreg.js";

export class Sabaki {
  private plugins: SabakiPlugin[] = [];

  register(plugin: SabakiPlugin): this {
    if (!plugin?.manifest?.domain || typeof plugin.classify !== "function") {
      throw new Error("plugin invalide (manifest.domain + classify requis)");
    }
    this.plugins.push(plugin);
    return this;
  }

  route(state: string): { domain: string; confidence: number; plugin: SabakiPlugin | null } {
    const words = tokens(state);
    let best: { plugin: SabakiPlugin; score: number } | null = null;
    for (const p of this.plugins) {
      const kws = p.manifest.keywords.map((k) => k.toLowerCase());
      if (kws.length === 0) continue;
      const hits = kws.filter((k) => words.some((w) => w.includes(k) || k.includes(w))).length;
      const score = hits / kws.length;
      if (!best || score > best.score) best = { plugin: p, score };
    }
    if (!best || best.score < ROUTE_THRESHOLD) {
      return { domain: "unknown", confidence: 0, plugin: null };
    }
    return {
      domain: best.plugin.manifest.domain,
      confidence: Math.round(best.score * 100) / 100,
      plugin: best.plugin,
    };
  }

  decide(input: SabakiInput): DecideOutput {
    const r = this.route(input.state);
    if (r.domain === "unknown" || !r.plugin) {
      return { domain: "unknown", decision: null, confidence: 0, plugin: null };
    }
    const out = r.plugin.classify(input);
    return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
  }
}
