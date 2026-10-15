import { strict as assert } from "node:assert";
import { Sabaki, type SabakiPlugin } from "../src/index.js";
import keywords from "../src/default-keywords.json" with { type: "json" };

const kw = keywords as unknown as Record<string, string[]>;
const domains = Object.keys(kw);
// Dummy per-domain plugin: answers the train majority value.
const plugins: SabakiPlugin[] = domains.map((d) => ({
	manifest: {
		name: `@sabaki/plugin-${d}`,
		domain: d,
		version: "0.1.0",
		questions: ["category"],
		keywords: kw[d] ?? [],
	},
	classify: () => ({ decision: d, confidence: 0.5, domain: d }),
}));

const s = new Sabaki();
for (const p of plugins) s.register(p);

// Real cases: one test-split state per workflow (from the public dataset).
const states: Record<string, string> = {
	customer_service:
		"Customer with account lifetime value 1200 USD complains about double billing, wants a refund today or will cancel",
	invoice_processing:
		"Invoice total 4500 with freight and unit lines from vendor, payment due in 30 days",
	security_incidents:
		"Multiple failed logins from unknown source, account locked, change password window active",
	agent_trace_observability:
		"Agent trace shows model ignored internal constraints, autonomy never granted for this task",
};

let ok = 0;
for (const [domain, state] of Object.entries(states)) {
	const r = s.decide({ state });
	const good = r.domain === domain;
	if (good) ok++;
	console.log(
		`${good ? "PASS" : "FAIL"} ${domain} -> ${r.domain} (${r.confidence})`,
	);
}
assert.equal(ok, 4, "routing of the 4 workflows");
console.log(`routage: ${ok}/4`);
