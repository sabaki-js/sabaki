/**
 * Loader + cache for the semantic layer.
 *
 * The bi-encoder is opt-in (`SABAKI_BIENCODER_DIR`, or `SABAKI_SEMANTIC=1`
 * to download it via `ensureBiencoder`). Everything here fails closed: any
 * error means "no semantic hit", and the caller keeps the historical
 * fallback. No silent wrong answer is worth a missing download.
 */
import fs from "fs";
import path from "path";
import type { Sabaki } from "./index.js";
import {
	buildCandidates,
	matchSemantic,
	SEMANTIC_THRESHOLD,
	type SemanticCandidate,
	type SemanticMatch,
	type SemanticModel,
} from "./semantic.js";

let modelPromise: Promise<SemanticModel> | null = null;

const cache = new WeakMap<
	Sabaki,
	{ names: string; candidates: Promise<SemanticCandidate[]> }
>();

/**
 * Resolves the ONNX file in a directory: int8 first (shipped default),
 * then fp32 (`biencoder.onnx`) for local experiments.
 */
function onnxName(dir: string): string {
	if (process.env.SABAKI_BIENCODER_ONNX) return process.env.SABAKI_BIENCODER_ONNX;
	return fs.existsSync(path.join(dir, "biencoder_int8.onnx"))
		? "biencoder_int8.onnx"
		: "biencoder.onnx";
}

async function getModel(): Promise<SemanticModel> {
	if (!modelPromise) {
		modelPromise = (async () => {
			const { loadBiencoder } = await import("./semantic.js");
			const local = process.env.SABAKI_BIENCODER_DIR;
			if (local) return loadBiencoder(local, onnxName(local));
			if (process.env.SABAKI_SEMANTIC !== "1") {
				throw new Error("voie sémantique désactivée (SABAKI_SEMANTIC=1 pour l'activer)");
			}
			const { ensureBiencoder } = await import("./download.js");
			const dir = await ensureBiencoder();
			return loadBiencoder(dir, onnxName(dir));
		})().catch((e) => {
			modelPromise = null;
			throw e;
		});
	}
	return modelPromise;
}

/**
 * Semantic confirmation of the routed plugin's question.
 *
 * Returns `null` unless the plugin chosen by lexical routing also wins the
 * candidates' competition (`margin >= 0`) with `score >= threshold`. A
 * per-plugin threshold alone would accept "is this a scam?" as a jailbreak
 * question (0.57); the margin is what rejects it.
 *
 * @param {Sabaki} sabaki - Router holding the registered plugins.
 * @param {string} query - Free-form wording (instructions + query).
 * @param {number} [threshold] - Override `SEMANTIC_THRESHOLD` (never < 0.45).
 * @returns {Promise<SemanticMatch | null>} The confirmed question, or `null`.
 * @example
 * ```ts
 * const hit = await semanticMatch(sabaki, "ce mail est-il fiable ?");
 * if (hit?.plugin === "phishing") classify({ state, question: hit.question });
 * ```
 */
export async function semanticMatch(
	sabaki: Sabaki,
	query: string,
	threshold = Number(process.env.SABAKI_SEMANTIC_THRESHOLD ?? SEMANTIC_THRESHOLD),
): Promise<SemanticMatch | null> {
	const sem = await getModel();
	const plugins = sabaki.list();
	if (!plugins.length) return null;
	// Rebuild when the registry changed (plugin registered later).
	const names = plugins.map((p) => p.manifest.name ?? p.manifest.domain).join(",");
	const entry = cache.get(sabaki);
	let candidates: Promise<SemanticCandidate[]>;
	if (entry && entry.names === names) {
		candidates = entry.candidates;
	} else {
		candidates = buildCandidates(plugins, sem.embed);
		cache.set(sabaki, { names, candidates });
	}
	const hit = await matchSemantic(query, await candidates, sem.embed);
	if (!hit) return null;
	if (hit.score < threshold || hit.margin < 0) return null;
	return hit;
}

/** True when the layer is configured; used by `/health` and diagnostics. */
export function semanticEnabled(): boolean {
	return Boolean(process.env.SABAKI_BIENCODER_DIR || process.env.SABAKI_SEMANTIC === "1");
}
