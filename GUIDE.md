# Sabaki Guide

Sabaki is a lightweight **typed-decision** router with pluggable classifiers.
Instead of generating text, it answers typed questions - `choice`, `score`,
yes/no - with a calibrated probability, in milliseconds on a CPU.

```ts
import { Sabaki } from "sabaki";
import mail from "@sabaki-js/mail";

const sabaki = new Sabaki().register(mail);
sabaki.decide({ state: "N'oubliez pas de terminer Lupin", from: "Netflix" });
// { domain: "mail", decision: "promotions", confidence: 0.71, plugin: "@sabaki-js/mail" }
```

It never guesses: unknown domain → `{ domain: "unknown", decision: null }`.

## 1. Concepts

- **Core** (`sabaki`): a TF-IDF router. It picks the domain (hence the plugin)
  by keyword overlap, then delegates the decision. Zero runtime dependencies
  in `nano` mode.
- **Plugin** (`@sabaki-js/*`): a `manifest.json` (domain, questions, keywords,
  thresholds) plus a `classify()` function. Three flavors (see below).
- **Modes**: `nano` (bundled TF-IDF weights, kilobytes, <1 ms),
  `mini` (downloaded MiniLM ONNX, ~22 MB int8, ~20 ms),
  `base` (in evaluation - larger students for hard tasks).

This is a Mixture-of-Experts at system level: one sparse router, independent
experts, a single active expert per input. Experts train separately, version
separately, and ship separately - at the cost of a coarser gate than a
jointly-trained MoE.

## 2. Modes in detail

| mode | weights | latency (desktop CPU) | deps | accuracy* |
|---|---|---|---|---|
| `nano` | TF-IDF + LogReg, 20–650 KB | <1 ms | none | 0.59–0.90/question |
| `mini` | MiniLM-L6 ONNX int8, ~22 MB | ~10–25 ms | `onnxruntime-node` (optional) | mean ~0.64, ECE < 0.14 |
| `base` | under evaluation (Gemma-270M) | TBD | TBD | TBD |

\* Honest held-out numbers, see §5.

`nano` is pure TypeScript with exact sklearn parity (verified on 20 questions).
`mini` needs a WordPiece runtime (bundled, exact Hugging Face parity) and
downloads weights on first use from the public `sabaki-models` releases
(SHA256-verified, cached in `~/.cache/sabaki`).

## 3. Training a `nano` plugin

Same recipe for every plugin (`train.py` pattern):

1. Collect `(state, gold label)` pairs - public datasets, Gmail labels,
   or a Takeout mbox export (labels preserved in `X-Gmail-Labels`).
2. Deterministic split (every 5th item → test), stratified across time -
   training on the first-N items only creates temporal bias (measured:
   0.93 in-split vs 0.52 out-of-split on email).
3. `TfidfVectorizer` (uni+bigrams, 3000–6000 features, sublinear TF) +
   `LogisticRegression`. Round coefs to 1e-4 (no measured loss).
4. Export `{ vocab, idf, questions: { classes, coef, intercept } }` JSON.
5. Evaluate accuracy + ECE on the held-out split; ship the numbers in the README.

Privacy: anonymize before training (names, emails, phones → placeholders).
Verified cost on email: −0.024 accuracy for zero personal terms in a 6000-word
vocabulary. Private training data must never reach public releases -
audit vocabularies with stem-substring matching (bare display names slip
through compound-only filters; `FOX` ≠ `fox3000foxy`).

## 4. Training a `mini` plugin

1. Fine-tune MiniLM-L6 end-to-end, one multi-task model per domain
   (shared encoder, one linear head per question), 8–12 epochs, lr 2e-5,
   on a CUDA GPU machine. Frozen encoder + MLP heads underperforms
   fine-tuning everywhere we measured (0.65 vs 0.68).
2. Keep best-epoch checkpoints (`best.pt`) plus resumable `last.pt`.
3. Export ONNX (dynamo), verify exact parity, measure accuracy + ECE.
4. Dynamic int8 quantization: 90 → 22 MB, −0.004 accuracy on our referee
   (`customer_service`), ECE unchanged or better. Always re-measure.
5. Distillation from a 400M teacher into frozen embeddings was tried and
   dropped (worse than fine-tuning on gold labels).

Calibration: minilaya models show healthy doubt on out-of-distribution
inputs (0.2–0.5 confidence on dragons, recipes and empty strings) - the
property that makes "automate above 0.8" safe. Temperature scaling is
planned (see Laya's `fit_temperature_map`).

## 5. Benchmarks

Typed-decisions (`LocalLLaMA/typed-decisions`, the benchmark Jev, Laya and
OpenDecider take - 300 train / 100 test per workflow):

| workflow | primary question | nano | mini |
|---|---|---|---|
| customer_service | category | 0.900 | 0.91 |
| invoice_processing | duplicate | 0.890 | 0.89 |
| security_incidents | disposition | 0.730 | 0.76 |
| agent_trace | needs_review | 0.590 | 0.82 |

Reference points (published, not re-measured): OpenDecider-nano 0.796,
TypeSafe Jev ~0.75, Laya typed-decisions 0.766. A 421M Laya ONNX port was
evaluated for CPU use and disqualified on latency (~25 s/state on desktop CPU).

Email (Takeout corpus, 4 126 mails, 8 buckets): nano 0.889 test / 0.769
end-to-end with routing; MiniLM ties TF-IDF (±0.02), so nano ships.

Doom (doomLaya v3 states, 7 categories): MiniLM and ModernBERT-base plateau
at ~0.57 - text states lose spatial information. Vision+RL approaches
(tiny-doom-defender: 1.1M params from pixels) are the credible path to a
real player; text classification stays an honest baseline.

## 5b. Drift (batch effects) and calibration protocol

Typed-decisions is synthetically generated in batches, and its temporal
split is effectively a **batch split**: `drift_tool.py` measures
train-vs-test separability (customer_service 0.82, agent_trace 0.67 —
0.5 means indistinguishable). Label drift is small; vocabulary style
shifts (`please` 0.46→0.24).

Consequences, all verified:
- Published weights score **0.733 mean on a mixed test** vs 0.61 on the
  official split: the models are robust, the official number is conservative.
- A reshuffled retrain scores **worse**: do not retrain, do not resplit.
- Calibration (Platt, temperature+bias, 5-fold + refits + recency
  reweighting) does **not** transfer across batches: ECE degrades almost
  everywhere. Ship temperature scaling only; calibrate on recent batches.

Rule for new corpora: run `drift_tool.py` first (warn > 0.6, block > 0.8).

## 6. Serving (`systemone`-compatible)

`sabaki serve` speaks a Jev-compatible `/v1/systemone` subset
(`POST /v1/systemone`, `GET /health`, `GET /v1/models`), routing to mini
models with nano fallback, lazy-loaded per domain (~0.5 GB RAM for one
domain instead of ~2 GB for four). Development use; add auth before exposing.

## 7. Writing a plugin

Start from `@sabaki-js/plugin-template`. Minimal contract:

```ts
import { definePlugin } from "sabaki";
export default definePlugin({
  manifest: { name, domain, version, questions, primary, keywords, threshold },
  classify: ({ state }) => ({ decision, confidence, domain }),
});
```

- `threshold`: fraction of matched keywords below which the router says
  `unknown` (default 0.15; short subjects need ~0.03–0.05).
- Routing score is hits normalized by √keywords, so rich keyword lists
  are not penalized.
- `question` selects among `manifest.questions`; `primary` is the default.
- `decideAsync` supports async (mini/remote) plugins.
