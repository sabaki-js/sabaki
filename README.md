# sabaki

Lightweight typed-decision router with pluggable classifiers. Zero runtime dependencies in `nano` mode.

![sabaki logo](assets/logo.svg)

Give it a state (ticket, email, game snapshot — text or JSON) and it routes to the right plugin, which answers with a **typed decision + confidence** instead of generated text:

```ts
import { Sabaki } from "sabaki";
import mail from "@sabaki-js/mail";

const sabaki = new Sabaki().register(mail);
sabaki.decide({ state: "N'oubliez pas de terminer Lupin", from: "Netflix <info@members.netflix.com>" });
// { domain: "mail", decision: "promotions", confidence: 0.71, plugin: "@sabaki-js/mail" }
```

Never guesses: unknown domain → `{ domain: "unknown", decision: null }`.

## Modes

| mode | weights | latency (CPU) | deps |
|---|---|---|---|
| `nano` (default) | bundled TF-IDF (~1 MB), <1 ms | <1 ms | none |
| `mini` | downloaded ONNX MiniLM (~87 MB, cached + SHA256) | ~20 ms | `onnxruntime-node` (optional) |

```ts
import { miniClassifier } from "sabaki";
const mini = await miniClassifier(manifest, "customer_service"); // downloads once
await sabaki.decideAsync({ state }); // async path for mini/remote plugins
```

## Create a plugin

```ts
import { definePlugin } from "sabaki";
const ping = definePlugin({
  manifest: { name: "ping", domain: "ping", version: "0.1.0", questions: ["up"], keywords: ["ping"] },
  classify: () => ({ decision: "pong", confidence: 1, domain: "ping" }),
});
```

Or start from [`@sabaki-js/plugin-template`](https://github.com/sabaki-js/plugin-template)
(`nanoClassifier` for trained weights, `miniClassifier` for ONNX).

## Benchmarks (honest numbers, held-out test sets)

| plugin | question | accuracy |
|---|---|---|
| customer-service | category | 0.900 |
| invoice-processing | duplicate | 0.890 |
| security-incidents | disposition | 0.730 |
| agent-trace | needs_review | 0.590 |
| mail | bucket | 0.848 |

ONNX `mini` models: ECE < 0.14, healthy doubt on out-of-distribution inputs.
See [`bench/`](https://github.com/fox3000foxy/sabaki) history and `TODO.md` for the roadmap
(ModernBERT student, int8 quantization, npm publish).

## License

MIT
