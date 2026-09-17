#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$HOME/.local/share/fnm:$PATH"
if command -v fnm >/dev/null 2>&1; then eval "$(fnm env --shell bash)"; fi
case "${1:-}" in
  gh) exec gh auth login --hostname github.com ;;
  claude) exec claude auth login ;;
  codex) exec codex login ;;
  *) echo 'Unknown login target' >&2; exit 2 ;;
esac
