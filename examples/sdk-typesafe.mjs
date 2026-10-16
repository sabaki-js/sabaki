// Exemple SDK officiel TypeSafe contre un serve sabaki.
// Usage: SABAKI_URL=https://sabaki.fox3000foxy.com node examples/sdk-typesafe.mjs
// (nécessite @typesafe-ai/sdk : npm i @typesafe-ai/sdk)
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";

const client = new TypeSafeClient({
	apiKey: process.env.TYPESAFE_API_KEY ?? "demo",
	baseURL: process.env.SABAKI_URL ?? "https://sabaki.fox3000foxy.com",
	compression: false,
});

const r = await client.systemOne({
	state: "I was charged twice.",
	questions: {
		dept: choice("Route?", { billing: "invoices", technical: "bugs" }),
		urgent: noul("Reply today?"),
	},
});
console.log(JSON.stringify(r.answers, null, 2));
console.log("model:", r.model);
