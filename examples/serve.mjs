// sabaki serve - Jev-compatible /v1/systemone subset, backed by mini ONNX
// models with nano fallback, lazy-loaded per domain.
// Usage: node examples/serve.mjs [port] - dev tool, add auth before exposing.
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sabaki = await import(HERE + "/../dist/index.js").catch(
	async () => await import(HERE + "/../node_modules/sabaki/dist/index.js").catch(
		async () => await import("sabaki"),
	),
);
const { Sabaki, loadMini, ensureMiniModel, miniClassifier, answerJev, validateJevQuestion } = sabaki;

const WF = [
	"customer_service",
	"invoice_processing",
	"security_incidents",
	"agent_trace_observability",
];
const plugins = {};
for (const wf of WF) {
	const domain = wf.replace(/_/g, "-");
	const short = domain.replace(/-observability$/, "");
	let mod = null;
	for (const cand of [`@sabaki-js/${domain}`, `@sabaki-js/plugin-${domain}`, `@sabaki-js/${short}`]) {
		try {
			mod = await import(cand);
			break;
		} catch {
			/* suivant */
		}
	}
	if (mod) plugins[wf] = { plugin: mod.default ?? mod, modelDir: mod.modelDir };
	else console.log(`plugin manquant: ${domain} (repli routage seul)`);
}

const s = new Sabaki();
const sNano = new Sabaki();
// Plugins sécurité (cross-encoders, poids bundlés) : liens relatifs
// tant que @sabaki-js/phishing-detection n'est pas sur npm.
for (const [tag, rel] of [
	["phishing", "../../plugins/plugin-phishing-detection/index.js"],
	["jailbreak", "../../plugins/plugin-jailbreak/index.js"],
]) {
	try {
		const mod = await import(new URL(rel, import.meta.url));
		const plug = mod.default ?? mod;
		s.register(plug);
		sNano.register(plug);
		console.log(`plugin sécurité: ${tag} (${plug.manifest?.domain})`);
	} catch {
		console.log(`plugin sécurité manquant: ${tag} (repli routage seul)`);
	}
}
for (const { plugin: plug, modelDir: bundled } of Object.values(plugins)) {
	// Variante mini si le workflow existe en ONNX, sinon nano tel quel.
	// Poids embarques du plugin en priorite (aucun telechargement), sinon HF.
	const wf = plug.manifest.domain;
	sNano.register(plug);
	try {
		s.register(
			await miniClassifier(plug.manifest, wf, {
				modelDir: bundled,
			}),
		);
		console.log(`spécialiste mini: ${wf}${bundled ? " (bundle)" : ""}`);
	} catch {
		s.register(plug);
		console.log(`spécialiste nano: ${wf}`);
	}
}
// Fallback generalist (core) : répond quand aucun spécialiste ne gagne.
// Dir via argv[3], sinon SABAKI_GENERALIST_DIR (explicite > env, pm2-safe).
// Routage par langue : latin -> mini (defaut prouve), non-latin -> multilingue
// (SABAKI_MULTI_DIR). Un seul serve, label du backend effectif dans `model`.
const GENERALIST_DIR = process.argv[3] ?? process.env.SABAKI_GENERALIST_DIR;
const MULTI_DIR = process.env.SABAKI_MULTI_DIR;
const { loadGeneralist: _loadGeneralist, definePlugin: _definePlugin } = sabaki;
const LATIN_FALLBACK = new Set(["de", "en", "es", "fr", "id", "it", "pt", "tr", "vi"]);
if (GENERALIST_DIR || MULTI_DIR) {
	const miniBe = GENERALIST_DIR ? _loadGeneralist(GENERALIST_DIR) : null;
	const multiBe = MULTI_DIR ? _loadGeneralist(MULTI_DIR) : null;
	const fb = _definePlugin({
		manifest: {
			name: "@sabaki-js/generalist",
			domain: "generalist",
			version: "0.1.0",
			questions: ["decision"],
			keywords: [],
		},
		classify: async (input) => {
			let be = miniBe;
			let tag = "sabaki-generalist-mini";
			try {
				const lg = sabaki.detectLanguage(input.state ?? "").lang;
				if (multiBe && !LATIN_FALLBACK.has(lg)) {
					be = multiBe;
					tag = "sabaki-generalist-multi-v8";
				}
			} catch {
				/* defaut mini */
			}
			const use = be ?? miniBe ?? multiBe;
			const r = await use.decide(input);
			return { ...r, model: tag };
		},
	});
	s.setFallback(fb);
	sNano.setFallback(fb);
	if (miniBe) miniBe.model.then((m) => console.log(`fallback mini actif (${m})`));
	if (multiBe) multiBe.model.then((m) => console.log(`fallback multi actif (${m})`));
}
const GENERALIST_MODEL =
	GENERALIST_DIR
		? await _loadGeneralist(GENERALIST_DIR).model
		: "sabaki-generalist";
const minis = {};
async function miniFor(wf) {
	if (!(wf in minis)) {
		try {
			minis[wf] = await loadMini(await ensureMiniModel(wf));
			console.log(`mini chargé: ${wf}`);
		} catch (e) {
			console.log(`mini indisponible (${wf}): ${e.message} - repli nano`);
			minis[wf] = null;
		}
	}
	return minis[wf];
}

const server = http.createServer(async (req, res) => {
	const json = (code, obj) => {
		res.writeHead(code, {
			"content-type": "application/json",
			"access-control-allow-origin": "*",
			"x-request-id": Math.random().toString(36).slice(2),
		});
		res.end(JSON.stringify(obj));
	};
	if (req.method === "OPTIONS") {
		res.writeHead(204, {
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET, POST, OPTIONS",
			"access-control-allow-headers": "content-type",
			"access-control-max-age": "86400",
		});
		res.end();
		return;
	}
	// Statique : site (/) + typedoc (/docs/). workspace: sabaki/examples -> ../../site, ../../docs
	const DOCS = path.join(HERE, "..", "..", "docs", "typedoc");
	const statics = [
		["/docs/", DOCS],
		["/", path.join(HERE, "..", "..", "sabaki-site-v3", "dist")],
	];
	if (req.method === "GET") {
		const url = new URL(req.url, "http://x");
		if (url.pathname === "/docs") {
			res.writeHead(301, { location: "/docs/" });
			res.end();
			return;
		}
		for (const [prefix, root] of statics) {
			if (url.pathname === "/" && prefix !== "/") continue;
			if (url.pathname === "/" || url.pathname.startsWith(prefix)) {
				let rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html";
				const file = path.normalize(path.join(root, rel));
				if (!file.startsWith(root)) return json(403, { error: "forbidden" });
				try {
					const st = fs.statSync(file);
					const f = st.isDirectory() ? path.join(file, "index.html") : file;
					const ext = path.extname(f).toLowerCase();
					const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" }[ext] ?? "application/octet-stream";
					res.writeHead(200, { "content-type": mime });
					fs.createReadStream(f).pipe(res);
					return;
				} catch {
					/* pas un fichier statique : routes API ci-dessous */
				}
				break;
			}
		}
	}
	if (req.method === "GET" && req.url === "/health")
		return json(200, { status: "ok", model: "sabaki-mini", cpu: os.cpus()[0]?.model ?? "unknown" });
	if (req.method === "GET" && req.url === "/v1/models")
		return json(200, { data: [{ id: "sabaki-mini" }] });
	if (req.method === "POST" && req.url === "/v1/systemone") {
		let body = "";
		for await (const c of req) body += c;
		try {
			const { state, questions, mode } = JSON.parse(body);
			const st = typeof state === "string" ? state : JSON.stringify(state ?? "");
			if (!questions || typeof questions !== "object")
				return json(422, { error: "questions requises" });
			if (mode !== undefined && mode !== "auto" && mode !== "nano" && mode !== "mini")
				return json(422, { error: "mode: auto|nano|mini" });
			// mode nano : routeur nano only ; mini : 422 si pas de mini ; auto : mini puis nano.
			const router = mode === "nano" ? sNano : s;
			const answers = {};
			const models = new Set();
			for (const [q, spec] of Object.entries(questions)) {
				const err = validateJevQuestion(spec);
				if (err) return json(422, { error: `${q}: ${err}` });
				const { answer, model } = await answerJev(router, st, q, spec, GENERALIST_MODEL);
				if (mode === "mini" && model.endsWith("+nano"))
					return json(422, { error: `${q}: mini indisponible (nano only)` });
				answers[q] = answer;
				models.add(model);
			}
			return json(200, {
				model: models.size === 1 ? [...models][0] : `sabaki-routed(${[...models].join(",")})`,
				answers,
				usage: { input_tokens: st.length >> 2, output_tokens: 0 },
			});
		} catch (e) {
			return json(400, { error: String(e.message ?? e) });
		}
	}
	return json(404, { error: "not found" });
});

const port = Number(process.argv[2] ?? 8000);
server.listen(port, () => console.log(`sabaki serve : http://localhost:${port}/v1/systemone`));
