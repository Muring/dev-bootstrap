#!/usr/bin/env bash
# Invoked in a visible WSL terminal. Arguments are paths, never shell source.
set -euo pipefail
config="${1:?configuration path}"
events="${2:?events path}"
step="${3:-}"
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$(id -u)" != 0 ]] || { echo '개발 계정으로 실행하세요.'; exit 1; }
sudo -v
if ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3
fi
# Links installed in the user profile must survive moving/deleting the Windows app.
runtime="$HOME/.local/share/dev-bootstrap/runtime"
mkdir -p "$runtime"
exec 9>"$HOME/.local/share/dev-bootstrap/launch.lock"
flock -n 9 || { echo '다른 설치가 실행 중입니다.'; exit 1; }
cp -R "$source_dir/linux" "$source_dir/shared" "$source_dir/skills" "$source_dir/commands" "$source_dir/windows" "$runtime/"
args=(--config "$config" --events "$events")
if [[ -n "$step" ]]; then args+=(--step "$step"); fi
python3 "$runtime/linux/runner.py" "${args[@]}"
