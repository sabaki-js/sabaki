#!/bin/bash
# Publie sabaki + tous les plugins sur npm (public).
# Auth interactive : ouvre le lien affiché, autorise l'IP (5 min), reviens ici.
# Usage : ./scripts/publish-all.sh
set -euo pipefail

echo "=== 1. Authentification npm (web) ==="
echo "Ouvrez le lien ci-dessous, autorisez l'IP, puis revenez ici."
npm login --auth-type=web
echo "authentifié : $(npm whoami)"

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
