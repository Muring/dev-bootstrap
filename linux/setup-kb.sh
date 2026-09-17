#!/usr/bin/env bash
# Called by setup.sh; also usable after GitHub login without reinstalling tools.
set -euo pipefail
KB_DIR="${MURING_KB_DIR:-$HOME/dev/muring-kb}"
KB_REPO="${MURING_KB_REPO:-https://github.com/Muring/muring-kb.git}"
export PATH="$HOME/.local/bin:$PATH"

fail() { printf 'MuRing-KB 미완료: %s\n' "$1" >&2; exit 1; }
for tool in git python3; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool 필요 — linux/setup.sh 를 먼저 실행한다."
done

if [ -e "$KB_DIR" ] || [ -L "$KB_DIR" ]; then
  # Refuse an unrelated directory, including a directory inside another repository.
  [ -e "$KB_DIR/.git" ] || fail "$KB_DIR 는 Git checkout이 아니다. MURING_KB_DIR 를 확인한다."
  origin=$(git -C "$KB_DIR" remote get-url origin) || fail "KB origin 확인 실패"
  if [ "$origin" != "$KB_REPO" ]; then
    case "$KB_REPO|$origin" in
      'https://github.com/Muring/muring-kb.git|git@github.com:Muring/muring-kb.git') ;;
      *) fail "기존 저장소 origin이 다르다. MURING_KB_DIR/MURING_KB_REPO 를 확인한다." ;;
    esac
  fi
  printf 'MuRing-KB 기존 checkout 사용 (자동 pull 없음): %s\n' "$KB_DIR"
else
  mkdir -p "$(dirname "$KB_DIR")"
  # Clone beside the destination so a failed download does not leave a partial KB.
  staging=$(mktemp -d "$(dirname "$KB_DIR")/.muring-kb-clone.XXXXXXXX")
  trap 'rm -rf -- "$staging"' EXIT
  git_args=()
  if [[ "$KB_REPO" == https://github.com/* ]] && command -v gh >/dev/null 2>&1 \
      && gh auth status --hostname github.com >/dev/null 2>&1; then
    # Per-command helper: no token output or global credential changes.
    git_args=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
  fi
  if ! GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never \
      git "${git_args[@]}" clone --quiet -- "$KB_REPO" "$staging/repo"; then
    fail '다운로드 실패. 네트워크·저장소 읽기 권한을 확인하고 gh auth login --hostname github.com 후 다시 실행한다.'
  fi
  # -T prevents nesting the checkout if the destination appeared in the meantime.
  mv -T -n -- "$staging/repo" "$KB_DIR"
  [ ! -e "$staging/repo" ] || fail '설치 경로가 생성되어 중단했다. 경로를 확인하고 다시 실행한다.'
fi

for file in START-HERE.md scripts/setup.py scripts/kb.py; do
  [ -f "$KB_DIR/$file" ] || fail "KB 설치 파일 없음: $file. checkout 버전을 확인한다."
done
python3 "$KB_DIR/scripts/setup.py" --client all
python3 "$KB_DIR/scripts/kb.py" install
python3 "$KB_DIR/scripts/setup.py" --client all --check
[ "$HOME/.local/bin/mkb" -ef "$KB_DIR/scripts/kb.py" ] || fail 'mkb 연결 대상이 다르다.'
"$HOME/.local/bin/mkb" --version
printf 'MuRing-KB 설치·등록 확인 완료. 새 Codex 세션을 시작한다.\n'
