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
export const DEFAULT_DOMAINS = [
	"customer_service",
	"invoice_processing",
	"security_incidents",
	"agent_trace_observability",
] as const;

/** Un des 4 workflows typed-decisions. */
export type DefaultDomain = (typeof DEFAULT_DOMAINS)[number];

/**
 * Tokenisation du routeur : minuscules, accents retirés, mots de 4+ lettres.
 * @internal
 */
function tokens(s: string): string[] {
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
export class Sabaki {
	private plugins: SabakiPlugin[] = [];

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
	register(plugin: SabakiPlugin): this {
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
	route(state: string): {
		domain: string;
		confidence: number;
		plugin: SabakiPlugin | null;
	} {
		const words = tokens(state);
		let best: { plugin: SabakiPlugin; score: number } | null = null;
		for (const p of this.plugins) {
			const kws = p.manifest.keywords.map((k) => k.toLowerCase());
			if (kws.length === 0) continue;
			const hits = kws.filter((k) =>
				words.some((w) => w.includes(k) || k.includes(w)),
			).length;
			const score = hits / kws.length;
			if (!best || score > best.score) best = { plugin: p, score };
		}
		if (
			!best ||
			best.score < (best.plugin.manifest.threshold ?? ROUTE_THRESHOLD)
		) {
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
	decide(input: SabakiInput): DecideOutput {
		const r = this.route(input.state);
		if (r.domain === "unknown" || !r.plugin) {
			return { domain: "unknown", decision: null, confidence: 0, plugin: null };
		}
		const out = r.plugin.classify(input) as ClassifyOutput;
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
	async decideAsync(input: SabakiInput): Promise<DecideOutput> {
		const r = this.route(input.state);
		if (r.domain === "unknown" || !r.plugin) {
			return { domain: "unknown", decision: null, confidence: 0, plugin: null };
		}
		const out = await r.plugin.classify(input);
		return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
	}
}
