/**
 * Minimal Jev-compatible HTTP server over a `Sabaki` instance.
 * Zero dependencies (builtin `node:http` only).
 */
import http from "node:http";
import { answerJev, validateJevQuestion } from "./jev.js";
import type { Sabaki } from "./index.js";

export interface ServeOptions {
	/** Port to listen on (`0` = ephemeral). Default: `8000`. */
	port?: number;
	/** Model id reported when the generalist fallback answers. */
	generalistModel?: string;
}

export interface Served {
	server: http.Server;
	url: string;
	close: () => Promise<void>;
}

/**
 * Serves `this` router as `POST /v1/systemone` (+ `GET /health`,
 * `GET /v1/models`). Specialists win by threshold, the fallback answers
 * the rest — same path as {@link answerJev}.
 *
 * @returns The server, its URL, and `close()`.
 * @example
 * ```ts
 * const s = new Sabaki().register(mail).setFallback(generalist);
 * const { url, close } = await s.serve({ port: 8000 });
 * // POST ${url}/v1/systemone {state, questions}
 * await close();
 * ```
 */
export async function serveHttp(
	sabaki: Sabaki,
	opts: ServeOptions = {},
): Promise<Served> {
	const generalistModel = opts.generalistModel ?? "sabaki-generalist";
	const server = http.createServer(async (req, res) => {
		const json = (code: number, obj: unknown) => {
			res.writeHead(code, { "content-type": "application/json" });
			res.end(JSON.stringify(obj));
		};
		if (req.method === "GET" && req.url === "/health")
			return json(200, { status: "ok" });
		if (req.method === "GET" && req.url === "/v1/models")
			return json(200, { data: [{ id: generalistModel }] });
		if (req.method === "POST" && req.url === "/v1/systemone") {
			let body = "";
			for await (const c of req) body += c;
			try {
				const { state, questions } = JSON.parse(body) as {
					state?: unknown;
					questions?: Record<string, Parameters<typeof answerJev>[3]>;
				};
				const st = typeof state === "string" ? state : JSON.stringify(state ?? "");
				if (!questions || typeof questions !== "object")
					return json(422, { error: "questions requises" });
				const answers: Record<string, unknown> = {};
				const models = new Set<string>();
				for (const [q, spec] of Object.entries(questions)) {
					const err = validateJevQuestion(spec);
					if (err) return json(422, { error: `${q}: ${err}` });
					const { answer, model } = await answerJev(sabaki, st, q, spec, generalistModel);
					answers[q] = answer;
					models.add(model);
				}
				return json(200, {
					model: models.size === 1 ? [...models][0] : `sabaki-routed(${[...models].join(",")})`,
					answers,
					usage: { input_tokens: st.length >> 2, output_tokens: 0 },
				});
			} catch (e) {
				return json(400, { error: String((e as Error)?.message ?? e) });
			}
		}
		json(404, { error: "usage: POST /v1/systemone {state, questions}" });
	});
	const port = opts.port ?? 8000;
	await new Promise<void>((resolve) => server.listen(port, resolve));
	const addr = server.address();
	const actual = typeof addr === "object" && addr ? addr.port : port;
	return {
		server,
		url: `http://localhost:${actual}`,
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((e) => (e ? reject(e) : resolve())),
			),
	};
}
