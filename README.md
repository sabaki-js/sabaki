# module-template

Template de base pour publier rapidement un module TypeScript sur npm, avec une pile de qualité minimale (TypeScript + Biome + ESLint) et un pipeline GitHub Actions.

Ce repository n'est pas un produit fini. Il sert de point de depart a cloner/copie pour un nouveau package.

## Ce que fait ce template

- Build TypeScript vers `dist/`
- Generation des declarations `.d.ts`
- Verification statique (typecheck + lint + format)
- Publication npm via tag Git (`v*`) dans GitHub Actions
- Script local pour creer le tag/release et declencher la publication

## Structure actuelle

```text
.
├─ .github/
│  └─ workflows/
│     ├─ publish.yml
│     ├─ test-battery.yml
│     └─ create-pull-request.yml
├─ scripts/
│  └─ publish-package.sh
├─ package.json
├─ tsconfig.json
├─ biome.json
└─ eslint.config.ts
```

## Comment le template fonctionne

### 1) Build TypeScript

La configuration `tsconfig.json` est prete pour une lib TS moderne:

- entree: `src/**/*`
- sortie JS: `dist/`
- declarations: activees (`declaration`, `declarationMap`)
- mode strict active

Le script de build lance:

```bash
npm run build
```

### 2) Qualite de code

Le template fournit:

- `npm run typecheck` -> verifie les types sans emission
- `npm run check` -> controle Biome
- `npm run lint` -> lint Biome
- `npm run format` -> formatage Biome

ESLint est aussi configure (`eslint.config.ts`) avec les regles JS recommandees + TypeScript ESLint.

### 3) Packaging npm

`package.json` est configure pour publier uniquement:

- `dist`
- `README.md`
- `LICENSE`

Avant publication, `prepack` lance automatiquement le build.

### 4) Publication automatisee

Le workflow [publish.yml](.github/workflows/publish.yml) se declenche:

- sur push d'un tag `v*`
- ou manuellement (`workflow_dispatch`)

Il fait:

1. checkout
2. install
3. build
4. `npm publish`

### 5) Script de release local

Le script [scripts/publish-package.sh](scripts/publish-package.sh):

- refuse d'executer si le repo git n'est pas clean
- lit la version dans `package.json`
- cree/push le tag `v<version>`
- supprime ancien tag/release si deja present
- cree une release GitHub (si `gh` est installe)

Commande:

```bash
npm run publish-package
```

## Utilisation recommandee

1. Renommer le package et adapter la metadata dans `package.json`
2. Creer votre dossier `src/` et votre point d'entree `src/index.ts`
3. Verifier localement:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

4. Bumper la version (`npm version patch|minor|major`)
5. Publier via tag:

```bash
npm run publish-package
```

## Prerequis

- Node.js recent
- npm
- git
- optionnel: `gh` CLI pour la gestion auto des releases GitHub

## Remarques

- Le template suppose la presence d'un `src/` (a creer dans un nouveau module).
- Les workflows GitHub utilisent des secrets/protections de votre repo cible.
