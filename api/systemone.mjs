// Vercel Node.js function: POST /api/systemone (Jev-compatible subset).
// Cold start : minis depuis les poids embarqués @sabaki-js/* (zéro download),
// generalist téléchargé une fois vers /tmp (persistant entre invocations chaudes).
// Bundling : vercel.json exclut les binaires onnxruntime non-linux-x64.
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

// Le cache (versions.json + SHA) doit vivre sous /tmp : le home est en
// lecture seule sur Vercel. Posé AVANT l'import de dist/ car src/download.ts
// fige CACHE au chargement du module.
if (!process.env.SABAKI_CACHE_DIR) process.env.SABAKI_CACHE_DIR = os.tmpdir();

const require = createRequire(import.meta.url);
// dist/ est buildé par `vercel-build` (voir package.json).
const sabaki = await import("../dist/index.js");
const { Sabaki, answerJev, validateJevQuestion } = sabaki;

// --- Router (construit une fois par isolate, réutilisé entre invocations) ---
let ready = null;

// Imports statiques : le traceur Vercel ne suit pas les import() dynamiques
// avec template literal -> les paquets @sabaki-js/* seraient exclus du bundle.
import * as csMod from "@sabaki-js/customer-service";
import * as invMod from "@sabaki-js/invoice-processing";
import * as siMod from "@sabaki-js/security-incidents";
import * as atMod from "@sabaki-js/agent-trace-observability";
import * as mailMod from "@sabaki-js/mail";

const BUNDLED = [csMod, invMod, siMod, atMod, mailMod];
// Nom du workflow = nom du dossier de poids (le manifest.domain peut différer,
// ex: plugin mail historique). Tiré du modelDir embarqué, pas du manifest.
function workflowOf(raw, plug) {
	const md = raw.modelDir ?? plug.modelDir ?? "";
	const m = md.match(/([^/]+)-int8\/?$/);
	return m?.[1] ?? plug.manifest.domain;
}

async function buildRouter() {
	const s = new Sabaki();
	const sNano = new Sabaki();
	const diag = { minis: {}, generalist: "none" };

	// Diagnostic pre-onnx : le .node natif charge-t-il dans cet env ?
	try {
		const ort = await import("onnxruntime-node").then((m) => m.default ?? m);
		diag.ort = "ok";
	} catch (e) {
		diag.ort = `FAIL: ${String(e?.message ?? e).slice(0, 200)}`;
	}

	// 4 workflows historiques + mail (poids embarqués).
	for (const raw of BUNDLED) {
		try {
			const plug = raw.default ?? raw;
			const modelDir = raw.modelDir ?? plug.modelDir;
			sNano.register(plug);
			try {
				const wf = workflowOf(raw, plug);
				// modelDir embarqué = dossier complet : loadMini direct,
				// sans repasser par ensureMiniModel (qui retéléchargerait).
				const { loadMini } = sabaki;
				const mini = await loadMini(modelDir);
				const { definePlugin } = sabaki;
				s.register(definePlugin({
					manifest: { ...plug.manifest, modes: { ...plug.manifest.modes, active: "mini" } },
					classify: async (input) => {
						const q = input.question ?? plug.manifest.primary ?? plug.manifest.questions[0];
						const r = await mini.run(input.state, q);
						return { decision: r.decision, confidence: r.confidence, domain: plug.manifest.domain };
					},
				}));
				diag.minis[plug.manifest.domain] = `mini (${wf})`;
			} catch (e) {
				s.register(plug); // repli nano (ex: onnxruntime absent)
				diag.minis[plug.manifest.domain] = `nano (${String(e?.message ?? e).slice(0, 160)})`;
			}
		} catch (e) {
			diag.minis["?"] = `skip (${String(e?.message ?? e).slice(0, 120)})`;
		}
	}

	// Fallback generalist : /tmp persistant (warm) > env > download.
	// Pas de generalist-multi sur Vercel (482 Mo) : mini latin seul.
	// (SABAKI_CACHE_DIR=/tmp est posé en tête de module, avant l'import dist/.)
	let generalistDir = process.env.SABAKI_GENERALIST_DIR;
	let generalistModel = "sabaki-generalist";
	if (!generalistDir && !process.env.SABAKI_OFFLINE) {
		try {
			// /tmp : seul writable sur Vercel (home en lecture seule).
			// Sous-dossier dédié : le /tmp Vercel peut contenir des fichiers
			// pré-existants et mkdir recursive n'y est pas garanti.
			const base = path.join(os.tmpdir(), "sabaki-models");
			try {
				await import("node:fs/promises").then((fs) => fs.mkdir(base, { recursive: true }));
			} catch {
				/* existe déjà */
			}
			const dir = path.join(base, "generalist");
			generalistDir = await sabaki.ensureGeneralist(undefined, "generalist", { dir });
			diag.generalist = `downloaded: ${generalistDir}`;
		} catch (e) {
			generalistDir = undefined; // offline ou réseau HS : pas de fallback
			diag.generalist = `download FAIL: ${String(e?.message ?? e).slice(0, 200)}`;
		}
	} else if (generalistDir) {
		diag.generalist = `env: ${generalistDir}`;
	}
	if (generalistDir) {
		try {
			const be = sabaki.loadGeneralist(generalistDir);
			generalistModel = await be.model;
			const fb = sabaki.definePlugin({
				manifest: {
					name: "@sabaki-js/generalist",
					domain: "generalist",
					version: "0.1.0",
					questions: ["decision"],
					keywords: [],
				},
				classify: (input) => be.decide(input),
			});
			s.setFallback(fb);
			sNano.setFallback(fb);
			diag.generalist += " + loaded";
		} catch (e) {
			diag.generalist += ` / load FAIL: ${String(e?.message ?? e).slice(0, 200)}`;
		}
	}
	console.log(`[sabaki] router ready ${JSON.stringify(diag).slice(0, 2000)}`);
	return { s, sNano, generalistModel, diag };
}

function getRouter() {
	if (!ready) ready = buildRouter();
	return ready;
}

// --- Handler Vercel (Node.js runtime) ---
export default async function handler(req, res) {
	res.setHeader("access-control-allow-origin", "*");
	if (req.method === "OPTIONS") {
		res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
		res.setHeader("access-control-allow-headers", "content-type");
		res.status(204).end();
		return;
	}
	if (req.method === "GET") {
		// ?debug=1 : état du router (minis chargés ? generalist ? ort ?) — pas de secret.
		// ?diag=1 (POST aussi) : idem dans la réponse.
		try {
			const u = new URL(req.url ?? "/", "http://x");
			if (u.searchParams.get("debug") === "1") {
				const r = await getRouter();
				res.status(200).json({ status: "ok", diag: r.diag, generalistModel: r.generalistModel });
				return;
			}
		} catch { /* ignore, health ci-dessous */ }
		res.status(200).json({ status: "ok" });
		return;
	}
	if (req.method !== "POST") {
		res.status(404).json({ error: "usage: POST /api/systemone {state, questions}" });
		return;
	}
	let body = req.body;
	if (typeof body === "string") {
		try {
			body = JSON.parse(body);
		} catch {
			res.status(400).json({ error: "JSON invalide" });
			return;
		}
	}
	try {
		const { state, questions, mode } = body ?? {};
		const st = typeof state === "string" ? state : JSON.stringify(state ?? "");
		if (!questions || typeof questions !== "object") {
			res.status(422).json({ error: "questions requises" });
			return;
		}
		if (mode !== undefined && mode !== "auto" && mode !== "nano" && mode !== "mini") {
			res.status(422).json({ error: "mode: auto|nano|mini" });
			return;
		}
		const { s, sNano, generalistModel, diag } = await getRouter();
		const router = mode === "nano" ? sNano : s;
		const answers = {};
		const models = new Set();
		const t0 = Date.now();
		for (const [q, spec] of Object.entries(questions)) {
			const err = validateJevQuestion(spec);
			if (err) {
				res.status(422).json({ error: `${q}: ${err}` });
				return;
			}
			const { answer, model } = await answerJev(router, st, q, spec, generalistModel);
			if (mode === "mini" && model.endsWith("+nano")) {
				res.status(422).json({ error: `${q}: mini indisponible (nano only)` });
				return;
			}
			answers[q] = answer;
			models.add(model);
		}
		res.status(200).json({
			model: models.size === 1 ? [...models][0] : `sabaki-routed(${[...models].join(",")})`,
			answers,
			usage: { input_tokens: st.length >> 2, output_tokens: 0, latency_ms: Date.now() - t0 },
			diag,
		});
	} catch (e) {
		res.status(400).json({ error: String(e?.message ?? e) });
	}
}
