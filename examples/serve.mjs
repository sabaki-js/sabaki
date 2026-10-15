// sabaki serve — Jev-compatible /v1/systemone subset, backed by mini ONNX
// models with nano fallback, lazy-loaded per domain.
// Usage: node examples/serve.mjs [port] — dev tool, add auth before exposing.
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sabaki = await import(HERE + "/../node_modules/sabaki/dist/index.js").catch(
	async () => await import("sabaki"),
);
const { Sabaki, loadMini, ensureMiniModel } = sabaki;

const WF = [
	"customer_service",
	"invoice_processing",
	"security_incidents",
	"agent_trace_observability",
];
const plugins = {};
for (const wf of WF) {
	const domain = wf.replace(/_observability$/, "").replace(/_/g, "-");
	let mod = null;
	for (const cand of [`@sabaki-js/${domain}`, `@sabaki-js/plugin-${domain}`]) {
		try {
			mod = await import(cand);
			break;
		} catch {
			/* suivant */
		}
	}
	if (mod) plugins[wf] = mod.default ?? mod;
	else console.log(`plugin manquant: ${domain} (repli routage seul)`);
}

const s = new Sabaki();
for (const plug of Object.values(plugins)) s.register(plug);
// Fallback generalist (core) : répond quand aucun spécialiste ne gagne.
if (process.env.SABAKI_GENERALIST_DIR) {
	const { loadGeneralist, definePlugin } = sabaki;
	const backend = loadGeneralist(process.env.SABAKI_GENERALIST_DIR);
	s.setFallback(
		definePlugin({
			manifest: {
				name: "@sabaki-js/generalist",
				domain: "generalist",
				version: "0.1.0",
				questions: ["decision"],
				keywords: [],
			},
			classify: (input) => backend.decide(input),
		}),
	);
	console.log("fallback generalist actif");
}
const minis = {};
async function miniFor(wf) {
	if (!(wf in minis)) {
		try {
			minis[wf] = await loadMini(await ensureMiniModel(wf));
			console.log(`mini chargé: ${wf}`);
		} catch (e) {
			console.log(`mini indisponible (${wf}): ${e.message} — repli nano`);
			minis[wf] = null;
		}
	}
	return minis[wf];
}

const server = http.createServer(async (req, res) => {
	const json = (code, obj) => {
		res.writeHead(code, {
			"content-type": "application/json",
			"x-request-id": Math.random().toString(36).slice(2),
		});
		res.end(JSON.stringify(obj));
	};
	if (req.method === "GET" && req.url === "/health")
		return json(200, { status: "ok", model: "sabaki-mini" });
	if (req.method === "GET" && req.url === "/v1/models")
		return json(200, { data: [{ id: "sabaki-mini" }] });
	if (req.method === "POST" && req.url === "/v1/systemone") {
		let body = "";
		for await (const c of req) body += c;
		try {
			const { state, questions } = JSON.parse(body);
			const st = typeof state === "string" ? state : JSON.stringify(state);
			const route = s.route(st);
			const answers = {};
			for (const [q, spec] of Object.entries(questions ?? {})) {
				const type =
					spec.type === "noul" ? "noul" : spec.type === "score" ? "score" : "choice";
				// Le plugin ne connaît que ses questions entraînées : on répond avec
				// sa question primaire sous le nom demandé (comportement type Jev).
				const mini = await miniFor(route.domain);
				if (mini && route.plugin) {
					try {
						const primary =
							route.plugin.manifest.primary ?? route.plugin.manifest.questions[0];
						const r = await mini.run(st, primary);
						answers[q] =
							type === "choice"
								? {
										type,
										choice: r.decision,
										probabilities: { [r.decision]: r.confidence },
										confidence: r.confidence,
									}
								: type === "score"
									? {
											type,
											score: Number(r.decision),
											level: Number(r.decision),
											confidence: r.confidence,
										}
									: {
											type,
											noul: r.decision === "true" ? r.confidence : 1 - r.confidence,
											confidence: r.confidence,
										};
						continue;
					} catch {
						/* repli nano ci-dessous */
					}
				}
				if (route.plugin) {
					const out = route.plugin.classify({ state: st });
					answers[q] = {
						type: spec.type ?? "choice",
						choice: out.decision,
						confidence: out.confidence,
					};
				} else {
					// Fallback generalist (si configuré) ou choice null.
					const out = await s.decideAsync({
						state: st,
						question: typeof spec.query === "string" ? spec.query : q,
						options: Array.isArray(spec.options) ? spec.options : undefined,
					});
					answers[q] = { type, choice: out.decision, confidence: out.confidence };
				}
			}
			return json(200, {
				model: "sabaki-mini",
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
