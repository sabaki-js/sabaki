# Prototype : plugin Sabaki en WebAssembly

Branche `proto/wasm-plugins`. Objectif : valider l'ABI et les proprietes de
specification avant de decider si les plugins npm doivent un jour exposer du wasm.

## Ce qui est verifie

| Niveau | Verification | Ou |
|---|---|---|
| Binaire | magic wasm, version | `readWasmSpec` |
| Marqueur | section custom `sabaki` : `SABK` + spec + ABI | `readWasmSpec` |
| Exports | 5 fonctions + `memory` | `loadWasmPlugin` |
| Manifest | `spec`, `name`, `domain`, `version`, `questions`, `keywords`, `primary` | `loadWasmPlugin` |
| Sortie | decision dans les options, confiance dans [0,1], domaine, probabilites de somme ~1 | `loadWasmPlugin` |

Un module sans section `sabaki`, avec une version inconnue ou une sortie
incoherente est rejete **avant** de router quoi que ce soit.

## ABI v1

Buffers statiques de 64 Kio, pas d'allocateur expose.

```text
sabaki_abi() -> i32                 // 1
sabaki_manifest() -> i32            // [u32 len][utf8 json]
sabaki_input() -> i32               // buffer d'entree
sabaki_input_capacity() -> i32
sabaki_classify(len: i32) -> i32    // lit l'entree, ecrit [u32 len][utf8 json]
```

Entree (little-endian) :

```text
u32 stateLen,  state utf8
u32 qLen,      question utf8
u32 nOptions,  nOptions x (u32 len, option utf8)
```

Sortie : JSON `{decision, confidence, domain, probabilities?}`.

## Marqueur

Section custom ajoutee au build par `scripts/append-section.mjs` :

```text
"SABK" | u16 spec=1 | u16 abi=1
```

Elle est lisible sans instancier le module, donc utilisable pour refuser un
plugin avant meme de l'allouer.

## Build

```bash
cd proto/wasm-plugin
npm install
npm run build           # -> build/proto-plugin.wasm
```

Puis copier le binaire dans `tests/fixtures/` (le test ne depend pas du
toolchain AssemblyScript).

## Limites connues

- AssemblyScript est ici un moyen rapide de compiler ; l'ABI est
  volontairement independant du langage (Rust/C/Zig peuvent l'implementer).
- Les buffers sont statiques : 64 Kio suffisent pour des chaines et des
  options, pas pour un modele. Un vrai plugin `mini` fournirait ses poids
  par un buffer separe, pas en section de donnees.
- Dans un Worker, `WebAssembly.compile()` est bloque : un plugin wasm doit
  etre precompile au deploiement, ou charge via le loader de Workers for
  Platforms. Le prototype tourne sur Node/Bun et dans le navigateur.
- Un plugin wasm est independant du langage **de programmation**. Cela ne
  change rien aux langues **naturelles** : c'est le tokenizer et le modele
  qui les couvrent, pas le format du binaire.
