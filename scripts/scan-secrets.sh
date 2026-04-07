#!/usr/bin/env sh
set -eu

echo "pre-commit: scanning staged changes for secrets"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --staged --redact
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -v "$(pwd):/repo" \
    -w /repo \
    zricethezav/gitleaks:latest \
    git --staged --redact
  exit 0
fi

echo "gitleaks not found and docker unavailable."
echo "Install gitleaks (https://github.com/gitleaks/gitleaks) or Docker."
exit 1
