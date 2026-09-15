#!/usr/bin/env python3
"""Run the real post-install flow with fake external apps; no system installation."""
import os
from pathlib import Path
import subprocess
import tempfile

source = (Path(__file__).resolve().parents[1] / 'linux/setup.sh').read_text()
tail = source[source.index('# ---------------------------------------------------------------- dev-setup 스킬'):]
with tempfile.TemporaryDirectory(prefix='bootstrap-order-') as temporary:
    root = Path(temporary)
    repo = root / 'repo'
    (repo / 'linux').mkdir(parents=True)
    (repo / 'skills/dev-setup').mkdir(parents=True)
    (repo / 'commands').mkdir()
    (repo / 'commands/commit.md').write_text('test command')
    (repo / 'linux/setup-kb.sh').write_text('exit "${KB_RESULT:-0}"\n')
    bin_dir = root / 'bin'
    bin_dir.mkdir()
    scripts = {
        'getent': 'echo "tester:x:1000:1000::/tmp:/usr/bin/zsh"',
        'timedatectl': 'echo Asia/Seoul',
        'grep': 'exit 0',  # Exercise the WSL branch independently of the host OS.
        'wslpath': 'echo /test/fix-orca.ps1',
        'powershell.exe': 'echo PATCH_CALLED; exit "${PATCH_RESULT:-0}"',
        'orca-ide': '''echo SKILLS_CALLED
if [ "${SKILL_RESULT:-0}" -ne 0 ]; then exit "$SKILL_RESULT"; fi
for skill in computer-use orca-cli orchestration; do mkdir -p "$HOME/.agents/skills/$skill"; done''',
    }
    for name, body in scripts.items():
        path = bin_dir / name
        path.write_text('#!/bin/bash\n' + body + '\n')
        path.chmod(0o755)
    runner = root / 'run.sh'
    runner.write_text('''set -euo pipefail
NODE_VERSION=22.23.2
TIMEZONE=Asia/Seoul
LOG=/tmp/test-setup.log
step() { echo "STEP:$1"; }
done_() { echo "OK:$1"; }
warn() { echo "WARN:$1"; }
skip() { echo "SKIP:$1"; }
probe() { if [ "$1" = node ]; then echo v22.23.2; else echo version; fi; }
''' + tail)
    cases = [
        ('success', {}, 0),
        ('KB failure', {'KB_RESULT': '1'}, 1),
        ('Orca lock', {'PATCH_RESULT': '1'}, 1),
        ('all failures', {'KB_RESULT': '124', 'SKILL_RESULT': '124', 'PATCH_RESULT': '124'}, 1),
    ]
    for index, (name, changes, expected) in enumerate(cases):
        profile = root / f'user-{index}'
        profile.mkdir()
        env = dict(os.environ, HOME=str(profile), REPO_DIR=str(repo / 'linux'),
                   PATH=f'{bin_dir}:{os.environ["PATH"]}', ORCA_CLI_COMMAND='orca-ide') | changes
        result = subprocess.run(['bash', str(runner)], env=env, text=True, capture_output=True)
        output = result.stdout + result.stderr
        assert result.returncode == expected, output
        steps = [line for line in output.splitlines() if line.startswith('STEP:')]
        assert steps == [
            'STEP:dev-setup 스킬', 'STEP:Claude 커맨드', 'STEP:기본 개발환경 검증',
            'STEP:MuRing-KB 설치 및 Codex 등록', 'STEP:Orca 스킬', 'STEP:Orca WSL 자동 이름 생성 패치',
        ], output
        assert (profile / '.claude/skills/dev-setup').is_dir()
        assert (profile / '.claude/commands/commit.md').is_file()
        assert output.index('SKILLS_CALLED') < output.index('PATCH_CALLED')
        assert '자동화할 수 없는 것' in output
        if expected:
            assert '✗ 미완료' in output
            assert '✓ 전부 확인됨' not in output
        if name == 'all failures':
            summary = next(line for line in output.splitlines() if '✗ 미완료' in line)
            assert 'MuRing-KB' in summary and 'computer-use' in summary and 'Orca 이름 생성 패치' in summary
        print(f'PASS: {name}: core links, ordering, continued execution, final status')
