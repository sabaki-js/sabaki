# Sabaki Roadmap

## Done
- Core (`Sabaki`, router, `definePlugin`, `nano/miniClassifier`, `decideAsync`) + full English JSDoc
- 5 nano plugins (0.59–0.90) + mail v0.3.1 anonymized (0.865, 0 PII)
- MiniLM fine-tunes + ONNX + int8 (22 MB, −0.004 acc) + auto-download with SHA256
- `sabaki serve` (systemone-compatible, lazy models)
- Benchmarks: nano/mini/ONNX parity/ECE/OOD, Laya-CPU disqualified (~25 s/state)
- Repos: 7 + `sabaki-models` releases v0.1.0/v0.2.0 + GUIDE.md + logo

## In progress (GPU)
- [ ] Vision Doom: oracle recording (400 eps) → SFT → eval kills/survival
- [ ] ModernBERT-base Doom eval (MiniLM plateaued at 0.57)

## Next: paths for sabaki-doom (vision defends only)
- [ ] Navigation dataset: record oracle/controller routes on MAP01-style maps
      (positions, doors, exit as **text states** — our typed format fits navigation
      better than combat: `direction`/`target`/`open_door` as choice questions)
- [ ] Train sabaki-doom-nav (MiniLM or bigger student) on route decisions
- [ ] Two-head runtime: vision policy (combat) + nav decider (routes), arbitrated
      by a simple rule (enemy visible → combat, else navigate) — same pattern
      as doomLaya's controller, but learned
- [ ] Eval: MAP01 exit rate + time, vs Laya v3 reference (61 s)

## Next: Doom teacher path (decided fallback)
- [ ] Set up doomLaya stack on GPU (ViZDoom + WADs + controller)
- [ ] Record Laya-teacher games:
  - hard labels → behavioral cloning (same SFT pipeline as oracle)
  - soft probabilities → true distillation
- [ ] Compare oracle-student vs Laya-student on kills/survival; keep the winner

## Next: product
- [ ] Publish v0.1.0 npm (`sabaki` + plugins)
- [ ] Temperature scaling (Laya-style calibration)
- [ ] Mail v0.4 only if a use case needs >0.9 (MiniLM ties TF-IDF)
- [ ] `bunkitsu` CLI / plugin hub
- [ ] Multilingual (FR train translation + Laya-multilingual teacher) if requested

## Out of scope
- Gemma-based students (license contamination of the distribution chain)
- Laya-CPU serving (disqualified on latency)
- Frozen-encoder distillation (measured worse than fine-tuning)
