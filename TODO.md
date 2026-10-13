# TODO sabaki

## Court terme
- [x] Distillation `mini` : fine-tune > gelé+MLP (0,68 vs 0,65) — voie gelée abandonnée
- [x] Mode `mini` ONNX câblé (wordpiece TS + onnxruntime-node, 17-26ms) + téléchargement auto depuis Releases
- [x] Bench bout-en-bout core+5 plugins (0,59-0,90) + calibration ONNX (ECE<0,14, doute OOD sain)
- [ ] Publier `sabaki` v0.1.0 + 4 plugins sur npm
- [x] Plugin `@sabaki-js/mail` v0.2.0 (162 mails, bucket 0,848, suspicious expérimental)
- [ ] Mail v0.3 : corpus Takeout mbox (export Google en cours)

## Moyen terme (minilaya)
- [x] Fine-tune MiniLM multi-tâches (moy 0,68, agent_trace 0,42->0,73)
- [ ] Temperature scaling (calibration à la Laya)
- [ ] Étudiant ModernBERT-base : typed-decisions (Doom plafonne à 0,57)
- [x] Export ONNX + WordPiece TS + onnxruntime-node
- [ ] Quantification int8 (~87->~22 Mo/modèle)
- [ ] Calibration (ECE) à la Laya/RLCD (version légère : temperature scaling)

## Fun / long terme
- [ ] Plugin `@sabaki-js/doom` inspiré de `azalio/doomLaya` (baseline MiniLM 0,57, ModernBERT en test) : état texte + questions `command`/`weapon`, contrôleur d'exécution ; interface `Sabaki.decide()` déjà compatible (décision typée → action)
- [ ] Brancher `bunkitsu` (CLI / hub de plugins)
- [ ] LDA : outil de découverte pour corpus non étiquetés (testé sur mails : pureté insuffisante vs labels Gmail)
- [ ] Benchmarker receptron/laya (portage ONNX) sur CPU : précision/latence vs sabaki nano/mini
