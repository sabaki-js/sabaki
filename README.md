<img src="https://raw.githubusercontent.com/sabaki-js/sabaki/main/assets/logo.svg" width="120" alt="sabaki logo" />

# sabaki

[![npm](https://img.shields.io/npm/v/sabaki)](https://www.npmjs.com/package/sabaki) [![license](https://img.shields.io/npm/l/sabaki)](https://github.com/sabaki-js/sabaki#readme) [![CI](https://github.com/sabaki-js/sabaki/actions/workflows/test-battery.yml/badge.svg)](https://github.com/sabaki-js/sabaki/actions)

Lightweight typed-decision router with pluggable classifiers.

Route states to plugins (`nano` <1 ms, `mini` ONNX ~20 ms). Never guesses: unknown → null.

## Modes

| mode | weights | latency (CPU) | deps |
|---|---|---|---|
| `nano` (default) | TF-IDF, ~1 MB | <1 ms | none |
| `mini` | MiniLM ONNX int8, ~22 MB | ~20 ms | `onnxruntime-node` (optional) |

```ts
import { miniClassifier } from "sabaki";
const mini = await miniClassifier(manifest, "customer_service"); // downloads once, SHA256-verified
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

Or start from [`@sabaki-js/plugin-template`](https://github.com/sabaki-js/plugin-template).

Part of [sabaki](https://github.com/sabaki-js/sabaki) — see the [GUIDE](https://github.com/sabaki-js/sabaki/blob/main/GUIDE.md).

## License

MIT
