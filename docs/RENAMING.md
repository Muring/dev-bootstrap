# MuRing Dev Setup 개명 전환

GitHub 저장소를 `Muring/muring-dev-setup`으로 개명하고 로컬 origin 및 설치·콘텐츠 URL을 전환했습니다.
앱 표시 이름·산출물 이름 변경과 URL 전환을 소스에 반영했습니다.
버전 증가와 새 EXE 배포는 별도 작업입니다.

## 이름과 호환성

| 대상 | 전환 값 또는 유지 값 |
|---|---|
| 앱 표시 이름 | `MuRing Dev Setup` |
| 새 배포 파일 | `MuRingDevSetup-<버전>-x64.exe` |
| 목표 GitHub 저장소 | `Muring/muring-dev-setup` |
| 현재 로컬 소스의 다운로드 원본 | `Muring/muring-dev-setup` |
| npm 이름 / Electron appId | `dev-bootstrap-wizard` / `dev.muring.bootstrap` 유지 |
| Windows 설정·로그 | `%LOCALAPPDATA%\dev-bootstrap` 유지 |
| Linux 자산·콘텐츠 / 실행 기록 | `~/.local/share/dev-bootstrap` / `~/.local/state/dev-bootstrap` 유지 |
| 셸 설정 / 관리 블록 | `~/.config/dev-bootstrap` / `# >>> dev-bootstrap >>>` 및 종료 표식 유지 |
| CLI checkout 기본 위치 | `~/dev/dev-bootstrap` 유지 |

설치 경로를 바꾸면 콘텐츠 상태·백업·잠금과 Claude/Codex 등록 링크의 이전이 필요합니다.
셸 관리 블록 이름만 바꾸면 기존 블록이 남고 새 블록이 추가될 수 있습니다.
이번 개명에서는 내부 식별자, `bootstrap` 리소스 폴더, IPC·진행 이벤트 이름,
Orca 복원용 백업 파일명도 유지합니다. `bootstrap` 문자열 전체를 일괄 치환하지 않습니다.
공용 스킬의 이름·원본·등록 링크도 바꾸지 않습니다.

## 저장소 개명 실행 순서 (전환 절차 기록)

GitHub 개명·origin 갱신·아래 참조 변경에 사용한 전환 절차입니다. 새 릴리스는 별도 작업입니다.

1. 목표 이름 `Muring/muring-dev-setup` 사용 가능 여부와 저장소 관리 권한을 확인합니다.
2. GitHub 저장소 Settings에서 Repository name을 `muring-dev-setup`으로 변경합니다.
3. 새 웹 주소가 기존 저장소를 가리키는지 확인하고, 로컬 remote의 프로토콜을 유지해 주소를 갱신합니다.
   HTTPS remote라면 `git remote set-url origin https://github.com/Muring/muring-dev-setup.git`을 사용합니다.
   로컬 작업 폴더는 이동하지 않습니다. 다른 checkout·worktree의 remote와 도구 등록은 별도로 확인합니다.
4. 아래 파일에서 저장소 주소만 바꾸고 검증합니다. 로컬 설치 경로의 `dev-bootstrap`은 유지합니다.
5. 검토한 변경을 커밋·push한 뒤 새 주소의 main에 반영됐는지 확인합니다.
6. 새 버전 번호를 정하고 [배포 절차](RELEASING.md)에 따라 새 EXE를 검증·배포합니다.

[GitHub 공식 문서](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)는
개명 후 웹 트래픽과 기존 clone/fetch/push 주소의 리디렉션을 설명하고 remote 갱신을 권장합니다.
이전 이름으로 새 저장소를 만들면 리디렉션이 사라지므로 `Muring/dev-bootstrap`을 재사용하지 않습니다.
API·raw 파일·기존 릴리스 다운로드 경로는 아래 항목으로 실제 확인합니다.

## 개명 후 전환한 참조

다음 참조를 개명 변경에 포함했습니다.

| 파일 | 변경 |
|---|---|
| `linux/lib/content.py` | `REPO = 'Muring/dev-bootstrap'` → `REPO = 'Muring/muring-dev-setup'` |
| `tests/content-update.py` | fixture의 `repository='Muring/dev-bootstrap'` → `repository='Muring/muring-dev-setup'` |
| `windows/bootstrap.ps1` | `$Repo` 기본값을 `https://github.com/Muring/muring-dev-setup.git`으로 변경. UTF-8 BOM 유지 |
| `README.md` | GitHub·raw URL의 `Muring/dev-bootstrap`을 `Muring/muring-dev-setup`으로 변경 |

기존 릴리스 태그와 파일명(`DevBootstrap-0.1.8-x64.exe` 등), `docs/releases/`의 과거 기록은 유지합니다.
새 버전 공개 전까지 README 다운로드 버튼도 실제 공개된 기존 EXE를 가리켜야 합니다.
새 버전 공개 시 새 태그·파일명으로 README 다운로드 링크를 갱신합니다.

## 전환 검증

- 앱 변경: `cd app`에서 `npm run format:check`, `npm test`, `npm run build`, `npm run test:ui`.
- 콘텐츠 원본 전환: 저장소 루트에서 `python3 tests/content-update.py`.
- Windows bootstrap URL 전환: Windows PowerShell에서 파일 파싱과 기본 `$Repo` 값을 확인하고,
  새 raw URL에서 스크립트를 내려받아 저장소 소스와 비교합니다. 설치 실행과 구분합니다.
- GitHub: 새 웹·Git·API·raw 주소가 같은 저장소를 가리키는지 확인합니다.
- 기존 사용자: 이전 API 주소를 사용하는 공개 버전과 새 원본 양쪽에서 콘텐츠 미리보기가 되는지 확인합니다.
  `python3 linux/content.py preview`는 다운로드 원본 조회만 수행하며 설치 적용은 하지 않습니다.
- 기존 릴리스: 이전 다운로드 링크가 동작하고 내려받은 EXE의 SHA-256이 기존 체크섬과 같은지 확인합니다.
- 새 릴리스: Windows에서 기존 선택 기록을 읽고 스킬 연결·셸 설정을 유지하는지 확인합니다.

저장소 개명 전에는 새 URL·리디렉션·기존 EXE 호환성을 검증 완료로 보고하지 않습니다.
로컬 자동 테스트와 실제 Windows 앱·설치 검증 결과를 구분해서 기록합니다.

## 2026-09-18 전환 검증 결과

- GitHub 저장소 ID `1362029496`을 유지한 채 `Muring/muring-dev-setup`으로 개명했습니다.
- 로컬 origin의 fetch/push 주소를 새 HTTPS URL로 갱신하고 `git ls-remote` 조회를 확인했습니다.
- 이전 웹 주소는 새 웹 주소로 이동하며, 두 주소 모두 HTTP 200으로 응답했습니다.
- 이전·새 API 원본에서 같은 main 커밋 `e817efb1c63cbb80a20e5975a42b32fd0775e913`과 콘텐츠 파일 40개를 확인했습니다.
  양쪽에서 스킬 blob 하나를 내려받아 코드의 크기·Git 해시 검증을 통과했습니다.
- 이전·새 raw URL의 `windows/bootstrap.ps1` 내용이 일치했습니다.
- 이전 링크에서 기존 0.1.8 EXE를 내려받아 SHA-256이 개명 전 릴리스 digest 및 `SHA256SUMS.txt`와 일치함을 확인했습니다.
  SHA-256: `a4e14a222e27f433c1630d3e3f89d20a34a4d7c3321aafe8da189f22131265d4`.
  Python HTTPS 다운로드는 TLS 읽기 오류가 있었고, curl로 다시 내려받아 검증했습니다.
- `python3 tests/content-update.py`: 10개 통과.
- Windows PowerShell Parser로 변경한 bootstrap 스크립트의 문법 및 `$Repo` 기본값을 확인했습니다. UTF-8 BOM도 유지했습니다.
- `git diff --check`: 통과. Windows 파일의 LF→CRLF Git 안내는 있으나 공백 오류는 없었습니다.
- 앞선 앱 표시 이름 변경의 format 검사·단위 테스트 14개·빌드·UI 테스트 11개는 통과했습니다.
  이번 URL 전환에서는 앱 소스를 추가 변경하지 않아 반복 실행하지 않았습니다.
- 위 검증은 개명 변경의 커밋·push 전에 수행했습니다. 기존 EXE를 실제 실행한 설치 검증, 새 EXE 패키징·배포는 하지 않았습니다.
