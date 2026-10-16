/**
 * Sabaki - core : routing to typed-decision plugins.
 *
 * Zero runtime dependencies in `nano` mode (`onnxruntime-node` is optional
 * and only loaded in `mini` mode, see {@link loadMini}).
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

/** Typed value returned by a plugin (`choice`, `score`, `noul` - or no answer). */
export type Decision = string | number | boolean | null;

export interface SabakiInput {
	/** Text or serialized object to decide on (ticket, email, game state…). */
	state: string;
	/**
	 * Name of the question to decide. Default: the plugin's primary question
	 * (`manifest.primary`, else `manifest.questions[0]`).
	 */
	question?: string;
	/** Sender (used by the `mail` plugin: `from + state`). */
	from?: string;
	[key: string]: unknown;
}

export interface PluginManifest {
	/** npm name of the plugin (e.g. `"@sabaki-js/plugin-mail"`). */
	name: string;
	/** Routed domain (e.g. `"mail"`, `"customer_service"`). */
	domain: string;
	/** Semantic version of the plugin. */
	version: string;
	/** Supported typed questions (e.g. `["bucket", "suspicious"]`). */
	questions: string[];
	/** Question answered by default. Default: `questions[0]`. */
	primary?: string;
	/** Routing keywords (see `Sabaki.route` for scoring). */
	keywords: string[];
	/**
	 * Routing threshold on `hits / sqrt(|keywords|)`. Default: `0.15`.
	 * Short subjects (emails): `0.05`. Below it, the domain is `"unknown"`.
	 */
	threshold?: number;
	/** Supported modes (`nano` bundled, `mini` downloaded ONNX). */
	modes?: Record<string, string>;
}

export interface ClassifyOutput {
	/** Typed decision (`choice`, `score`, `noul`). */
	decision: Decision;
	/** Confidence in `[0, 1]` (calibrated probability in `mini` mode). */
	confidence: number;
	/** Domain of the deciding plugin. */
	domain: string;
	/** Full option → probability map when available (Jev `probabilities`). */
	probabilities?: Record<string, number>;
}

export interface SabakiPlugin {
	manifest: PluginManifest;
	/**
	 * Decides `input`. May be sync (nano) or async (mini, remote) -
	 * use {@link Sabaki.decideAsync} when in doubt.
	 */
	classify: (input: SabakiInput) => ClassifyOutput | Promise<ClassifyOutput>;
}

export interface DecideOutput extends ClassifyOutput {
	/** Name of the deciding plugin (`manifest.name`), or `null` when `unknown`. */
	plugin: string | null;
}

/**
 * Default domains: the 4 typed-decisions benchmark workflows
 * (`LocalLLaMA/typed-decisions`, the one Jev, Laya and OpenDecider take).
 * Keywords derived from the train split (300 states/workflow, TF/DF weighting).
 */
export const DEFAULT_DOMAINS = [
	"customer_service",
	"invoice_processing",
	"security_incidents",
	"agent_trace_observability",
] as const;

/** One of the 4 typed-decisions workflows. */
export type DefaultDomain = (typeof DEFAULT_DOMAINS)[number];

/**
 * Router tokenization: lowercase, accents stripped, 4+ letter words.
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

/** Global routing threshold when the manifest sets none (see `PluginManifest.threshold`). */
const ROUTE_THRESHOLD = 0.15;

/**
 * Maps a requested question onto a plugin's native questions: exact id,
 * else `instructions`/`query` containing a native id, else primary.
 * Prevents model lookups on unknown heads (`logits_<question>`).
 */
export function mapQuestion(
	qid: string | undefined,
	instructions: string | undefined,
	native: string[],
	primary: string,
): string {
	if (qid && native.includes(qid)) return qid;
	const text = `${instructions ?? ""}`.toLowerCase();
	const hit = native.find((n) => text.includes(n.toLowerCase()));
	return hit ?? primary;
}

export { featurize, predict } from "./logreg.js";
export type { ModelWeights, QuestionWeights } from "./logreg.js";
export { encode as wordpieceEncode, loadVocab } from "./wordpiece.js";
export type { MiniVocab } from "./wordpiece.js";
export { loadMini } from "./mini.js";
export type { MiniModel } from "./mini.js";
export { loadGeneralist } from "./generalist.js";
export type { GeneralistInput } from "./generalist.js";
export { serveHttp } from "./serve.js";
export type { ServeOptions, Served } from "./serve.js";
import { serveHttp as _serveHttp, type ServeOptions, type Served } from "./serve.js";
export { answerJev, criteriaOptions, toJevAnswer, validateJevQuestion } from "./jev.js";
export type { JevAnswer, JevQuestion } from "./jev.js";
export { ensureMiniModel, ensureGeneralist, resolveVersion } from "./download.js";
export { definePlugin, miniClassifier, nanoClassifier, autoClassifier } from "./plugin.js";
export type { DefinePluginOptions } from "./plugin.js";

/**
 * Router: picks the domain (hence the plugin), then delegates the decision.
 * Register plugins with {@link Sabaki.register}, decide with
 * {@link Sabaki.decide} (sync) or {@link Sabaki.decideAsync} (mini).
 */
export class Sabaki {
	private plugins: SabakiPlugin[] = [];
	private kwsCache = new Map<SabakiPlugin, string[]>();
	/**
	 * Fallback (typically the bundled generalist): answers when no
	 * registered specialist wins routing. Only registered (= installed)
	 * specialists ever decide; the fallback never preempts them.
	 */
	private fallback: SabakiPlugin | null = null;

	/**
	 * Sets the fallback plugin (e.g. generalist cross-encoder).
	 * @param {SabakiPlugin | null} plugin - The fallback, or `null` to clear.
	 * @returns {this} The instance (chainable).
	 */
	setFallback(plugin: SabakiPlugin | null): this {
		if (plugin !== null && (!plugin?.manifest?.domain || typeof plugin.classify !== "function")) {
			throw new Error("plugin invalide (manifest.domain + classify requis)");
		}
		this.fallback = plugin;
		return this;
	}

	/**
	 * Registers a plugin (`{ manifest, classify }` object or import default).
	 *
	 * @param {SabakiPlugin} plugin - The plugin to register.
	 * @returns {this} The instance (chainable).
	 * @throws {Error} When `manifest.domain` is missing or `classify` is not a function.
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
		this.kwsCache.set(
			plugin,
			(plugin.manifest.keywords ?? []).map((k) => k.toLowerCase()),
		);
		return this;
	}

	/**
	 * Picks the domain without deciding: `hits / sqrt(|keywords|)`,
	 * hit = loose inclusion either way (`w.includes(k) || k.includes(w)`).
	 *
	 * @param {string} state - The state to route.
	 * @returns The domain, the confidence (= the score) and the plugin, or `unknown`.
	 */
	route(state: string): {
		domain: string;
		confidence: number;
		plugin: SabakiPlugin | null;
	} {
		const words = tokens(state);
		let best: { plugin: SabakiPlugin; score: number } | null = null;
		for (const p of this.plugins) {
			const kws = this.kwsCache.get(p) ?? [];
			if (kws.length === 0) {
				// Plugin catch-all (ex generalist) : route toujours, au seuil.
				const t = p.manifest.threshold ?? ROUTE_THRESHOLD;
				if (!best || t > best.score) best = { plugin: p, score: t };
				continue;
			}
			const hits = kws.filter((k) =>
				words.some((w) => w.includes(k) || k.includes(w)),
			).length;
			const score = hits / Math.sqrt(kws.length);
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
	 * Routes, then lets the plugin decide (sync path, `nano` mode).
	 * No specialist above threshold → sync fallback, else `decision: null`.
	 *
	 * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
	 * @returns {DecideOutput} The decision, its confidence and the plugin.
	 */
	decide(input: SabakiInput): DecideOutput {
		const text =
			typeof input.from === "string" && input.from ? `${input.from} ${input.state}` : input.state;
		const r = this.route(text);
		if (r.domain === "unknown" || !r.plugin) {
			if (this.fallback) {
				const out = this.fallback.classify(input) as ClassifyOutput | Promise<ClassifyOutput>;
				if (out && typeof (out as Promise<ClassifyOutput>).then !== "function") {
					const sync = out as ClassifyOutput;
					return { ...sync, domain: sync.domain, plugin: this.fallback.manifest.name };
				}
			}
			return { domain: "unknown", decision: null, confidence: 0, plugin: null };
		}
		const manifest = r.plugin.manifest;
		const native = manifest.questions;
		const question = mapQuestion(input.question, undefined, native, manifest.primary ?? native[0]!);
		const out = r.plugin.classify({ ...input, question }) as ClassifyOutput;
		return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
	}

	/**
	 * Async variant: supports `mini` (ONNX), remote and fallback plugins.
	 * Specialists win by threshold; the fallback only answers `unknown`.
	 *
	 * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
	 * @returns {Promise<DecideOutput>} The decision, its confidence and the plugin.
	 * @example
	 * ```ts
	 * const r = await sabaki.decideAsync({ state, question: "category" });
	 * if (r.confidence > 0.8) automate(r);
	 * ```
	 */
	/**
	 * Invokes the fallback directly, bypassing routing.
	 * Used when routing wins but the question isn't native
	 * (explicit `criteria` only a generalist can read).
	 *
	 * @param {SabakiInput} input - The input (kept whole: `question`, `options`).
	 * @returns {Promise<DecideOutput>} The fallback decision, or `unknown` when none.
	 */
	async decideFallback(input: SabakiInput): Promise<DecideOutput> {
		if (this.fallback) {
			const out = await this.fallback.classify(input);
			return { ...out, domain: out.domain, plugin: this.fallback.manifest.name };
		}
		return { domain: "unknown", decision: null, confidence: 0, plugin: null };
	}

	/**
	 * Async variant: supports `mini` (ONNX), remote and fallback plugins.
	 * The requested question is mapped onto the winner's native questions
	 * (exact id, else primary) - models never see unknown heads.
	 * Specialists win by threshold; `unknown` goes to the fallback.
	 *
	 * @param {SabakiInput} input - The input (`state`, `question?`, `from?`).
	 * @returns {Promise<DecideOutput>} The decision, its confidence and the plugin.
	 * @example
	 * ```ts
	 * const r = await sabaki.decideAsync({ state, question: "category" });
	 * if (r.confidence > 0.8) automate(r);
	 * ```
	 */
	async decideAsync(input: SabakiInput): Promise<DecideOutput> {
		const text =
			typeof input.from === "string" && input.from ? `${input.from} ${input.state}` : input.state;
		const r = this.route(text);
		if (r.domain === "unknown" || !r.plugin) {
			if (this.fallback) {
				const out = await this.fallback.classify(input);
				return { ...out, domain: out.domain, plugin: this.fallback.manifest.name };
			}
			return { domain: "unknown", decision: null, confidence: 0, plugin: null };
		}
		const manifest = r.plugin.manifest;
		const native = manifest.questions;
		const question = mapQuestion(input.question, undefined, native, manifest.primary ?? native[0]!);
		const out = await r.plugin.classify({ ...input, question });
		return { ...out, domain: r.domain, plugin: r.plugin.manifest.name };
	}

	/**
	 * Serves `this` router as `POST /v1/systemone` (+ `GET /health`,
	 * `GET /v1/models`) on `port` (default `8000`, `0` = ephemeral).
	 * Same path as {@link Sabaki.decideAsync}: specialists win by threshold,
	 * the fallback answers the rest.
	 *
	 * @param {ServeOptions} opts - Port and fallback model id.
	 * @returns The server URL and `close()`.
	 * @example
	 * ```ts
	 * const { url, close } = await sabaki.serve({ port: 8000 });
	 * // POST ${url}/v1/systemone {state, questions}
	 * await close();
	 * ```
	 */
	async serve(opts?: ServeOptions): Promise<Served> {
		return _serveHttp(this, opts);
	}
}
