#!/usr/bin/env bash
# Blocks commits that would leak credentials. Scans what is staged (the index).
# Usage: scripts/check-secrets.sh        (also installed as .git/hooks/pre-commit)
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
status=0

# 1) Real env files must never be tracked (only .env.example).
leaked_files="$(git diff --cached --name-only --diff-filter=ACMR | grep -E '(^|/)\.env($|\.)' | grep -v -E '(^|/)\.env\.example$' || true)"
if [ -n "$leaked_files" ]; then
  echo "BLOCKED: env file staged:"; echo "$leaked_files"; status=1
fi

# 2) Credential-looking content in staged files (values are never printed).
pattern='sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|(LLM_API_KEY|API_KEY|SECRET|PASSWORD)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9_/+=-]{24,}'
hits="$(git grep --cached -lEI "$pattern" -- . ':!package-lock.json' ':!pubspec.lock' || true)"
if [ -n "$hits" ]; then
  echo "BLOCKED: possible credential in:"; echo "$hits"
  echo "Remove it, rotate the credential if it was real, and keep it only in the untracked .env."
  status=1
fi

exit "$status"
