#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$ROOT/.githooks"

chmod +x "$HOOKS_DIR/pre-push"
git -C "$ROOT" config core.hooksPath .githooks

echo "✓ Git hooks installed (core.hooksPath=.githooks)"
echo "  pre-push: blocks push to main/master unless ALLOW_MAIN_PUSH=1"
echo "  See GIT_WORKFLOW.md"
