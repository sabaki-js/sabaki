#!/bin/bash
# Publie sabaki + tous les plugins sur npm (public).
# Requiert : un token automation npm avec droits publish.
# Usage : NPM_TOKEN=npm_xxx ./scripts/publish-all.sh
set -euo pipefail

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "NPM_TOKEN manquant. Créez un automation token sur npmjs.com (publish sur sabaki + @sabaki-js/*)." >&2
  exit 1
fi

export NPM_CONFIG_TOKEN="$NPM_TOKEN"
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc.tmp-publish
NPMRC_BACKUP=""
if [ -f ~/.npmrc ]; then
  NPMRC_BACKUP=$(cat ~/.npmrc)
fi
cp ~/.npmrc.tmp-publish ~/.npmrc
trap 'if [ -n "$NPMRC_BACKUP" ]; then printf "%s" "$NPMRC_BACKUP" > ~/.npmrc; else rm -f ~/.npmrc; fi; rm -f ~/.npmrc.tmp-publish' EXIT

ROOT=$(cd "$(dirname "$0")/.." && pwd)
# Le core d'abord (les plugins en dépendent comme peer).
for pkg in sabaki plugin-customer-service plugin-invoice-processing plugin-security-incidents plugin-agent-trace-observability plugin-mail plugin-template; do
  dir="$ROOT/../$pkg"
  if [ ! -d "$dir" ]; then
    echo "dossier manquant: $dir (cloner les repos côte à côte)" >&2
    exit 1
  fi
  name=$(node -p "require('$dir/package.json').name")
  ver=$(node -p "require('$dir/package.json').version")
  if npm view "$name@$ver" version >/dev/null 2>&1; then
    echo "skip $name@$ver (déjà publié)"
    continue
  fi
  echo "publie $name@$ver…"
  (cd "$dir" && npm run build >/dev/null 2>&1; npm publish --access public)
done
echo "terminé."
