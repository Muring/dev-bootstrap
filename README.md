# dev-bootstrap

새 PC 에 WSL2 + Ubuntu 개발환경을 다시 세우는 스크립트. 프로젝트 코드는 다루지 않는다.

## 쓰는 법

새 Windows PC 에 **Claude Code 만 설치**하고, 클로드에게 이렇게 말한다:

> 개발환경 구축해줘

`skills/dev-setup` 이 깔려 있으면 클로드가 아래 절차를 알아서 밟는다.
손으로 하려면:

```powershell
# Windows (관리자 PowerShell) — WSL 설치부터 끝까지
git clone https://github.com/Muring/dev-bootstrap.git
powershell -ExecutionPolicy Bypass -File dev-bootstrap\windows\bootstrap.ps1
```

```bash
# 이미 WSL 이 있다면 Ubuntu 안에서 이것만
git clone https://github.com/Muring/dev-bootstrap.git ~/dev-bootstrap
GIT_USER_NAME="이름" GIT_USER_EMAIL="메일" bash ~/dev-bootstrap/linux/setup.sh
```

두 스크립트 모두 **멱등하다.** 몇 번을 돌려도 같은 상태가 된다.

## 구성하는 것

| | |
|---|---|
| Windows | WSL2, Ubuntu (cloud-init 무인 사용자 생성) |
| Ubuntu | build-essential, curl, git, gh, unzip, zsh |
| Node | fnm → Node 22.23.2 → corepack (yarn 은 프로젝트 `packageManager` 를 따른다) |
| 전역 npm | `@anthropic-ai/claude-code`, `@openai/codex` |
| 셸 | zsh + autosuggestions + syntax-highlighting, `.zshrc` |
| git | `init.defaultBranch=main`, credential.helper → Windows GCM |
| Claude | `~/.claude/settings.json` (기존 파일은 덮어쓰지 않는다) |
| Orca | Windows 앱이 `~/.local/bin/orca-ide` 브리지를 만든다 → `orca-ide skills install` |

## 자동화하지 않는 것

브라우저 대화형이라 스크립트로 못 한다:

- `claude` 최초 실행 로그인 · `codex login` · `gh auth login` · Orca 앱 계정 로그인

권한·재부팅이 끼는 지점:

- `wsl --install` 은 **관리자 권한**이 필요하고, WSL 기능이 처음 켜지는 PC 는 **재부팅**해야 끝난다.
- `/etc/wsl.conf` 를 새로 썼으면 `wsl --shutdown` 후 재접속해야 적용된다.

## 비밀값

**이 저장소에 비밀값을 넣지 않는다.** public 이다.
`.env` 류는 각 프로젝트 저장소의 `.env.example` 과 CLAUDE.md 를 따른다.
이름·이메일도 하드코딩하지 않고 `GIT_USER_NAME` / `GIT_USER_EMAIL` 로 받는다.

## 고칠 때

환경 구성이 바뀌면 **여기를 고치고 커밋한다.** 클로드가 그때그때 다른 명령을 치면
PC 마다 결과가 갈린다. `linux/files/` 안의 dotfile 이 실제 배포본이다.

## 함정

- **`.ps1` 은 UTF-8 BOM 을 유지한다.** BOM 이 없으면 Windows PowerShell 5.1 이 cp949 로
  읽어 한글 주석이 깨지고 "종료되지 않은 문자열" 로 파싱이 실패한다. 실행 전에 확인:
  `[System.Management.Automation.Language.Parser]::ParseFile(...)`
- **`.sh` 는 LF 로 고정한다.** CRLF 면 WSL 에서 `bad interpreter` 가 난다.
  `.gitattributes` 가 둘 다 강제한다.
