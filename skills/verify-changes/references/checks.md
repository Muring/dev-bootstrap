# 검사 설정

저장소 루트 `.agent-checks.json` 예시:

```json
{
  "version": 1,
  "checks": [
    {"name":"lint", "command":["yarn","lint"], "paths":["src/*","package.json","yarn.lock"], "timeout":120},
    {"name":"render", "command":["yarn","verify:render"], "paths":["src/lib/markdown/*","backup/posts/*","scripts/smoke-render.mts","package.json","yarn.lock"], "timeout":120}
  ]
}
```

`command`는 셸 문자열이 아닌 argv 배열이다. `paths`는 저장소 상대 경로에 Python fnmatch 규칙을 적용하며 `*`는 `/`도 포함한다. 빈 paths는 변경이 있을 때 항상 실행한다. 설정 자체가 바뀌면 모든 등록 검사를 선택한다. 공용 의존성 파일을 누락하지 않는다.
`--run` 없이 선택 목록만 출력한다. `--all --run`으로 등록 검사 전체를 실행한다. 검사에 코드 생성·설치·배포를 숨기지 않는다. 외부 쓰기를 하는 검사는 일반 회귀 설정에서 제외한다.
검사 결과는 status·exit_code·시간·로그 경로를 포함하고 실패 시 마지막 15줄(최대 약 4KB)만 출력한다. 결과 전체는 같은 임시 디렉터리의 result.json에 남는다.
