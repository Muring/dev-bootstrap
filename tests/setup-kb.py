#!/usr/bin/env python3
"""Integration checks with a local KB checkout; no network or real profile changes.

Usage: python3 tests/setup-kb.py /path/to/muring-kb
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

installer = Path(__file__).resolve().parents[1] / 'linux/setup-kb.sh'
source = Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='bootstrap-kb-test-') as temporary:
    root = Path(temporary)
    profile = root / 'user'
    profile.mkdir()
    kb = profile / 'dev/KB with spaces'
    codex = profile / 'custom-codex'
    codex.mkdir()
    agents = codex / 'AGENTS.override.md'
    agents.write_text('Keep existing instructions.\n')
    env = dict(os.environ, HOME=str(profile), CODEX_HOME=str(codex),
               MURING_KB_DIR=str(kb), MURING_KB_REPO=str(source),
               GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM='1')

    def run(expected=0, **changes):
        result = subprocess.run(['bash', str(installer)], env=env | changes,
                                text=True, capture_output=True)
        assert (result.returncode == 0) == (expected == 0), result.stdout + result.stderr
        return result

    run()
    assert (profile / '.local/bin/mkb').resolve() == kb / 'scripts/kb.py'
    text = agents.read_text()
    assert text.startswith('Keep existing instructions.\n')
    assert str(kb / 'START-HERE.md') in text
    assert not (codex / 'AGENTS.md').exists()
    backups = list(codex.glob('*.muring-kb-backup-*'))
    assert len(backups) == 1
    (kb / 'local-note.txt').write_text('preserve local work')
    run()
    assert agents.read_text() == text
    assert list(codex.glob('*.muring-kb-backup-*')) == backups
    assert (kb / 'local-note.txt').read_text() == 'preserve local work'
    print('PASS: clone, spaces, custom Codex profile, override, backup, mkb, repeat, local changes')

    run(1, MURING_KB_REPO=str(root / 'other-repo'))
    assert agents.read_text() == text
    invalid = root / 'not-a-repository'
    invalid.mkdir()
    run(1, MURING_KB_DIR=str(invalid))
    assert not list(invalid.iterdir())
    missing = root / 'failed-clone'
    run(1, MURING_KB_DIR=str(missing), MURING_KB_REPO=str(root / 'missing-source'))
    assert not missing.exists()
    assert not list(root.glob('.muring-kb-clone.*'))
    print('PASS: wrong origin, unrelated directory, clone failure and cleanup')

    command = profile / '.local/bin/mkb'
    command.unlink()
    command.write_text('preserve command')
    run(1)
    assert command.read_text() == 'preserve command'
    print('PASS: existing mkb conflict fails without overwrite')
