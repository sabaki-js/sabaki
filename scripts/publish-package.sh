#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this command must run inside a git repository."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash your changes first."
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

if [[ -z "${VERSION}" ]]; then
  echo "Error: package.json version is empty."
  exit 1
fi

git fetch --tags --quiet

TAG_EXISTS_LOCAL="false"
TAG_EXISTS_REMOTE="false"

if git rev-parse --verify --quiet "refs/tags/${TAG}" >/dev/null; then
  TAG_EXISTS_LOCAL="true"
fi

if git ls-remote --tags origin "refs/tags/${TAG}" | grep -q .; then
  TAG_EXISTS_REMOTE="true"
fi

if [[ "${TAG_EXISTS_LOCAL}" == "true" || "${TAG_EXISTS_REMOTE}" == "true" ]]; then
  echo "Tag ${TAG} already exists. Deleting existing release/tag before republishing."

  if command -v gh >/dev/null 2>&1; then
    if gh release view "${TAG}" >/dev/null 2>&1; then
      gh release delete "${TAG}" --yes
      echo "GitHub release ${TAG} deleted."
    fi
  else
    echo "gh CLI not found; skipping GitHub release deletion."
  fi

  if [[ "${TAG_EXISTS_LOCAL}" == "true" ]]; then
    git tag -d "${TAG}" >/dev/null
    echo "Local tag ${TAG} deleted."
  fi

  if [[ "${TAG_EXISTS_REMOTE}" == "true" ]]; then
    git push --delete origin "${TAG}" >/dev/null
    echo "Remote tag ${TAG} deleted."
  fi
fi

git tag -a "${TAG}" -m "Release ${TAG}"
git push origin "${TAG}"

echo "Tag ${TAG} pushed."

if command -v gh >/dev/null 2>&1; then
  gh release create "${TAG}" --title "${TAG}" --generate-notes
  echo "GitHub release ${TAG} created."
else
  echo "gh CLI not found; skipping GitHub release creation."
fi

echo "Done. The publish workflow should run from tag ${TAG}."
