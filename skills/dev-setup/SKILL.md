---
name: dev-setup
description: 새 PC(또는 새 WSL 배포판)에 이 사용자의 표준 개발환경을 구축한다. "개발환경 구축해줘", "새 컴퓨터 세팅", "dev 환경 복원", "WSL 다시 깔았어" 같은 요청에 쓴다. 프로젝트 클론은 포함하지 않는다 — 공통 환경(WSL·Ubuntu·zsh·fnm/Node·Claude·Codex·Orca 스킬)만 다룬다.
---

# 개발환경 구축

## 먼저 어디에 있는지 판단한다

`uname -s` 또는 `$env:OS` 로 지금 세션이 **Windows 쪽인지 WSL 안쪽인지** 확인한다.
둘은 진입점이 다르다.

| 위치 | 진입점 |
|---|---|
| Windows | `windows/bootstrap.ps1` (관리자 PowerShell) — WSL 설치부터 |
| WSL/Ubuntu | `linux/setup.sh` — 공통 환경만 |

## 절차

1. **저장소 확보.** `~/dev-bootstrap` 이 있으면 `git pull --ff-only`, 없으면
   `git clone https://github.com/Muring/dev-bootstrap.git ~/dev-bootstrap`.

2. **실행.**
   - Windows: `powershell -ExecutionPolicy Bypass -File windows\bootstrap.ps1`
     관리자 권한이 없으면 **사용자에게 관리자 PowerShell 로 실행해달라고 요청한다.**
     스크립트를 우회해 직접 `wsl --install` 을 두드리지 않는다.
   - WSL: `bash ~/dev-bootstrap/linux/setup.sh`
     이름/이메일이 필요하면 `GIT_USER_NAME=... GIT_USER_EMAIL=... bash ...` 로 넘긴다.
     값을 지어내지 말고 사용자에게 묻는다.

3. **재부팅·shutdown 이 필요한 지점을 그냥 넘기지 않는다.**
   - WSL 기능이 처음 켜진 PC 는 재부팅해야 `wsl --install` 이 끝난다.
   - `/etc/wsl.conf` 를 새로 썼으면 Windows 에서 `wsl --shutdown` 후 재접속해야 적용된다.
   둘 다 스크립트가 알려준다. 사용자에게 전달하고 **다음 단계로 넘어가지 않는다.**

4. **검증.** 설치가 끝났다고 보고하기 전에 실제로 돌려서 확인한다.
   ```
   node -v && yarn -v && claude --version && codex --version
   getent passwd "$USER" | cut -d: -f7      # /usr/bin/zsh
   git config --global --list
   ```

5. **남은 대화형 작업을 보고한다.** 아래 넷은 브라우저 로그인이라 자동화할 수 없다.
   대신 해줄 수 있는 척하지 않는다.
   - `claude` (최초 실행) · `codex login` · `gh auth login` · Orca 앱 계정 로그인

## 주의

- `setup.sh` 는 멱등하다. 실패하면 고치고 **다시 통째로 돌린다** — 중간부터 손으로 잇지 않는다.
- 스크립트가 하는 일을 클로드가 개별 명령으로 재현하지 않는다. PC 마다 결과가 갈린다.
  절차를 바꿔야 하면 **스크립트를 고치고 커밋한다.**
- 이 스킬은 프로젝트 클론·`.env`·DB 접속을 다루지 않는다. 그건 각 저장소의 CLAUDE.md 소관이다.
