# 공용 명령 작성 규칙

- 개인 공용 명령의 원본은 실제 일반 파일인 `skills/<name>/SKILL.md` 하나로 유지한다.
- `commands/<name>.md`는 `../skills/<name>/SKILL.md`를 가리키는 상대 심볼릭 링크로 만든다. SKILL.md 자체를 링크로 만들지 않으며, 복사본이나 별도 안내 파일을 만들지 않는다.
- Claude는 `~/.claude/commands`, Codex는 `${CODEX_HOME:-~/.codex}/skills/<name>` 연결을 통해 같은 원본을 읽도록 등록한다. 기존 경로 충돌 시 내용을 덮어쓰지 않는다.
- frontmatter에 `name`과 `description`을 포함하고 두 도구가 함께 사용할 수 있는 필드만 사용한다. 입력 힌트는 본문에 적는다.
- Claude 전용 사전 실행 구문에 의존하지 않는다. 필요한 상태 조회는 본문에서 실행하도록 안내하고, Codex에서 `$ARGUMENTS`는 호출에 함께 전달한 입력으로 해석한다고 명시한다.
- 명령 파일의 저장 위치와 사용자가 작업하는 대상 저장소를 구분한다.
- 새 명령도 Claude의 `/<name>`과 Codex의 `$<name>` 호출을 안내하고, 두 경로가 같은 실제 파일인지와 스킬 형식을 검증한다.
- 링크 밖의 원본을 수정하면 실행 중인 Codex의 파일 감시가 갱신을 놓칠 수 있다. 등록 링크에 `os.utime(link, follow_symlinks=False)`와 스킬 검색 루트에 `os.utime(root)`를 적용해 갱신을 알린다. 새 프로세스의 `skills/list` 결과만으로 현재 터미널 표시까지 확인했다고 보고하지 않는다.
- 명령 통합 작업 중에는 그 명령의 본래 동작(커밋·초안 등록 등)을 실행하지 않는다.
