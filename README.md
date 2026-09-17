# Dev Bootstrap

Windows PC에서 **WSL2 + Ubuntu 개발환경을 안내하며 설치하는 마법사**입니다.
개인 PC 재설치를 위한 MuRing 구성을 기본 제공하고, 공통 개발환경 구성도 선택할 수 있습니다.
업무 프로젝트, 프로젝트의 비밀값, DB 설정은 설치하지 않습니다.

## 앱으로 시작하기

1. [DevBootstrap-0.1.0-x64.exe 다운로드](https://github.com/Muring/dev-bootstrap/releases/download/DevBootstrap-0.1.0-x64.exe/DevBootstrap-0.1.0-x64.exe)를 눌러 EXE를 받습니다. **Git clone은 필요 없습니다.**
2. 다운로드한 `DevBootstrap-0.1.0-x64.exe`를 **Windows 로컬 폴더에서 실행**합니다.
3. **환경 확인**을 누릅니다. WSL, 기존 Ubuntu, 드라이브 여유 공간과 Orca 상태를 검사합니다.
4. WSL이 없으면 **WSL 준비 / 업데이트**를 누릅니다. 이 단계에서만 Windows 관리자 권한을 요청합니다.
5. 재부팅이 필요하면 작업을 저장하고 재부팅한 다음 같은 앱을 다시 엽니다.
6. Ubuntu 저장 위치와 Linux 사용자명을 선택하고 **Ubuntu 설치**를 누릅니다. 기존 Ubuntu라면 현재 위치와 개발 계정을 사용합니다.
7. **설치 구성**에서 원하는 항목을 선택합니다. `Recommended`는 권장 표시이며 선택을 해제할 수 있습니다.
8. **변경 내용 확인**에서 설치 대상과 설정 변경을 확인하고 설치를 시작합니다.
9. 별도 Ubuntu 실행 창의 안내를 따릅니다. 기존 계정의 sudo 비밀번호가 필요하면 그 창에 입력합니다.
10. 앱의 **로그인 · 연동**에서 GitHub·Claude·Codex 로그인과 KB·Orca 연결을 마칩니다.
11. **완료** 화면에서 설치와 계정 연결 상태를 각각 확인합니다.

**사용자 PC에 Git, Node, Python을 미리 설치하거나 이 저장소를 clone할 필요가 없습니다.**
실행 파일에 앱 런타임과 설치 스크립트가 들어 있습니다. 개발 도구 다운로드에는 인터넷이 필요합니다.
[릴리스 페이지](https://github.com/Muring/dev-bootstrap/releases/tag/DevBootstrap-0.1.0-x64.exe)에서 변경 내용과
[SHA-256 파일](https://github.com/Muring/dev-bootstrap/releases/download/DevBootstrap-0.1.0-x64.exe/SHA256SUMS.txt)도 확인할 수 있습니다.
현재 버전은 서명되지 않은 **초기 검증판(Pre-release)**입니다. 신규 Windows 전체 설치 검증은 아직 남아 있습니다.
GitHub의 `Source code (zip/tar.gz)`는 개발용 소스이며, 설치할 때는 `.exe` 파일을 받으세요.

첫 버전의 지원 대상은 **Windows 11 x64 + WSL2 + Ubuntu**입니다.
기존 WSL1 배포판의 자동 전환, 기존 Ubuntu의 이동·삭제, 다른 Linux 배포판은 지원하지 않습니다.
Windows 저장 위치는 Ubuntu 가상 디스크의 위치이며, Ubuntu 내부 홈 경로는 `/home/<사용자>`입니다.
새 Ubuntu 계정에는 개발용 WSL을 위한 비밀번호 없는 sudo 권한이 부여됩니다.

## 설치 후와 다음 버전 사용

- 첫 설치는 환경 확인 → 설치 구성 → 변경 내용 확인 → 설치 → 로그인·연동 순서로 진행합니다.
- 설치 도중 재부팅하면 같은 EXE를 다시 실행하고 환경 확인 후 계속합니다.
- 설치가 끝나면 새 Ubuntu 터미널에서 선택한 도구의 버전을 확인합니다. KB 등록 후에는 새 Codex 세션을 시작합니다.
- 실패하면 **로그 폴더 열기**에서 해당 실행의 `events.jsonl`과 `events.log`를 확인하고 미완료 단계를 재시도합니다.
- 다음 버전은 [전체 릴리스 목록](https://github.com/Muring/dev-bootstrap/releases)에서 새 EXE를 받아 실행합니다.
  자동 업데이트는 없습니다. 같은 Windows 계정의 선택 기록을 읽고 실제 상태를 다시 검사합니다.
- 다음 버전 설치도 변경 내용 확인 화면을 거칩니다. 기존 Ubuntu나 개발환경을 먼저 삭제할 필요가 없습니다.
- 개발자가 새 버전을 배포하는 절차는 [배포 가이드](docs/RELEASING.md)를 따릅니다.

## 기본 구성과 Recommended

| 항목 | MuRing 구성 | 공통 구성 |
|---|---|---|
| Git·Python·curl·빌드 도구 | Required | Required |
| fnm·Node 22.23.2·Corepack | 선택됨 · Recommended | 선택됨 · Recommended |
| GitHub CLI | 선택됨 · Recommended | 선택됨 · Recommended |
| Claude Code·Codex | 각각 선택됨 · Recommended | 선택 해제 |
| zsh·로그인 셸 변경 | 선택됨 · Recommended | 선택 해제 |
| 프롬프트·zsh 플러그인 | 선택됨 · zsh 사용 시 Recommended | 선택 해제 |
| 기존 `.zshrc` 전체 교체 | 선택 해제 | 선택 해제 |
| Git 작성자·기본 브랜치·Windows GCM | 각각 선택 해제 | 각각 선택 해제 |
| 시간대 변경 | Asia/Seoul 선택됨 | 기존 값 유지 |
| Claude 개인 설정·스킬·커맨드 | 각각 선택됨 | 선택 해제 |
| Claude 권한 경고 생략 설정 | 선택 해제 | 선택 해제 |
| 개인 KB·Orca 스킬 | 각각 선택됨 · Recommended | 선택 해제 |
| Orca 1.4.202 패치 | 선택 해제 | 선택 해제 |

도구를 선택하면 필요한 의존성도 함께 선택합니다. 의존성을 해제하면 관련 도구도 함께 해제하며,
화면에 함께 변경된 항목을 표시합니다. 선택하지 않은 항목은 설치 실패로 집계하지 않습니다.
Orca 패치는 검증된 파일이 있을 때만 선택 가능합니다.

### 기존 설정은 어떻게 처리하나요?

- 기본 동작은 **기존 `.zshrc` 보존**입니다. 필요한 초기화만 관리 블록으로 연결합니다.
- 공통 실행 경로와 fnm 초기화는 `~/.config/dev-bootstrap/env.sh`에 저장합니다.
- Bash의 `.bashrc`와 실제 사용되는 로그인 설정에도 초기화를 연결합니다.
- zsh를 선택하면 `.zshrc`에 연결을 추가합니다. `.zshrc.local`은 마지막에 읽습니다.
- 프롬프트·단축키·플러그인을 선택하면 기존 사용자 파일을 지우지 않고 관리 설정을 읽습니다.
  이 관리 설정이 기존 프롬프트·단축키의 동작을 바꿀 수 있으며, `.zshrc.local`에서 조정할 수 있습니다.
- **전체 교체를 직접 선택한 경우에만** 기존 `.zshrc`를 교체합니다.
- 변경하는 사용자 설정 파일은 같은 폴더에 `.bak.<시간>`으로 백업합니다.
- 같은 구성으로 반복 실행해도 관리 블록이나 백업이 불필요하게 늘어나지 않습니다.
- Claude 설정 파일이 이미 있으면 개인 기본 설정으로 덮어쓰지 않습니다.
  별도로 선택한 권한 경고 생략 설정은 백업 후 해당 키만 변경합니다.
- 기존 Claude 스킬·커맨드 경로가 일반 디렉터리라면 보존하고 충돌을 보고합니다.

앱 설치 자산은 Ubuntu의 `~/.local/share/dev-bootstrap/runtime`에 복사합니다.
스킬·커맨드 링크는 이 위치를 가리키므로 Windows 실행 파일을 옮겨도 유지됩니다.
앱에서 설치할 때 저장소의 최신 코드를 자동 pull하지 않습니다.

## 로그인과 수동 작업

### GitHub / 개인 KB

앱의 GitHub 로그인 버튼을 누르면 대상 Ubuntu 터미널에서 로그인을 진행합니다.
MuRing 기본 KB는 `https://github.com/Muring/muring-kb.git`이며 해당 비공개 저장소 읽기 권한이 필요합니다.
공통 구성에서도 KB를 선택하고 다른 GitHub HTTPS 저장소와 Ubuntu 설치 경로를 지정할 수 있습니다.
대상 KB는 `START-HERE.md`, `scripts/setup.py`, `scripts/kb.py`를 제공하는 호환 저장소여야 합니다.

인증 후 **KB 연결 재시도**를 누릅니다. 기존 KB checkout은 자동 pull하지 않습니다.
연결이 끝나면 새 Codex 세션을 시작하세요.

### Claude / Codex

앱의 로그인 버튼으로 각각 로그인합니다. 앱은 계정 토큰이나 비밀번호를 수집·저장하지 않습니다.
CLI 자체가 관리하는 인증 상태만 검사합니다. 로그인은 나중에 할 수 있으며 설치 완료와 구분됩니다.

### Orca

Orca 앱 자체의 다운로드·설치는 자동화하지 않습니다.

1. Windows용 Orca 설치 파일로 직접 설치하고 로그인합니다.
2. Orca에서 설치 대상 Ubuntu의 WSL 터미널을 한 번 엽니다.
3. 설치 마법사에서 **Orca 스킬 연결**을 누릅니다.
4. 패치를 선택했다면 스킬 연결 후 Orca를 완전히 종료하고 **패치 적용**을 누릅니다.

자동 검사 경로는 `%LOCALAPPDATA%\Programs\orca`입니다.
패치는 **검증된 Windows Orca 1.4.202 app.asar만** 지원합니다.
원본과 결과 SHA-256을 확인하며 원본을 `resources/app.asar.bootstrap-wsl-rename.original`에 백업합니다.
다른 버전은 수정하지 않습니다. 앱을 자동 종료하거나 업데이트 후 자동 재패치하지 않습니다.
사용자 지정 경로의 패치는 아래 CLI를 사용합니다.

```powershell
powershell -ExecutionPolicy Bypass -File windows\fix-orca-wsl-rename.ps1 -AppDir 'D:\Apps\orca'
# 패치된 파일을 검증된 백업으로 복원
powershell -ExecutionPolicy Bypass -File windows\fix-orca-wsl-rename.ps1 -Restore
```

## 중단, 실패, 다시 실행

- 필수 단계가 실패하면 해당 단계에 의존하는 작업은 대기합니다. 독립 작업은 계속합니다.
- 인증·Orca 준비가 필요하면 **사용자 작업 필요**로 표시합니다.
- **현재 단계 후 중지**는 실행 중인 명령이 끝난 다음 멈춥니다. 전체 자동 롤백은 하지 않습니다.
- 앱을 강제 종료했거나 PC가 재부팅되어도 다시 열고 환경 확인 후 재실행할 수 있습니다.
- 이전 성공 기록만 믿지 않고 실제 명령과 파일을 다시 검사합니다.
- 같은 Ubuntu에서 설치가 중복 실행되지 않도록 잠금을 사용합니다.
- WSL 재시작은 실행 중인 모든 WSL 작업을 종료하므로 앱에서 먼저 안내합니다.

앱 설정과 기록: `%LOCALAPPDATA%\dev-bootstrap`

- `state.json`: 선택 구성과 화면 상태
- `run-<시간>/config.json`: 해당 실행의 구성
- `run-<시간>/events.jsonl`: 단계별 상태
- `run-<시간>/events.log`: 설치 명령 출력

로그인 터미널의 출력은 설치 로그로 수집하지 않습니다. 로그는 **로그 폴더 열기** 버튼으로 확인합니다.

## CLI로 설치하기

앱 없이 설치하는 경로도 유지합니다. **이제 비대화형 실행에는 명시적인 JSON 구성이 필요합니다.**
기존 `GIT_USER_NAME=... bash setup.sh` 형태 대신 구성 파일의 `gitName` / `gitEmail`과 해당 선택 항목을 사용하세요.

### 새 Windows PC

관리자 PowerShell에서 실행합니다. 저장소 clone은 필요하지 않습니다.

```powershell
irm https://raw.githubusercontent.com/Muring/dev-bootstrap/main/windows/bootstrap.ps1 -OutFile "$env:TEMP\bootstrap.ps1"
powershell -ExecutionPolicy Bypass -File "$env:TEMP\bootstrap.ps1" -User muring
```

저장 위치 메뉴를 선택하고 진행합니다. WSL 설치 시 재부팅을 요구하면 재부팅 후 같은 명령을 실행합니다.
위치 기능을 지원하지 않는 경우 `wsl --update`를 실행합니다.
WSL 자체가 없으면 `wsl --install --no-distribution`부터 실행합니다.

```powershell
# 위치 지정
powershell -ExecutionPolicy Bypass -File "$env:TEMP\bootstrap.ps1" -User muring -InstallDrive D
# 비대화형 Ubuntu 설정: JSON 파일 경로 전달
powershell -ExecutionPolicy Bypass -File "$env:TEMP\bootstrap.ps1" -User muring -ConfigFile 'C:\Setup\config.json'
```

구성 파일을 생략하면 Ubuntu에서 구성 선택 메뉴가 이어집니다.
CLI의 설치 저장소는 `~/dev/dev-bootstrap`이며 기존 checkout은 자동 업데이트하지 않습니다.
앱에 포함된 설치 버전과 GitHub main의 CLI 버전은 다를 수 있습니다.

### 기존 Ubuntu

Ubuntu 터미널에서 일반 개발 계정으로 실행합니다. 전체 스크립트를 sudo로 실행하지 않습니다.

```bash
mkdir -p ~/dev
git clone https://github.com/Muring/dev-bootstrap.git ~/dev/dev-bootstrap
bash ~/dev/dev-bootstrap/linux/setup.sh
```

저장소가 이미 있다면 clone은 생략합니다. 대화형 메뉴에서 권장 항목과 설정을 확인합니다.
비대화형 실행 예시:

```bash
bash ~/dev/dev-bootstrap/linux/setup.sh --config ~/bootstrap-config.json
# 선택된 한 단계만 재시도: 의존성도 실제 상태를 다시 확인
bash ~/dev/dev-bootstrap/linux/setup.sh --config ~/bootstrap-config.json --step kb
# 설치 없이 선택 항목 상태 검사
bash ~/dev/dev-bootstrap/linux/setup.sh --config ~/bootstrap-config.json --check
```

최소 구성 예시:

```json
{
  "version": 1,
  "profile": "common",
  "selected": ["base", "node", "gh"],
  "distro": "Ubuntu",
  "user": "developer",
  "installLocation": "",
  "gitName": "",
  "gitEmail": "",
  "timezone": "Asia/Seoul",
  "kbRepo": "https://github.com/Muring/muring-kb.git",
  "kbDir": "~/dev/muring-kb"
}
```

구성 목록과 의존성의 원본은 `shared/catalog.json`입니다.
CLI 기록은 `~/.local/state/dev-bootstrap/`에 저장됩니다.
`--events <경로>`로 JSONL 위치를 바꿀 수 있고 `.log`와 `.stop`은 같은 이름의 확장자를 사용합니다.
KB만 따로 재시도하는 `linux/setup-kb.sh`도 유지합니다.

## 앱 개발과 빌드

개발자 환경에는 Node 22.23.2 이상과 npm이 필요합니다. 일반 사용자에게는 필요 없습니다.

```bash
cd app
npm ci
npm run build
npm test
npm run dist:win
```

Windows 포터블 산출물: `app/release/DevBootstrap-0.1.0-x64.exe`

Windows에서 개발용 앱을 실행하려면 `npm start`를 사용합니다.
Linux에서 실행하면 화면 개발만 가능하며 Windows 설치 기능은 차단됩니다.
첫 버전에는 코드 서명, 자동 업데이트, 공개 릴리스 자동 게시를 포함하지 않습니다.

구조:

- `app/`: Electron 메인 프로세스, 제한된 preload API, React 설치 마법사
- `shared/catalog.json`: 두 진입점이 공유하는 설치 항목과 의존성
- `windows/app-host.ps1`: Windows 검사, WSL 준비, Ubuntu 설치, 실행 터미널
- `linux/runner.py`: JSON 구성 검증, 의존성 순서, 중지·재실행, JSONL 상태
- `linux/steps.sh`: 각 단계의 검사·적용·검증
- `linux/lib/shell_config.py`: 기존 셸 설정 보존과 관리 파일 연결

Electron 화면에는 Node 접근을 주지 않습니다. 원격 웹페이지를 앱 안에 로드하지 않으며,
프로세스 실행은 검증된 작업 ID와 인자 배열로만 수행합니다. Windows 관리자 권한은
WSL 시스템 준비 helper에만 사용하고 Ubuntu·사용자 설정은 원래 계정 기준으로 실행합니다.

## 검증

시스템을 설치하지 않는 테스트:

```bash
python3 tests/setup-order.py
python3 tests/shell-config.py
python3 tests/setup-kb.py /path/to/muring-kb
cd app
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:ui
```

Windows PowerShell에서:

```powershell
powershell -ExecutionPolicy Bypass -File tests\app-host.ps1
powershell -ExecutionPolicy Bypass -File tests\wsl-location.ps1
powershell -ExecutionPolicy Bypass -File tests\orca-wsl-rename.ps1 -OriginalArchive '<검증된 원본 app.asar>'
```

`app-host.ps1` 테스트는 파싱·인자 전달과 실제 Windows 환경의 읽기 전용 검사와 별도 WSL 창의 인자 전달을 확인합니다.
설치 실행기 테스트는 가짜 외부 명령을 사용하고, KB 테스트는 임시 홈과 로컬 원본을 사용합니다.

현재 확인한 범위: 구성·의존성 테스트, 임시 홈의 셸/Git 설정 보존, KB 회귀 테스트,
브라우저 UI 테스트, 실제 Windows helper 및 WSL 인자 전달, 패키징된 Windows 앱의
preload·IPC·읽기 전용 WSL 검사와 구성 화면입니다.
Orca 패치 회귀 테스트는 검증된 원본 app.asar를 확보하지 못해 이번 검증에서 실행하지 않았습니다.

**신규 Windows VM에서 WSL 설치 → 재부팅 → Ubuntu 생성 → 전체 설치의 실환경 검증은 아직 완료하지 않았습니다.**
자동 테스트와 패키징 성공이 신규 PC 설치 전체의 성공을 의미하지는 않습니다.
실패 시 단계별 기록을 확인하고, 수정 후 같은 구성으로 다시 실행하세요.

PowerShell 파일은 UTF-8 BOM, 셸 스크립트는 LF를 유지합니다.
개인 KB 내용, 계정 토큰, 프로젝트 비밀값을 이 public 저장소에 넣지 않습니다.
