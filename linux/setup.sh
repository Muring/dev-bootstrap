#!/usr/bin/env bash
# WSL/Ubuntu 공통 개발환경 구축. 몇 번을 돌려도 같은 결과가 되도록 만든다.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.23.2}"
TIMEZONE="${TIMEZONE:-Asia/Seoul}"
FNM_DIR="$HOME/.local/share/fnm"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_DIR="$REPO_DIR/files"

# 기반 이미지에 이미 있을 수 있지만, 없는 환경도 있으므로 명시한다.
APT_PACKAGES=(build-essential ca-certificates curl git unzip zsh)
NPM_GLOBALS=(@anthropic-ai/claude-code @openai/codex)

# 이 스크립트의 설치 가지는 아직 실제 신규 환경에서 돌아본 적이 없다.
# 처음 터지는 자리를 바로 알 수 있게, 단계 이름과 줄번호를 남기고 로그를 파일로 뜬다.
LOG="${SETUP_LOG:-$HOME/dev-bootstrap-setup.log}"
if : >>"$LOG" 2>/dev/null; then
  exec > >(tee -a "$LOG") 2>&1
  printf '\n===== %s =====\n' "$(date '+%F %T')"
else
  LOG="(로그 파일을 못 씀)"
fi

CURRENT_STEP="(시작 전)"
die() {
  printf '\n\033[1;31m✗ 실패\033[0m\n'
  printf '  단계   : %s\n' "$CURRENT_STEP"
  printf '  이유   : %s\n' "$1"
  printf '  로그   : %s\n' "$LOG"
  printf '\n  이 로그를 그대로 클로드에게 주면 된다.\n'
  printf '  고친 뒤에는 통째로 다시 돌린다 — 멱등하므로 끝난 단계는 스킵된다.\n'
  exit 1
}

on_err() {
  local code=$? line=${1:-?}
  printf '\n\033[1;31m✗ 실패\033[0m\n'
  printf '  단계   : %s\n' "$CURRENT_STEP"
  printf '  위치   : setup.sh:%s (exit %d)\n' "$line" "$code"
  printf '  로그   : %s\n' "$LOG"
  printf '\n  이 로그를 그대로 클로드에게 주면 된다.\n'
  printf '  고친 뒤에는 통째로 다시 돌린다 — 멱등하므로 끝난 단계는 스킵된다.\n'
}
trap 'on_err $LINENO' ERR

step() { CURRENT_STEP="$1"; printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
skip() { printf '    \033[2m· %s\033[0m\n' "$1"; }
done_() { printf '    \033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$1"; }

# 이 함수는 `if out=$(apt_install ...)` 로 불린다. 조건 문맥에서는 함수 안의
# errexit 가 억제되므로, apt 가 실패해도 실행이 계속되고 마지막 printf 가
# 성공으로 만들어 버린다. 그래서 종료코드를 직접 보고 직접 구분해 돌려준다.
#   0 = 설치함(설치한 목록을 stdout 으로)  1 = 이미 다 있음  2 = 설치 실패
# `| head -1` 로 자르면서 종료코드를 버리면, 실패한 명령이 뭔가 뱉기만 해도
# 성공으로 읽힌다. 전체 출력을 먼저 받아 종료코드까지 확인한 뒤 첫 줄만 쓴다.
# (`if out=$(...)` 형태라 여기서도 errexit 가 억제되지만, 종료코드를 직접 본다.)
probe() {
  local out i
  for i in 1 2 3; do
    if out=$("$@" 2>/dev/null) && [ -n "$out" ]; then
      printf '%s' "${out%%$'\n'*}"   # 첫 줄만
      return 0
    fi
    if [ "$i" -lt 3 ]; then sleep 2; fi
  done
  return 1   # 빈 값이 check 로 넘어가 실패로 잡힌다
}

apt_install() {
  local missing=() p
  for p in "$@"; do dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p"); done
  if [ ${#missing[@]} -eq 0 ]; then return 1; fi
  sudo apt-get update -qq || return 2
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" || return 2
  # 설치했다고 주장하기 전에 실제로 들어갔는지 확인한다.
  for p in "${missing[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || return 2; done
  printf '%s' "${missing[*]}"
  return 0
}

# apt_install 을 부르고 세 갈래를 구분해 처리한다.
# <버전명령> 을 주면 이미 설치돼 있을 때 그 버전을 함께 보여준다(없으면 `-`).
apt_step() { # apt_step <단계이름> <버전명령|-> <패키지...>
  local label="$1" vercmd="$2"; shift 2
  local out="" rc=0 ver=""
  out=$(apt_install "$@") || rc=$?
  case "$rc" in
    0) done_ "설치: $out" ;;
    1) if [ "$vercmd" != "-" ] && ver=$(probe "$vercmd" --version); then
         skip "이미 설치됨 ($ver)"
       else
         skip "이미 모두 설치됨"
       fi ;;
    *) die "$label 설치 실패 — 위 apt 출력을 본다 (패키지: $*)" ;;
  esac
}

# ---------------------------------------------------------------- apt
step "apt 기반 패키지"
apt_step "apt 기반 패키지" - "${APT_PACKAGES[@]}"

# ---------------------------------------------------------------- gh
# Ubuntu 공식 저장소의 gh 는 한참 낡았다(26.04 기준 2.46 vs 2.100).
# 저장소를 먼저 붙이지 않으면 낡은 버전이 조용히 깔린다.
step "GitHub CLI 저장소"
GH_LIST=/etc/apt/sources.list.d/github-cli.list
GH_KEY=/etc/apt/keyrings/githubcli-archive-keyring.gpg
GH_LINE="deb [arch=$(dpkg --print-architecture) signed-by=$GH_KEY] https://cli.github.com/packages stable main"
if [ -s "$GH_KEY" ] && [ -f "$GH_LIST" ] && [ "$(cat "$GH_LIST")" = "$GH_LINE" ]; then
  skip "이미 등록됨"
else
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo tee "$GH_KEY" >/dev/null
  sudo chmod go+r "$GH_KEY"
  printf '%s\n' "$GH_LINE" | sudo tee "$GH_LIST" >/dev/null
  sudo apt-get update -qq
  done_ "cli.github.com 등록"
fi

step "gh"
apt_step "gh" gh gh

# ---------------------------------------------------------------- 타임존
step "타임존"
if [ "$(timedatectl show -p Timezone --value 2>/dev/null)" = "$TIMEZONE" ]; then
  skip "이미 $TIMEZONE"
else
  sudo timedatectl set-timezone "$TIMEZONE" 2>/dev/null && done_ "$TIMEZONE" || warn "설정 실패 (systemd 미가동?)"
fi

# ---------------------------------------------------------------- wsl.conf
# systemd 와 기본 사용자. 적용하려면 Windows 에서 `wsl --shutdown` 이 필요하다.
step "/etc/wsl.conf"
if [ -f /proc/sys/fs/binfmt_misc/WSLInterop ] || grep -qi microsoft /proc/version; then
  want=$(sed "s/__USER__/$USER/" "$FILES_DIR/wsl.conf")
  if [ -f /etc/wsl.conf ] && [ "$(cat /etc/wsl.conf)" = "$want" ]; then
    skip "이미 동일"
  else
    printf '%s\n' "$want" | sudo tee /etc/wsl.conf >/dev/null
    done_ "작성 — 적용하려면 Windows 에서 'wsl --shutdown' 후 재접속"
  fi
else
  skip "WSL 이 아니라 건너뜀"
fi

# ---------------------------------------------------------------- fnm + node
step "fnm + Node $NODE_VERSION"
if [ ! -x "$FNM_DIR/fnm" ]; then
  curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir "$FNM_DIR" --skip-shell
  done_ "fnm 설치"
else
  skip "fnm 이미 있음 ($("$FNM_DIR/fnm" --version))"
fi

export PATH="$FNM_DIR:$PATH"
eval "$(fnm env --shell bash)"

if fnm list 2>/dev/null | grep -q "v$NODE_VERSION"; then
  skip "Node v$NODE_VERSION 이미 있음"
else
  fnm install "$NODE_VERSION"
  done_ "Node v$NODE_VERSION 설치"
fi
fnm default "$NODE_VERSION" >/dev/null
fnm use "$NODE_VERSION" >/dev/null

# corepack 이 yarn/pnpm 을 프로젝트의 packageManager 필드대로 붙여준다.
corepack enable >/dev/null 2>&1 && done_ "corepack 활성화" || warn "corepack 활성화 실패"

# ---------------------------------------------------------------- npm 전역
step "npm 전역 패키지"
for pkg in "${NPM_GLOBALS[@]}"; do
  if npm ls -g --depth=0 "$pkg" >/dev/null 2>&1; then
    skip "$pkg 이미 있음"
  else
    npm install -g "$pkg" >/dev/null
    done_ "$pkg 설치"
  fi
done

# ---------------------------------------------------------------- zsh
step "zsh 설정"
mkdir -p "$HOME/.zsh"
for plugin in zsh-autosuggestions zsh-syntax-highlighting; do
  if [ -d "$HOME/.zsh/$plugin" ]; then
    skip "$plugin 이미 있음"
  else
    git clone -q --depth=1 "https://github.com/zsh-users/$plugin.git" "$HOME/.zsh/$plugin"
    done_ "$plugin 클론"
  fi
done

if [ -f "$HOME/.zshrc" ] && cmp -s "$FILES_DIR/zshrc" "$HOME/.zshrc"; then
  skip ".zshrc 이미 동일"
else
  [ -f "$HOME/.zshrc" ] && cp "$HOME/.zshrc" "$HOME/.zshrc.bak.$(date +%Y%m%d%H%M%S)"
  cp "$FILES_DIR/zshrc" "$HOME/.zshrc"
  done_ ".zshrc 작성 (기존 파일은 .bak 으로 보관)"
fi

if [ "$(getent passwd "$USER" | cut -d: -f7)" = /usr/bin/zsh ]; then
  skip "로그인 셸 이미 zsh"
else
  sudo chsh -s /usr/bin/zsh "$USER"
  done_ "로그인 셸을 zsh 로 변경"
fi

# ---------------------------------------------------------------- git
step "git 전역 설정"
git config --global init.defaultBranch main
[ -n "${GIT_USER_NAME:-}" ] && git config --global user.name "$GIT_USER_NAME"
[ -n "${GIT_USER_EMAIL:-}" ] && git config --global user.email "$GIT_USER_EMAIL"
git config --global user.name >/dev/null 2>&1 \
  || warn "user.name 미설정 — GIT_USER_NAME/GIT_USER_EMAIL 을 주거나 직접 설정한다"

# WSL 에서는 Windows 의 Git Credential Manager 를 그대로 빌려 쓴다.
gcm=$(ls /mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe 2>/dev/null || true)
if [ -n "$gcm" ]; then
  git config --global credential.helper "${gcm// /\\ }"
  done_ "credential.helper → Windows GCM"
else
  warn "Git for Windows 를 못 찾음 — credential.helper 는 수동 설정"
fi

# ---------------------------------------------------------------- claude
step "Claude Code 설정"
mkdir -p "$HOME/.claude"
if [ -f "$HOME/.claude/settings.json" ]; then
  skip "settings.json 이미 있음 (덮어쓰지 않는다)"
else
  cp "$FILES_DIR/claude-settings.json" "$HOME/.claude/settings.json"
  done_ "settings.json 작성"
fi

# ---------------------------------------------------------------- orca 스킬
step "Orca 스킬"
ORCA="${ORCA_CLI_COMMAND:-orca-ide}"
# `skills install` 은 인자가 없으면 사용법만 찍고 exit 0 을 낸다.
# 이름을 명시하고, 성공 여부는 종료코드가 아니라 설치된 디렉터리로 판정한다.
ORCA_SKILLS=(computer-use orca-cli orchestration)
if command -v "$ORCA" >/dev/null 2>&1; then
  args=()
  for s in "${ORCA_SKILLS[@]}"; do args+=(--skill "$s"); done
  "$ORCA" skills install "${args[@]}" >/dev/null 2>&1 || true
  for s in "${ORCA_SKILLS[@]}"; do
    if [ -d "$HOME/.agents/skills/$s" ] || [ -d "$HOME/.claude/skills/$s" ]; then
      done_ "$s"
    else
      warn "$s 설치 안 됨"
    fi
  done
else
  warn "$ORCA 없음 — Windows 에서 Orca 를 설치하고 WSL 터미널을 한 번 열면 브리지가 생긴다"
fi

# ---------------------------------------------------------------- dev-setup 스킬
# 이 저장소의 스킬을 심어야 다음부터 "개발환경 구축해줘" 가 통한다.
step "dev-setup 스킬"
mkdir -p "$HOME/.claude/skills"
if [ -e "$HOME/.claude/skills/dev-setup" ] && [ ! -L "$HOME/.claude/skills/dev-setup" ]; then
  warn "~/.claude/skills/dev-setup 이 심볼릭 링크가 아니다 — 손대지 않는다"
else
  ln -sfn "$REPO_DIR/../skills/dev-setup" "$HOME/.claude/skills/dev-setup"
  done_ "~/.claude/skills/dev-setup → 저장소 (git pull 하면 같이 갱신된다)"
fi

# ---------------------------------------------------------------- 검증
# 출력만 하지 않는다. 실제로 돌려보고, 하나라도 어긋나면 0 이 아닌 코드로 끝낸다.
step "검증"
FAILED=()
# claude·codex 는 스스로 업데이트한다. 교체되는 찰나에 부르면 빈 값이 나와
# 멀쩡한 환경이 실패로 잡힌다. 몇 번 다시 물어본다.
check() { # check <설명> <기대> <실제>
  if [ -n "$3" ] && { [ -z "$2" ] || [ "$2" = "$3" ]; }; then
    done_ "$1: $3"
  else
    warn "$1: 기대 '${2:-비어있지 않음}' / 실제 '${3:-없음}'"
    FAILED+=("$1")
  fi
}

check "fnm"     ""               "$(probe fnm --version)"
check "node"    "v$NODE_VERSION" "$(probe node -v)"
check "yarn"    ""               "$(probe corepack yarn --version)"
check "claude"  ""               "$(probe claude --version)"
check "codex"   ""               "$(probe codex --version)"
check "gh"      ""               "$(probe gh --version)"
check "git"     ""               "$(probe git --version)"
check "로그인 셸" "/usr/bin/zsh"   "$(getent passwd "$USER" | cut -d: -f7)"
check "타임존"   "$TIMEZONE"      "$(timedatectl show -p Timezone --value 2>/dev/null)"

for s_ in "${ORCA_SKILLS[@]:-}"; do
  [ -n "$s_" ] || continue
  if [ -d "$HOME/.agents/skills/$s_" ] || [ -d "$HOME/.claude/skills/$s_" ]; then
    done_ "스킬 $s_"
  else
    warn "스킬 $s_ 없음"; FAILED+=("스킬 $s_")
  fi
done
[ -e "$HOME/.claude/skills/dev-setup" ] \
  && done_ "스킬 dev-setup" \
  || { warn "스킬 dev-setup 없음"; FAILED+=("스킬 dev-setup"); }

# ---------------------------------------------------------------- 결과
cat <<'MANUAL'

──────────────────────────────────────────────
자동화할 수 없는 것 (브라우저 대화형)
──────────────────────────────────────────────
  claude          → 최초 실행 시 로그인
  codex login
  gh auth login
  Orca            → 앱에서 계정 로그인
MANUAL

if [ ${#FAILED[@]} -gt 0 ]; then
  printf '\n\033[1;31m✗ 미완료 %d 건:\033[0m %s\n' "${#FAILED[@]}" "${FAILED[*]}"
  printf '  로그: %s\n' "$LOG"
  printf '  고친 뒤 이 스크립트를 통째로 다시 돌린다. 멱등하다.\n'
  exit 1
fi
printf '\n\033[1;32m✓ 전부 확인됨\033[0m\n'
