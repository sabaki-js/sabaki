// Vercel Node.js function: POST /api/systemone (Jev-compatible subset).
// Cold start : minis depuis les poids embarqués @sabaki-js/* (zéro download),
// generalist téléchargé une fois vers /tmp (persistant entre invocations chaudes).
// Bundling : vercel.json exclut les binaires onnxruntime non-linux-x64.
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// dist/ est buildé par `vercel-build` (voir package.json).
const sabaki = await import("../dist/index.js");
const { Sabaki, miniClassifier, answerJev, validateJevQuestion } = sabaki;

// --- Router (construit une fois par isolate, réutilisé entre invocations) ---
let ready = null;

// Imports statiques : le traceur Vercel ne suit pas les import() dynamiques
// avec template literal -> les paquets @sabaki-js/* seraient exclus du bundle.
import csPkg from "@sabaki-js/customer-service";
import invPkg from "@sabaki-js/invoice-processing";
import siPkg from "@sabaki-js/security-incidents";
import atPkg from "@sabaki-js/agent-trace-observability";
import mailPkg from "@sabaki-js/mail";

const BUNDLED = [csPkg, invPkg, siPkg, atPkg, mailPkg];

async function buildRouter() {
	const s = new Sabaki();
	const sNano = new Sabaki();

	// 4 workflows historiques + mail (poids embarqués).
	for (const raw of BUNDLED) {
		try {
			const plug = raw.default ?? raw;
			const modelDir = raw.modelDir ?? plug.modelDir;
			sNano.register(plug);
			try {
				s.register(await miniClassifier(plug.manifest, plug.manifest.domain, { modelDir }));
			} catch {
				s.register(plug); // repli nano (ex: onnxruntime absent)
			}
		} catch {
			/* paquet optionnel absent : routage seul */
		}
	}

	// Fallback generalist : /tmp persistant (warm) > env > download.
	// Pas de generalist-multi sur Vercel (482 Mo) : mini latin seul.
	let generalistDir = process.env.SABAKI_GENERALIST_DIR;
	let generalistModel = "sabaki-generalist";
	if (!generalistDir && !process.env.SABAKI_OFFLINE) {
		try {
			const dir = path.join(os.tmpdir(), "sabaki-models", "generalist");
			generalistDir = await sabaki.ensureGeneralist(undefined, "generalist", { dir });
		} catch {
			generalistDir = undefined; // offline ou réseau HS : pas de fallback
		}
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
		} catch {
			/* onnxruntime absent : pas de fallback */
		}
	}
	return { s, sNano, generalistModel };
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
		const { s, sNano, generalistModel } = await getRouter();
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
		});
	} catch (e) {
		res.status(400).json({ error: String(e?.message ?? e) });
	}
}
