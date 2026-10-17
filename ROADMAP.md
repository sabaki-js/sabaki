# Sabaki Roadmap

> Source de vérité : [`/TODO.md`](../TODO.md) (journal tenu à jour).
> Ce fichier ne garde que la direction produit.

## Fait (v1.0)
- Core `sabaki` 1.7.0 + API `/v1/systemone` servie, `Sabaki.serve()`, `abstainAt`
- Generalist **mini v1.0** (22M, served) : mix val 0.756, phishnchips R=0.616, typed-decisions 0.536
- Spécialistes nano/mini (0.61 / 0.69), mail, versions `sabaki-models` (v1.0.0 = Latest stable, reste en pre-release)
- Positionnement : pré-tri + escalade humaine (pas de résolution autonome)

## En cours
- Test d'utilité spécialistes vs generalist-mini (décide qui sert quoi)
- Routeur sémantique (si le test le justifie) ; Nano v2 (après)
- Multilingue (corpus FR d'abord, modèle ensuite)

## Parqué (avec motif)
- `generalist-plus` 144M : NO-GO (ne bat pas le 22M à budget égal) — proto `144M-proto` dispo pour comparer
- Distillation v1 : teacher trop faible (0.546 < 0.69) — à rouvrir si teacher > student
- int8 cross-encoder : dégrade (-0.13) sans accélérer — écarté
- TPU : pas de portage (2xT4 suffisent, XLA = risque sans gain prouvé)
