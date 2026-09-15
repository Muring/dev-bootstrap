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
git clone https://github.com/Muring/dev-bootstrap.git ~/dev/dev-bootstrap
GIT_USER_NAME="이름" GIT_USER_EMAIL="메일" bash ~/dev/dev-bootstrap/linux/setup.sh
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
| Claude 커맨드 | `~/.claude/commands` → 이 저장소 `commands/` 링크. `/commit`, `/blog-draft` |
| Orca 이름 생성 | WSL 설치 시 검증된 Windows 1.4.202 앱 패치 자동 적용·백업·체크섬 검사 |
| Orca 스킬 | Windows 앱이 `~/.local/bin/orca-ide` 브리지를 만든다 → `orca-ide skills install` |

## Orca WSL 자동 이름 생성 오류

WSL의 Codex가 정상인데 워크트리 브랜치·폴더 이름 생성에서
`codex not found on PATH`가 뜨는 오류를 설치 중 보정한다.
Orca가 작업 경로의 WSL 배포판을 계정 환경 준비와 실행에 전달하도록 하는 로컬 패치다.

- Windows `bootstrap.ps1` → WSL `setup.sh`와 WSL 직접 설치 모두 자동 적용한다.
- **Windows Orca 1.4.202의 검증된 app.asar만 지원한다.** 원본·패치본 SHA-256으로
  판별한다. 미설치·다른 빌드·파일 잠금은 설치를 미완료로 끝낸다.
- Orca 설치 후 완전히 종료하고 실행한다. 설치 프로그램이 작업 중인 앱을 자동 종료하지 않는다.
  이미 패치된 경우에는 실행 중이어도 체크섬 확인만 한다.
- 앱 전체를 저장소에 넣지 않고 `windows/patches/`의 작은 변경 데이터로 재구성한다.
  적용 결과는 기존에 실사용 성공이 보고된 패치본과 SHA-256이 같아야 한다.
- 원본 백업은 `resources/app.asar.bootstrap-wsl-rename.original`에 보관한다.
  업데이트로 패치가 사라질 수 있으며, 다른 버전은 수정 필요 여부부터 다시 점검한다.
  앱 자동 업데이트 감시·재패치는 하지 않는다.

패치만 재실행하거나 기본 경로(`%LOCALAPPDATA%\Programs\orca`)가 다른 경우:

```powershell
# 저장소 루트, Orca를 종료한 상태에서 실행
powershell -ExecutionPolicy Bypass -File windows\fix-orca-wsl-rename.ps1
# 사용자 지정 설치 경로
powershell -ExecutionPolicy Bypass -File windows\fix-orca-wsl-rename.ps1 -AppDir 'D:\Apps\orca'
# 백업 복구 (패치된 설치본에만 적용)
powershell -ExecutionPolicy Bypass -File windows\fix-orca-wsl-rename.ps1 -Restore
```

패치 회귀 검증은 설치본을 건드리지 않는 임시 폴더에서 수행한다:
`powershell -ExecutionPolicy Bypass -File tests\orca-wsl-rename.ps1 -OriginalArchive <검증된 원본 app.asar>`.
로그인 후 새 워크트리 첫 메시지로 실제 제목 생성까지 확인한다.

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

`skills/` 와 `commands/` 는 홈으로 **복사가 아니라 링크**된다. 그래서 여기를 고치고
`git pull` 하면 그 PC 에 바로 반영된다 — 다시 `setup.sh` 를 돌릴 필요가 없다.
반대로 홈 쪽에서 고치면 저장소를 고치는 것이니 커밋해야 다른 PC 로 따라간다.

### `setup.sh` 의 헬퍼

단계를 추가할 때 `apt-get` 이나 버전 조회를 **직접 쓰지 않는다.** 아래를 통해서 쓴다.
직접 쓰면 실패가 성공으로 보고된다 — 실제로 세 번 그랬다.

| 헬퍼 | 쓰는 법 |
|---|---|
| `apt_step <라벨> <버전명령\|-> <패키지...>` | apt 패키지 설치. 대표 명령이 없으면 `-` |
| `probe <명령> [인자...]` | 버전 등 한 줄 조회. 종료코드를 보고 첫 줄만 돌려준다 |
| `step <이름>` | 단계 시작. 실패 보고에 이 이름이 찍히므로 반드시 부른다 |
| `die <이유>` | 더 진행할 수 없을 때. 단계·이유·로그 경로를 찍고 멈춘다 |
| `done_` / `skip` / `warn` | 각각 했음 / 이미 됨 / 문제지만 계속 |

```bash
step "gh"
apt_step "gh" gh gh          # 라벨, 버전명령(gh --version), 패키지
apt_step "기반" - curl git   # 대표 명령이 없으면 '-'
```

`apt_step` 은 `apt_install` 의 종료코드를 **0=설치함 / 1=이미 있음 / 2=실패** 로 구분한다.
이 구분이 필요한 이유는 `if out=$(apt_install ...)` 라는 조건 문맥에서는 함수 안의
`errexit` 가 억제되기 때문이다 — `apt-get` 이 실패해도 실행이 이어지고 마지막
`printf` 가 0 을 돌려 "설치했다" 가 된다. **함수를 조건 자리에서 부를 때는 항상
종료코드를 직접 판정한다.**

`probe` 는 `| head -1` 로 자르지 않는다. 자르면서 종료코드를 버리면 실패한 명령이
stdout 에 뭔가 뱉기만 해도 성공으로 읽힌다. 전체를 받고 나서 첫 줄만 쓴다.
`claude`·`codex` 는 스스로 업데이트하므로 교체되는 찰나를 대비해 2 초 간격 3 회 재시도한다.

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

## 처음 진짜로 돌릴 때

설치 가지는 아직 실제 신규 환경에서 돌아본 적이 없다. 그래서 **터졌을 때 바로 고칠 수
있게** 만들어 뒀다. 미리 다 맞히려 하지 말고, 터지면 그걸 보고 고친다.

- 실행 로그가 `~/dev/dev-bootstrap-setup.log` 에 쌓인다(`SETUP_LOG` 로 바꾼다).
- 실패하면 **어느 단계에서, 몇 번째 줄에서** 죽었는지 찍고 멈춘다.
- 그 출력을 그대로 클로드에게 주면 된다.
- 고친 뒤에는 **통째로 다시 돌린다.** 멱등하므로 끝난 단계는 스킵된다.
  중간부터 손으로 잇지 않는다 — 그러면 이 저장소가 실제 상태와 어긋난다.
- 고친 내용은 **여기에 커밋한다.** 그 PC 에서만 손보면 다음 PC 에서 또 밟는다.

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
