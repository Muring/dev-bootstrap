#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  if [[ ! -t 0 ]]; then echo 'Python 3 필요: sudo apt-get install -y python3' >&2; exit 1; fi
  sudo apt-get update
  sudo apt-get install -y python3
fi
exec python3 "$ROOT/runner.py" "$@"
