// Bench JS des minis (sabaki 1.0.1) sur les splits de test - parité avec les scores Python.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sabaki = await import(HERE + "/../node_modules/sabaki/dist/index.js").catch(
	async () => await import("sabaki"),
);
const { loadMini, ensureMiniModel } = sabaki;

const CFGS = ["customer_service", "invoice_processing", "security_incidents", "agent_trace_observability"];
const VERSION = process.env.MINI_VERSION ?? "v0.2.0";
const VARIANT = process.env.MINI_VARIANT ?? "int8";

for (const cfg of CFGS) {
	const te = JSON.parse(fs.readFileSync(`${HERE}/../../cache/${cfg}_test.json`, "utf8"));
	const mini = await loadMini(await ensureMiniModel(cfg, VERSION, VARIANT));
	const qs = Object.keys(JSON.parse(te[0].questions));
	let line = `${cfg}:`;
	for (const q of qs) {
		let ok = 0, n = 0;
		for (const r of te) {
			const gold = JSON.parse(r.gold)[q];
			if (gold == null) continue;
			const label = String(gold.label ?? gold.score);
			const { decision } = await mini.run(r.state, q);
			if (String(decision) === label) ok++;
			n++;
		}
		line += ` ${q}=${(ok / Math.max(n, 1)).toFixed(3)} (n=${n})`;
	}
	console.log(line);
}
