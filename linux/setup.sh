#!/usr/bin/env bash
# WSL/Ubuntu 공통 개발환경 구축. 몇 번을 돌려도 같은 결과가 되도록 만든다.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.23.2}"
FNM_DIR="$HOME/.local/share/fnm"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_DIR="$REPO_DIR/files"

APT_PACKAGES=(build-essential curl git gh unzip zsh)
NPM_GLOBALS=(@anthropic-ai/claude-code @openai/codex)

step() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
skip() { printf '    \033[2m· %s\033[0m\n' "$1"; }
done_() { printf '    \033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '    \033[1;33m!\033[0m %s\n' "$1"; }

# ---------------------------------------------------------------- apt
step "apt 패키지"
missing=()
for p in "${APT_PACKAGES[@]}"; do
  dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
done
if [ ${#missing[@]} -eq 0 ]; then
  skip "이미 모두 설치됨"
else
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}"
  done_ "설치: ${missing[*]}"
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

# ---------------------------------------------------------------- 남은 수동 작업
cat <<'MANUAL'

──────────────────────────────────────────────
자동화할 수 없는 것 (브라우저 대화형)
──────────────────────────────────────────────
  claude          → 최초 실행 시 로그인
  codex login
  gh auth login
  Orca            → 앱에서 계정 로그인

확인:
  claude --version && codex --version && node -v && yarn -v
MANUAL
