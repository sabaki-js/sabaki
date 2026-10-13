# TODO sabaki

## Court terme
- [x] Distillation `mini` : fine-tune > gelé+MLP (0,68 vs 0,65) — voie gelée abandonnée
- [x] Mode `mini` ONNX câblé (wordpiece TS + onnxruntime-node, 17-26ms) + téléchargement auto depuis Releases
- [x] Bench bout-en-bout core+5 plugins (0,59-0,90) + calibration ONNX (ECE<0,14, doute OOD sain)
- [ ] Publier `sabaki` v0.1.0 + 4 plugins sur npm
- [x] Plugin `@sabaki-js/mail` v0.2.0 (162 mails, bucket 0,848, suspicious expérimental)
- [x] Mail v0.3 : corpus Takeout (4 126 mails, 8 buckets, 0,889 test / 0,769 e2e) — poussé
- [ ] Mail v0.4 : minilaya-mail (fine-tune) si besoin de dépasser 0,9

## Moyen terme (minilaya)
- [x] Fine-tune MiniLM multi-tâches (moy 0,68, agent_trace 0,42->0,73)
- [ ] Temperature scaling (calibration à la Laya)
- [ ] Étudiant ModernBERT-base : typed-decisions (Doom plafonne à 0,57)
- [x] Export ONNX + WordPiece TS + onnxruntime-node
- [ ] Quantification int8 (~87->~22 Mo/modèle)
- [ ] Calibration (ECE) à la Laya/RLCD (version légère : temperature scaling)

## Fun / long terme
- [ ] Plugin `@sabaki-js/doom` : finir (repo créé) — nav MiniLM v2 (3/6 match, DAgger en cours),
      tête vision SFT (22,6 kills), assemblage two-head en test, vidéos avec overlay
- [ ] Corpus `sabaki-general` : typed-decisions + NLI (MNLI/SNLI/ChaosNLI en noul/choice)
      + synthétique labellisé par consensus de profs — dataset HF privé puis public
- [ ] Distillation Laya (licence Apache-2.0 OK, contrairement à Gemma) : Laya-multilingual
      comme prof FR + Laya-td comme prof workflows, vers MiniLM puis `base` (baseline MiniLM 0,57, ModernBERT en test) : état texte + questions `command`/`weapon`, contrôleur d'exécution ; interface `Sabaki.decide()` déjà compatible (décision typée → action)
- [ ] Brancher `bunkitsu` (CLI / hub de plugins)
- [ ] LDA : outil de découverte pour corpus non étiquetés (testé sur mails : pureté insuffisante vs labels Gmail)
- [ ] Benchmarker receptron/laya (portage ONNX) sur CPU : précision/latence vs sabaki nano/mini
