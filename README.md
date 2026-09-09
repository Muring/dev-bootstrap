# dev-bootstrap

새 PC 에 WSL2 + Ubuntu 개발환경을 다시 세우는 스크립트. 프로젝트 코드는 다루지 않는다.

## 쓰는 법

새 Windows PC 에는 **git 도 Claude Code 도 없다.** 첫 발만 손으로 뗀다.

```powershell
# Windows (관리자 PowerShell) — git 없이 받아서 실행한다
irm https://raw.githubusercontent.com/Muring/dev-bootstrap/main/windows/bootstrap.ps1 `
  -OutFile $env:TEMP\bootstrap.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\bootstrap.ps1
```

이게 WSL2 + Ubuntu 를 올리고, 그 안에서 저장소를 clone 한 뒤 `setup.sh` 까지 돌린다.
(Ubuntu WSL 이미지는 `ubuntu-wsl` 이 git·curl 을 끌어오므로 안쪽 clone 은 안전하다.)

`setup.sh` 가 `skills/dev-setup` 을 `~/.claude/skills/` 로 링크한 **다음부터** 클로드에게
말로 시킬 수 있다:

> 개발환경 구축해줘

즉 **스킬은 저절로 생기지 않는다.** 이 저장소가 심어준다. 첫 PC 에서는 위 두 줄이 먼저다.

이미 WSL 이 있다면 Ubuntu 안에서 이것만:

```bash
git clone https://github.com/Muring/dev-bootstrap.git ~/dev-bootstrap
GIT_USER_NAME="이름" GIT_USER_EMAIL="메일" bash ~/dev-bootstrap/linux/setup.sh
```

두 스크립트 모두 **멱등하다.** 몇 번을 돌려도 같은 상태가 된다.

`setup.sh` 는 끝에서 **실제로 돌려보고** 하나라도 어긋나면 `exit 1` 로 끝난다.
안내문만 찍고 성공한 척하지 않는다.

## 구성하는 것

| | |
|---|---|
| Windows | WSL2, Ubuntu (cloud-init 무인 사용자 생성) |
| Ubuntu | build-essential, ca-certificates, curl, git, unzip, zsh |
| gh | **cli.github.com 저장소를 먼저 붙인다.** Ubuntu 공식 저장소의 gh 는 낡았다(2.46 vs 2.100) |
| 타임존 | `Asia/Seoul` (`TIMEZONE` 으로 바꾼다) |
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
- **패키지 목록을 `apt-mark showmanual` 로 뽑지 않는다.** 그건 "이 PC 에서 손으로 깐 것"이지
  "필요한 것"이 아니다. 기반 이미지가 다르면 조용히 구멍이 난다.
  반대로 **외부 저장소에서 온 패키지는 저장소부터 붙여야 한다** — 안 그러면 낡은 버전이
  에러 없이 깔리고 스킵 로직도 "설치됨"으로 통과시킨다(`gh` 가 그랬다).
- **`.sh` 는 LF 로 고정한다.** CRLF 면 WSL 에서 `bad interpreter` 가 난다.
  `.gitattributes` 가 둘 다 강제한다.

## 알려진 한계

정직하게 적는다. 이걸 모르고 쓰면 새 PC 에서 당황한다.

- **설치 경로는 아직 실제로 실행된 적이 없다.** 개발 PC 에서는 전부 "이미 있음" 으로
  스킵되므로 `else` 가지가 한 번도 안 돈다. 검증하려면 일회용 배포판을 만든다:
  `wsl --install Ubuntu --name bootstrap-test` → 돌려보고 → `wsl --unregister bootstrap-test`.
- **고정된 버전은 Node 하나뿐이다.** fnm·zsh 플러그인·`claude`·`codex` 는 최신을 따라간다.
  끝의 검증이 버전을 찍어주므로 드리프트는 보이지만, 막지는 않는다.
- **공급망 검증이 없다.** fnm 은 `curl | bash` 로 받고 체크섬을 대조하지 않는다.
  zsh 플러그인도 `master` 를 그대로 클론한다.
- **cloud-init 사용자는 비밀번호 없는 sudo 를 갖는다.** 비밀번호가 아예 없어서
  `NOPASSWD` 가 없으면 `setup.sh` 의 sudo 가 전부 막힌다. 개발용 WSL 이라 감수한 것이다.
  원치 않으면 `wsl -d <distro>` 로 들어가 직접 사용자를 만들고 `setup.sh` 만 돌린다.
- **`setup.sh` 는 `~/.zshrc` 를 저장소 버전으로 덮어쓴다** (`.bak.<날짜>` 백업은 남는다).
  이 PC 전용 설정은 `~/.zshrc.local` 로 빼고 `.zshrc` 에서 source 한다.
- **Orca 설치는 자동이 아니다.** winget 패키지가 아니라 배포용 인스톨러다.
